import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Rocket, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Zap,
  Clock,
  Users,
  DollarSign,
  Calendar,
  Shield,
  Info,
  ArrowRight,
  ArrowLeft,
  Twitter,
  Globe,
  MessageCircle,
  Hash,
  Upload,
  Image,
  X,
  TrendingUp,
  Lock
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getConnection } from '@/lib/connection';
import { 
  createInitializeMintInstruction,
  createInitializeMint2Instruction,
  TOKEN_PROGRAM_ID, 
  MINT_SIZE, 
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  ExtensionType,
  createInitializeMetadataPointerInstruction,
  createInitializeInstruction as createInitializeMetadataInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  TYPE_SIZE,
  LENGTH_SIZE
} from '@solana/spl-token';
import { pack } from '@solana/spl-token-metadata';
import { useLocation } from 'wouter';
import { pinataService, uploadImageToIPFS } from '@/lib/pinataService';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import DEXSelector from '@/components/DEXSelector';
import TokenVisibilityCard from '@/components/TokenVisibilityCard';
import { LetsCookProgram, LaunchInstruction, PROGRAM_ID } from '@/lib/nativeProgram';
// LEDGER_WALLET removed - using placeholder for now
import { realLaunchService } from '@/lib/realLaunchService';
import { swapTokensRaydium, addLiquidityRaydium } from '@/lib/raydium';
import { TokenVisibilityHelper, TokenMetadata } from '@/lib/tokenVisibilityHelper';
import { SPLTokenMetadataService } from '@/lib/splTokenMetadataService';
import { LaunchpadTokenMetadataService } from '@/lib/launchpadTokenMetadataService';

const STEPS = ['basic', 'dex', 'config', 'social', 'review'];

// Placeholder wallet address for fees - replace with actual fee wallet
const LEDGER_WALLET = new PublicKey('A3pqxWWtgxY9qspd4wffSJQNAb99bbrUHYb1doMQmPcK');

export default function EnhancedLaunchPage() {
  const { connected, publicKey, wallet, signTransaction } = useWallet();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [createdLaunchId, setCreatedLaunchId] = useState<string | null>(null);
  const [createdTokenMint, setCreatedTokenMint] = useState<string | null>(null);
  const [showTokenVisibility, setShowTokenVisibility] = useState(false);

  // Connection using environment variable
  const connection = getConnection('confirmed');

  // Extract IPFS hash from URL to reduce transaction size
  // Modern IPFS CIDs (v1) can contain hyphens and underscores (e.g., bafybei...-abc)
  const extractIPFSHash = (ipfsUrl: string): string => {
    if (!ipfsUrl) return '';
    
    // Extract hash from various IPFS URL formats
    // Use [^/?#]+ to capture CID with hyphens/underscores and any path suffix
    const patterns = [
      /\/ipfs\/([^/?#]+)/,  // /ipfs/hash (supports hyphens, underscores, and path suffixes)
      /ipfs\.io\/ipfs\/([^/?#]+)/,  // ipfs.io/ipfs/hash
      /gateway\.pinata\.cloud\/ipfs\/([^/?#]+)/,  // gateway.pinata.cloud/ipfs/hash
      /ipfs:\/\/([^/?#]+)/,  // ipfs://hash (protocol format)
    ];
    
    for (const pattern of patterns) {
      const match = ipfsUrl.match(pattern);
      if (match && match[1]) {
        // Extract just the CID (remove any path suffix like /metadata.json)
        const fullMatch = match[1];
        // CID is typically 46-59 characters, but can have path suffixes
        // For now, return the full match - the backend will handle it
        return fullMatch;
      }
    }
    
    // If this is a base64 data URL, don't send it on-chain (too large for instruction)
    if (ipfsUrl.startsWith('data:image')) {
      console.warn('⚠️ Base64 image detected - skipping on-chain reference. Upload to IPFS to include icon/banner.');
      return '';
    }
    
    // If no pattern matches, return the original URL (fallback)
    return ipfsUrl;
  };
  
  // Define the form data type
  interface FormData {
    dexProvider: string;
    name: string;
    symbol: string;
    description: string;
    totalSupply: number;
    decimals: number;
    // Note: initialPrice removed - price is determined by bonding curve formula
    // For instant launches, price = f(supply) from bonding curve
    // For raffle launches, ticketPrice is set in CreateRafflePage.tsx
    liquidityAmount: number;
    liquidityTokenAmount?: number;
    creatorPurchaseAmount?: number;
    // Liquidity locking options
    lockLiquidity: boolean;
    lockDuration: number; // Duration in days (30, 90, 365)
    lockAmount?: number; // Amount of LP tokens to lock (if not all)
    website: string;
    twitter: string;
    telegram: string;
    discord: string;
    image: string;
    banner: string;
    type: 'instant' | 'raffle'; // Launch type
  }
  
  const [formData, setFormData] = useState<FormData>({
    dexProvider: 'cook',
    name: '',
    symbol: '',
    description: '',
    totalSupply: 1000000000, // 1 billion (recommended default)
    decimals: 6,
    // initialPrice removed - price determined by bonding curve
    liquidityAmount: 0,
    liquidityTokenAmount: 0,
    creatorPurchaseAmount: 0,
    lockLiquidity: false,
    lockDuration: 30, // Default to 30 days
    lockAmount: undefined, // Lock all by default
    website: '',
    twitter: '',
    telegram: '',
    discord: '',
    image: '',
    banner: '',
    type: 'instant' // Default to instant launch
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Navigate to the launch detail page when instant launch is created
  useEffect(() => {
    if (createdLaunchId && txSignature) {
      console.log('🔍 Navigation debug:', {
        createdLaunchId,
        txSignature: txSignature.slice(0, 8) + '...',
        launchType: 'instant'
      });
      
      // Navigate to the launch detail page for instant launches
      setLocation(`/launch/${createdLaunchId}`);
    }
  }, [createdLaunchId, txSignature, setLocation]);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch(STEPS[step]) {
      case 'basic':
        if (!formData.name.trim()) {
          newErrors.name = 'Token name is required';
        }
        if (!formData.symbol.trim()) {
          newErrors.symbol = 'Token symbol is required';
        }
        if (!formData.description.trim()) {
          newErrors.description = 'Token description is required';
        }
        break;
      case 'dex':
        if (!formData.dexProvider) {
          newErrors.dexProvider = 'Please select a DEX provider';
        }
        break;
      case 'config':
        // For instant launches, price is determined by bonding curve (no manual price input)
        // Only validate supply and decimals
        const totalSupplyNum = Number(formData.totalSupply) || 0;
        const decimalsNum = Number(formData.decimals);
        if (totalSupplyNum <= 0) {
          newErrors.totalSupply = 'Total supply must be greater than 0';
        }
        // Note: Large supplies (>10B) are allowed but will show a warning
        // The backend now scales bonding curve constants to handle large supplies better
        if (isNaN(decimalsNum) || decimalsNum < 0 || decimalsNum > 9) {
          newErrors.decimals = 'Decimals must be between 0 and 9';
        }
        break;
      case 'social':
        // Image is now required
        if (!formData.image || formData.image.trim() === '') {
          newErrors.image = 'Token image is required';
        }
        break;
      case 'review':
        // Validate image again before final submission
        if (!formData.image || formData.image.trim() === '') {
          newErrors.image = 'Token image is required';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const updateFormData = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value } as FormData));
    if (errors[field]) {
      const { [field]: _, ...rest } = errors;
      setErrors(rest);
    }
  };

  // Import supply converter utility
  // Note: We allow ANY supply input - the backend will automatically scale it
  // This is the "virtual supply" + "real supply" system used by pump.fun

  // Helper function to handle number input changes
  const handleNumberChange = (field: keyof FormData, value: string) => {
    // Allow empty string (user is clearing the field)
    if (value === '') {
      updateFormData(field, '' as any);
      // Clear error when field is cleared
      if (field === 'totalSupply' || field === 'decimals') {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
      return;
    }
    
    // Allow partial decimal input like "0.", "123.", ".5"
    // These are valid intermediate states while typing
    if (value.endsWith('.') || value === '.' || value.startsWith('.')) {
      // Keep the string value temporarily to allow decimal point input
      updateFormData(field, value as any);
      return;
    }
    
    // Only allow numbers and decimal point
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue >= 0) {
      updateFormData(field, numericValue);
      
      // Note: We no longer validate supply/decimals combination here
      // The backend will automatically convert virtual supply to real supply
      // Users can enter ANY supply amount - the system will scale it safely
    }
  };

  const storeImageLocally = (file: File, field: 'image' | 'banner', reason?: string) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      updateFormData(field, result);
      toast({
        title: "Stored Locally",
        description: reason
          ? `${reason} Saved as a local base64 image instead.`
          : "Image uploaded locally. Configure Pinata for IPFS storage.",
      });
    };
    reader.readAsDataURL(file);
  };

  // Image upload functions
  const handleImageUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check if Pinata is configured
      if (!pinataService.isPinataConfigured()) {
        storeImageLocally(file, 'image');
        return;
      }

      // Upload to IPFS via Pinata
      toast({
        title: "Uploading to IPFS...",
        description: "Please wait while your image is uploaded to IPFS.",
      });

      const ipfsUrl = await uploadImageToIPFS(
        await fileToBase64(file),
        file.name,
        {
          name: `${formData.name || 'token'}-image`,
          keyvalues: {
            tokenName: formData.name || 'unknown',
            tokenSymbol: formData.symbol || 'unknown',
            uploadDate: new Date().toISOString(),
            type: 'image'
          }
        }
      );

      console.log('📸 Image upload complete, URL:', ipfsUrl);
      
      // Verify the URL is accessible before setting it
      try {
        const testResponse = await fetch(ipfsUrl, { method: 'HEAD', mode: 'no-cors' });
        console.log('✅ Image URL is accessible:', ipfsUrl);
      } catch (testError) {
        console.warn('⚠️ Could not verify image URL accessibility (CORS), but URL should work:', ipfsUrl);
      }

      updateFormData('image', ipfsUrl);
      toast({
        title: "Image Uploaded to IPFS!",
        description: "Your image is now permanently stored on IPFS.",
      });

    } catch (error) {
      console.error('Image upload error:', error);
      storeImageLocally(
        file,
        'image',
        "Failed to upload image to Pinata (check proxy/CORS settings)."
      );
    }
  };

  const handleBannerUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "File Too Large",
        description: "Please select a banner smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check if Pinata is configured
      if (!pinataService.isPinataConfigured()) {
        storeImageLocally(file, 'banner');
        return;
      }

      // Upload to IPFS via Pinata
      toast({
        title: "Uploading Banner to IPFS...",
        description: "Please wait while your banner is uploaded to IPFS.",
      });

      const ipfsUrl = await uploadImageToIPFS(
        await fileToBase64(file),
        file.name,
        {
          name: `${formData.name || 'token'}-banner`,
          keyvalues: {
            tokenName: formData.name || 'unknown',
            tokenSymbol: formData.symbol || 'unknown',
            uploadDate: new Date().toISOString(),
            type: 'banner'
          }
        }
      );

      console.log('📸 Banner upload complete, URL:', ipfsUrl);
      
      updateFormData('banner', ipfsUrl);
      toast({
        title: "Banner Uploaded to IPFS!",
        description: "Your banner is now permanently stored on IPFS.",
      });

    } catch (error) {
      console.error('Banner upload error:', error);
      storeImageLocally(
        file,
        'banner',
        "Failed to upload banner to Pinata (check proxy/CORS settings)."
      );
    }
  };

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Helper function to check wallet balance
  const checkWalletBalance = async () => {
    if (!publicKey) return 0;
    
    try {
      const balance = await connection.getBalance(publicKey);
      return balance;
    } catch (error) {
      console.error('Failed to get wallet balance:', error);
      return 0;
    }
  };

  // Helper function to request airdrop for funding (devnet only)
  const requestAirdrop = async () => {
    if (!publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('💰 Requesting airdrop for wallet:', publicKey.toBase58());
      const signature = await connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(signature, 'confirmed');
      
      toast({
        title: "Airdrop Successful",
        description: "2 SOL has been added to your wallet.",
      });
    } catch (error) {
      console.error('Airdrop failed:', error);
      toast({
        title: "Airdrop Failed",
        description: "Failed to request airdrop. Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeImage = () => {
    // Image is required, show warning instead of removing
    toast({
      title: "Image Required",
      description: "Token image is required and cannot be removed. Please upload a new image to replace it.",
      variant: "destructive",
    });
  };

  const handleSubmit = async () => {
    // Prevent double submission
    if (isSubmitting) {
      console.log('⚠️ Submission already in progress, ignoring duplicate request');
      return;
    }
    
    // Validate all steps including image requirement
    if (!validateStep(currentStep)) return;
    
    // Final validation: ensure image is present
    if (!formData.image || formData.image.trim() === '') {
      toast({
        title: "Image Required",
        description: "Token image is required to create a launch. Please upload an image.",
        variant: "destructive",
      });
      setErrors(prev => ({ ...prev, image: 'Token image is required' }));
      // Navigate to social step (step 3) where image upload is
      setCurrentStep(3);
      return;
    }
    
    // Note: No supply validation needed - backend will automatically convert
    // virtual supply (user input) to real supply (safe for u64)
    // This allows users to enter ANY supply amount without restrictions
    
    // Enhanced wallet validation
    if (!connected || !publicKey || !wallet || !signTransaction) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create a launch.",
        variant: "destructive",
      });
      return;
    }

    console.log('🔍 Wallet validation passed:', {
      connected,
      publicKey: publicKey?.toString(),
      walletAdapter: !!wallet.adapter,
      adapterConnected: wallet.adapter?.connected
    });

    // Verify network connection
    const connection = getConnection();
    const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    console.log('🌐 Network Configuration:');
    console.log('  RPC URL:', rpcUrl);
    console.log('  Is devnet:', rpcUrl.includes('devnet'));
    console.log('  Is mainnet:', rpcUrl.includes('mainnet') || rpcUrl.includes('mainnet-beta'));
    
    // Verify network by checking genesis hash
    try {
      const genesisHash = await connection.getGenesisHash();
      console.log('  Genesis hash:', genesisHash);
      // Devnet genesis hash: EtWTRABZaYq6iMfeYKouRu166Dz6CM2Dtmk1D8huVgBd
      // Mainnet genesis hash: 5eykt4UsFv8P8NJdTREpY1vzUJbqW8ZvqJqJqJqJqJqJq
      const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166Dz6CM2Dtmk1D8huVgBd';
      const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzUJbqW8ZvqJqJqJqJqJqJq';
      if (genesisHash === DEVNET_GENESIS) {
        console.log('  ✅ Confirmed: Connected to DEVNET');
      } else if (genesisHash === MAINNET_GENESIS) {
        console.log('  ⚠️ WARNING: Connected to MAINNET!');
        toast({
          title: "Wrong Network",
          description: "You are connected to MAINNET. Please switch to DEVNET to create test tokens.",
          variant: "destructive",
        });
        return;
      } else {
        console.log('  ⚠️ Unknown network (genesis hash:', genesisHash, ')');
      }
    } catch (error) {
      console.warn('⚠️ Could not verify network:', error);
    }

    // Check wallet balance before proceeding
    // Calculate actual rent requirements using getMinimumBalanceForRentExemption
    // Account sizes for instant launch rent calculation
    const MINT_ACCOUNT_SIZE = 165; // Token-2022 mint with MetadataPointer extension
    const TOKEN_ACCOUNT_SIZE = 165; // Token-2022/SPL token account (165 bytes)
    const ATA_SIZE = 165; // Associated Token Account (same as token account)
    const LISTING_ACCOUNT_SIZE = 500; // Estimate for listing PDA
    const LAUNCH_DATA_ACCOUNT_SIZE = 600; // Estimate for launch_data PDA
    const AMM_ACCOUNT_SIZE = 200; // Estimate for AMM PDA
    const PRICE_DATA_SIZE = 200; // Estimate for price_data PDA
    const USER_DATA_SIZE = 200; // Estimate for user_data PDA
    const COOK_DATA_SIZE = 100; // Estimate for cook_data PDA
    const LP_MINT_SIZE = 82; // LP token mint (smaller, no extensions)
    
    let MIN_BALANCE_REQUIRED = 0.15; // Default fallback (0.15 SOL - increased for safety)
    
    try {
      // Calculate rent for all account types
      const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_ACCOUNT_SIZE);
      const tokenAccountRent = await connection.getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_SIZE);
      const ataRent = await connection.getMinimumBalanceForRentExemption(ATA_SIZE);
      const listingRent = await connection.getMinimumBalanceForRentExemption(LISTING_ACCOUNT_SIZE);
      const launchDataRent = await connection.getMinimumBalanceForRentExemption(LAUNCH_DATA_ACCOUNT_SIZE);
      const ammRent = await connection.getMinimumBalanceForRentExemption(AMM_ACCOUNT_SIZE);
      const priceDataRent = await connection.getMinimumBalanceForRentExemption(PRICE_DATA_SIZE);
      const userDataRent = await connection.getMinimumBalanceForRentExemption(USER_DATA_SIZE);
      const cookDataRent = await connection.getMinimumBalanceForRentExemption(COOK_DATA_SIZE);
      const lpMintRent = await connection.getMinimumBalanceForRentExemption(LP_MINT_SIZE);
      
      // Accounts that will be created in instant_launch:
      // 1. base_token_mint (Token-2022 mint with MetadataPointer) = mintRent
      // 2. listing PDA = listingRent
      // 3. launch_data PDA = launchDataRent
      // 4. amm_quote (token account for WSOL) = tokenAccountRent
      // 5. cook_base_token (ATA for cook_pda) = ataRent
      // 6. amm_base (token account for base token) = tokenAccountRent
      // 7. lp_token_mint = lpMintRent
      // 8. price_data PDA = priceDataRent
      // 9. user_data PDA = userDataRent
      // 10. amm PDA = ammRent
      // 11. cook_data PDA = cookDataRent (might already exist)
      
      const totalAccountRent = 
        mintRent +           // base_token_mint
        listingRent +        // listing PDA
        launchDataRent +     // launch_data PDA
        tokenAccountRent +   // amm_quote (token account)
        ataRent +            // cook_base_token (ATA)
        tokenAccountRent +   // amm_base (token account)
        lpMintRent +         // lp_token_mint
        priceDataRent +      // price_data PDA
        userDataRent +       // user_data PDA
        ammRent +            // amm PDA
        cookDataRent;        // cook_data PDA (might already exist, but count it for safety)
      
      // WSOL wrapping amount (0.01 SOL = 10,000,000 lamports) - needed for initial liquidity
      const wsolWrapAmount = 10_000_000; // 0.01 SOL for initial WSOL wrap
      
      // Transaction fee buffer (0.000005 SOL = 5,000 lamports)
      const txFeeBuffer = 5_000;
      
      // Extra safety buffer (0.01 SOL = 10,000,000 lamports) - accounts for:
      // - Rent calculation differences between networks
      // - Account size variations
      // - Potential additional fees
      const safetyBuffer = 10_000_000;
      
      const totalRentRequired = totalAccountRent + wsolWrapAmount + txFeeBuffer + safetyBuffer;
      MIN_BALANCE_REQUIRED = Math.max(totalRentRequired / LAMPORTS_PER_SOL, 0.15); // At least 0.15 SOL
      
      console.log('💰 Detailed rent calculation for instant launch:', {
        accounts: {
          baseTokenMint: (mintRent / LAMPORTS_PER_SOL).toFixed(6),
          listing: (listingRent / LAMPORTS_PER_SOL).toFixed(6),
          launchData: (launchDataRent / LAMPORTS_PER_SOL).toFixed(6),
          ammQuote: (tokenAccountRent / LAMPORTS_PER_SOL).toFixed(6),
          cookBaseToken: (ataRent / LAMPORTS_PER_SOL).toFixed(6),
          ammBase: (tokenAccountRent / LAMPORTS_PER_SOL).toFixed(6),
          lpTokenMint: (lpMintRent / LAMPORTS_PER_SOL).toFixed(6),
          priceData: (priceDataRent / LAMPORTS_PER_SOL).toFixed(6),
          userData: (userDataRent / LAMPORTS_PER_SOL).toFixed(6),
          amm: (ammRent / LAMPORTS_PER_SOL).toFixed(6),
          cookData: (cookDataRent / LAMPORTS_PER_SOL).toFixed(6),
        },
        subtotals: {
          allAccounts: (totalAccountRent / LAMPORTS_PER_SOL).toFixed(6),
          wsolWrap: (wsolWrapAmount / LAMPORTS_PER_SOL).toFixed(6),
          txFee: (txFeeBuffer / LAMPORTS_PER_SOL).toFixed(6),
          safetyBuffer: (safetyBuffer / LAMPORTS_PER_SOL).toFixed(6),
        },
        total: MIN_BALANCE_REQUIRED.toFixed(6),
      });
    } catch (error) {
      console.warn('⚠️ Could not calculate rent, using fallback estimate:', error);
      MIN_BALANCE_REQUIRED = 0.15; // Safe fallback
    }
    
    const balance = await checkWalletBalance();
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    console.log('💰 Wallet balance check:');
    console.log('  Current balance:', balanceSOL.toFixed(6), 'SOL');
    console.log('  Minimum required:', MIN_BALANCE_REQUIRED.toFixed(6), 'SOL');
    console.log('  Status:', balanceSOL >= MIN_BALANCE_REQUIRED ? '✅ Sufficient' : '❌ Insufficient');
    
    if (balanceSOL < MIN_BALANCE_REQUIRED) {
      const shortfall = MIN_BALANCE_REQUIRED - balanceSOL;
      const recommendedAmount = Math.max(shortfall * 1.2, 0.05); // 20% extra buffer, at least 0.05 SOL
      
      toast({
        title: "❌ Insufficient Balance",
        description: `You need at least ${MIN_BALANCE_REQUIRED.toFixed(6)} SOL to create a token launch.\n\n` +
          `Current balance: ${balanceSOL.toFixed(6)} SOL\n` +
          `Shortfall: ${shortfall.toFixed(6)} SOL\n\n` +
          `Recommended: Add ${recommendedAmount.toFixed(6)} SOL to your wallet (includes 20% buffer).\n\n` +
          `This covers rent for:\n` +
          `• Token mint account (~0.002 SOL)\n` +
          `• Listing & Launch data PDAs (~0.006 SOL)\n` +
          `• Token accounts (ATAs) (~0.006 SOL)\n` +
          `• WSOL wrapping (~0.01 SOL)\n` +
          `• Transaction fees & safety buffer (~0.01 SOL)`,
        variant: "destructive",
        duration: 10000, // Show for 10 seconds
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // ============================================
      // STEP 1: Derive token mint PDA (same as backend)
      // ============================================
      // Derive page_name for PDA derivation (same as backend)
      const pageName = formData.name.toLowerCase().replace(/\s+/g, '-').substring(0, 10);
      
      // Derive token mint PDA using same seeds as backend: [b"cook", b"TokenMint", page_name]
      // This ensures "cook" appears in the address (like pump.fun/bonk.fun)
      console.log('🔑 STEP 1: Deriving token mint PDA with "cook" prefix...');
      console.log(`   Seeds: [b"cook", b"TokenMint", page_name: "${pageName}"]`);
      const [baseTokenMintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('cook'), Buffer.from('TokenMint'), Buffer.from(pageName)],
        PROGRAM_ID
      );
      console.log(`✅ Token mint PDA derived: ${baseTokenMintPDA.toBase58()}`);
      console.log(`   Contains "cook" in derivation seeds for branding`);
      
      // Note: Backend will create and initialize the PDA account using create_2022_token
      // No keypair generation needed - PDAs are deterministic and don't require signing
      
      // Derive listing PDA (backend expects this to be a PDA)
      const [listingPDA] = PublicKey.findProgramAddressSync(
        [baseTokenMintPDA.toBuffer(), Buffer.from('Listing')],
        PROGRAM_ID
      );
      console.log(`✅ Derived listing PDA: ${listingPDA.toBase58()}`);
      
      // Derive launch_data PDA (backend expects this to be a PDA with seeds [page_name, b"Launch"])
      const [launchDataPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from(pageName), Buffer.from('Launch')],
        PROGRAM_ID
      );
      console.log(`✅ Derived launch_data PDA: ${launchDataPDA.toBase58()}`);
      
      console.log('🔑 Derived PDAs:', {
        baseTokenMint: baseTokenMintPDA.toBase58(), // PDA (contains "cook" in address via seeds)
        listing: listingPDA.toBase58(), // PDA
        launchData: launchDataPDA.toBase58(), // PDA
        quoteTokenMint: 'WSOL (So11111111111111111111111111111111111111112)', // Using WSOL
      });
      console.log('✅ All addresses are PDAs - no keypair generation needed');

      // Create metadata JSON and upload to IPFS (needed for backend token creation)
      console.log('📦 Creating token metadata JSON...');
      const imageUrl = formData.image || '';
      const metadataJson = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description || `${formData.name} - Launched on Let's Cook`,
        image: imageUrl,
        external_url: formData.website || '',
        attributes: [],
        properties: {
          files: imageUrl ? [{
            uri: imageUrl,
            type: 'image/jpeg'
          }] : [],
          category: 'fungible',
        }
      };
      
      // Upload metadata JSON to IPFS using Pinata
      let metadataUri = '';
      let metadataCid = '';
      try {
        console.log('📤 Uploading metadata JSON to Pinata...');
        const uploadResult = await pinataService.uploadJSON(metadataJson, `${formData.name}-metadata`);
        metadataCid = uploadResult.cid;
        metadataUri = `https://gateway.pinata.cloud/ipfs/${metadataCid}`;
        console.log('✅ Metadata JSON uploaded to IPFS:', metadataUri);
        console.log('📦 Metadata CID (for transaction):', metadataCid);
      } catch (error) {
        console.warn('⚠️ Failed to upload metadata JSON, using image URL as fallback:', error);
        metadataUri = imageUrl || 'https://gateway.pinata.cloud/ipfs/'; // Fallback
        const cidMatch = metadataUri.match(/\/ipfs\/([a-zA-Z0-9]+)/);
        metadataCid = cidMatch ? cidMatch[1] : '';
      }
      
      // Backend will handle all token creation using create_2022_token (like old code)
      // No need to create mint account or initialize it in frontend
      console.log('ℹ️ Backend will create and initialize token mint using create_2022_token');
      console.log('   This handles all initialization in the correct order');

      // Create comprehensive token metadata for wallet visibility
      console.log('🏷️ Creating comprehensive token metadata...');
      try {
        const metadataResult = await LaunchpadTokenMetadataService.createTokenMetadata(
          connection,
          baseTokenMintPDA,
          {
            name: formData.name,
            symbol: formData.symbol,
            description: formData.description || `${formData.name} - Launched on Let's Cook`,
            image: imageUrl,
            website: formData.website,
            twitter: formData.twitter,
            telegram: formData.telegram,
            discord: formData.discord,
            launchType: formData.type,
            creatorWallet: publicKey.toBase58()
          }
        );
        
        if (metadataResult.success) {
          console.log('✅ Token metadata created successfully');
          console.log('📊 Metadata URI:', metadataResult.metadataUri);
          console.log('ℹ️ Token mint PDA will be created and initialized by the program');
        } else {
          console.warn('⚠️ Metadata creation failed:', metadataResult.error);
          console.log('💡 Token will still work, but may show as "Unknown Token" in wallets');
        }
      } catch (error) {
        console.warn('⚠️ Metadata creation failed, but token will still work:', error);
      }
      
      // Backend will create and initialize the token mint PDA using create_2022_token
      // No frontend transaction needed - everything is handled by the backend
      console.log('ℹ️ Token mint PDA will be created and initialized by backend using create_2022_token');

      // Transaction: Create launch accounts and instant launch
      console.log('🚀 Creating launch accounts and instant launch...');
      
      // Note: All accounts are PDAs or system accounts - no keypair generation needed
      // - baseTokenMint: PDA (derived with "cook" prefix)
      // - listing: PDA (derived from baseTokenMint)
      // - launchData: PDA (derived from page_name)
      // - team: Not needed for instant launches (backend uses user's wallet as team)
      console.log('ℹ️ All accounts are PDAs - no account creation needed in frontend');

      // Skip token creation fee for now to reduce transaction size
      // TODO: Add fee in a separate transaction if needed
      // const tokenCreationFee = 0.005 * 1e9; // 0.005 SOL in lamports
      // transaction.add(
      //   SystemProgram.transfer({
      //     fromPubkey: publicKey,
      //     toPubkey: LEDGER_WALLET,
      //     lamports: tokenCreationFee,
      //   })
      // );

      // Create the instant launch instruction
      console.log('⚡ Creating instant launch...');
      
      // Derive all required PDAs
      console.log('🔑 Deriving all required PDAs...');
      
      // Quote token mint is WSOL (wrapped SOL)
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      const quoteTokenMint = WSOL_MINT; // Use WSOL instead of creating a new mint
      
      // Derive cook_data PDA: [DATA_SEED.to_le_bytes()]
      // to_le_bytes() converts u32 to 4-byte little-endian
      const DATA_SEED = 7571427;
      const dataSeedBuffer = Buffer.alloc(4);
      dataSeedBuffer.writeUInt32LE(DATA_SEED, 0);
      const [cookDataPDA] = PublicKey.findProgramAddressSync(
        [dataSeedBuffer],
        PROGRAM_ID
      );
      
      // Derive cook_pda PDA: [SOL_SEED.to_le_bytes()]
      const SOL_SEED = 59957379;
      const solSeedBufferForCookPda = Buffer.alloc(4);
      solSeedBufferForCookPda.writeUInt32LE(SOL_SEED, 0);
      const [cookPdaPDA] = PublicKey.findProgramAddressSync(
        [solSeedBufferForCookPda],
        PROGRAM_ID
      );
      
      // Check if cook_data is initialized, if not, call Init first
      console.log('🔍 Checking if cook_data is initialized...');
      try {
        const cookDataAccount = await connection.getAccountInfo(cookDataPDA);
        if (!cookDataAccount || cookDataAccount.data.length === 0) {
          console.log('⚠️ cook_data not initialized, calling Init instruction...');
          // program_data is the same as cook_data for Init instruction
          const initInstruction = LetsCookProgram.createInitInstruction(
            publicKey,
            cookDataPDA, // program_data (same as cook_data)
            SystemProgram.programId,
            cookDataPDA, // cook_data
            cookPdaPDA   // cook_pda
          );
          const initTransaction = new Transaction();
          initTransaction.add(initInstruction);
          const { blockhash: initBlockhash } = await connection.getLatestBlockhash();
          initTransaction.recentBlockhash = initBlockhash;
          initTransaction.feePayer = publicKey;
          const signedInitTransaction = await signTransaction(initTransaction);
          const initSignature = await connection.sendRawTransaction(signedInitTransaction.serialize());
          await connection.confirmTransaction(initSignature, 'confirmed');
          console.log('✅ Init instruction completed:', initSignature);
        } else {
          console.log('✅ cook_data already initialized');
        }
      } catch (error) {
        console.warn('⚠️ Error checking cook_data, proceeding anyway:', error);
      }
      
      // Derive AMM PDA: [base_token_mint, quote_token_mint (sorted), b"CookAMM"]
      // Sort mints by their byte representation (not string)
      const baseTokenMintBytes = baseTokenMintPDA.toBytes();
      const quoteTokenMintBytes = quoteTokenMint.toBytes();
      const sortedMints = [baseTokenMintBytes, quoteTokenMintBytes].sort((a, b) => {
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
          if (a[i] !== b[i]) return a[i] - b[i];
        }
        return a.length - b.length;
      });
      const [ammPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(sortedMints[0]),
          Buffer.from(sortedMints[1]),
          Buffer.from('CookAMM')
        ],
        PROGRAM_ID
      );
      
      // Derive LP token mint PDA: [amm.key, b"LP"]
      const [lpTokenMintPDA] = PublicKey.findProgramAddressSync(
        [ammPDA.toBuffer(), Buffer.from('LP')],
        PROGRAM_ID
      );
      
      // Derive price_data PDA: [amm.key, num_price_accounts.to_le_bytes(), b"TimeSeries"]
      const numPriceAccounts = Buffer.alloc(4);
      numPriceAccounts.writeUInt32LE(0, 0);
      const [priceDataPDA] = PublicKey.findProgramAddressSync(
        [ammPDA.toBuffer(), numPriceAccounts, Buffer.from('TimeSeries')],
        PROGRAM_ID
      );
      
      // Derive user_data PDA: [user.key, b"User"]
      const [userDataPDA] = PublicKey.findProgramAddressSync(
        [publicKey.toBuffer(), Buffer.from('User')],
        PROGRAM_ID
      );
      
      // Generate keypair for amm_quote (still a regular account)
      const { Keypair } = await import('@solana/web3.js');
      const ammQuoteKeypair = Keypair.generate();
      
      // CRITICAL: Derive amm_base as a PDA (derived from AMM account)
      // Seeds: [amm.key, b"amm_base"]
      // This ensures it's deterministic and always has the correct authority
      const [ammBasePDA] = PublicKey.findProgramAddressSync(
        [ammPDA.toBuffer(), Buffer.from('amm_base')],
        PROGRAM_ID
      );
      
      console.log('✅ Derived amm_base as PDA (deterministic, correct authority):', {
        ammBase: ammBasePDA.toBase58(),
        seeds: ['amm.key', 'amm_base'],
      });
      
      console.log('✅ All PDAs/keypairs derived:', {
        cookData: cookDataPDA.toBase58(),
        cookPda: cookPdaPDA.toBase58(),
        amm: ammPDA.toBase58(),
        lpTokenMint: lpTokenMintPDA.toBase58(),
        priceData: priceDataPDA.toBase58(),
        userData: userDataPDA.toBase58(),
        ammQuote: ammQuoteKeypair.publicKey.toBase58(), // Still a keypair
        ammBase: ammBasePDA.toBase58(), // Now a PDA!
      });
      
      // amm_quote is still a regular account (keypair)
      // amm_base is now a PDA (derived from AMM account) - ensures correct authority
      console.log('ℹ️ amm_quote will be created by backend as regular account');
      console.log('ℹ️ amm_base will be created by backend as PDA (derived from AMM account)');
      
      // For instant launches, price is determined by bonding curve (not manually set)
      // Set ticket_price to 0 or minimal value - actual price comes from bonding curve formula
      // Price = f(supply, liquidity) where f is the bonding curve equation
      const { bondingCurveService } = await import('@/lib/bondingCurveService');
      const { convertToRealSupply } = await import('@/lib/supplyConverter');
      
      // Convert virtual supply to real supply for bonding curve calculations
      const virtualSupply = Number(formData.totalSupply) || 1000000000;
      const decimals = Number(formData.decimals) || 6;
      const supplyConversion = convertToRealSupply(virtualSupply, decimals);
      console.log('📊 Supply conversion result:', {
        virtual_supply: supplyConversion.virtualSupply,
        real_supply: supplyConversion.realSupply,
        scale_factor: supplyConversion.scaleFactor,
        was_scaled: supplyConversion.wasScaled,
      });
      
      const bondingCurveConfig = {
        realSupply: supplyConversion.realSupply, // Use real supply for calculations
        virtualSupply: supplyConversion.virtualSupply, // Store virtual for display
        curveType: 'linear' as const,
        // basePrice will be calculated automatically based on supply (higher supply = lower initial price)
      };
      const initialPrice = bondingCurveService.calculateInitialPrice(bondingCurveConfig);
      
      const createLaunchArgs = {
        name: formData.name.substring(0, 16), // Limit to 16 chars
        symbol: formData.symbol.substring(0, 6), // Limit to 6 chars
        uri: metadataCid ? `ipfs://${metadataCid}` : (extractIPFSHash(metadataUri) ? `ipfs://${extractIPFSHash(metadataUri)}` : ''), // Use ipfs:// protocol with CID to reduce size (saves ~30 bytes vs full URL)
        icon: formData.image ? extractIPFSHash(formData.image) : '', // IPFS hash only
        banner: formData.banner ? extractIPFSHash(formData.banner) : '', // Banner IPFS hash
        total_supply: (() => {
          // Convert to BigInt first to preserve precision, then to Number for serialization
          // JavaScript Number can safely represent integers up to 2^53 - 1 (9,007,199,254,740,991)
          // For 100B (100,000,000,000), this is well within safe range
          const supply = formData.totalSupply;
          if (typeof supply === 'string') {
            const parsed = parseFloat(supply);
            if (isNaN(parsed) || parsed <= 0) {
              console.error('❌ Invalid total supply:', supply);
              return 0;
            }
            // Validate it's a safe integer
            if (parsed > Number.MAX_SAFE_INTEGER) {
              console.error('❌ Total supply exceeds safe integer range:', parsed);
              return 0;
            }
            console.log('✅ Total supply (string -> number):', parsed, 'Original:', supply);
            return Math.floor(parsed); // Ensure it's an integer
          }
          const numSupply = Number(supply) || 0;
          console.log('✅ Total supply (number):', numSupply, 'Type:', typeof supply);
          if (numSupply > Number.MAX_SAFE_INTEGER) {
            console.error('❌ Total supply exceeds safe integer range:', numSupply);
            return 0;
          }
          return Math.floor(numSupply); // Ensure it's an integer
        })(),
        decimals: Number(formData.decimals) || 6,
        // For instant launches: ticket_price set to 0 or minimal - price determined by bonding curve
        // The bonding curve formula P(x) = a*x + b will determine actual price based on supply/demand
        ticket_price: 0, // Set to 0 for instant launches (bonding curve determines price)
        page_name: formData.name.toLowerCase().replace(/\s+/g, '-').substring(0, 10), // Limit to 10 chars
        transfer_fee: 0,
        max_transfer_fee: 0,
        extensions: 0,
        amm_provider: formData.dexProvider === 'cook' ? 0 : 1,
        launch_type: 1, // Instant launch
        whitelist_tokens: 0,
        whitelist_end: 0,
        // Description and socials are now stored in Supabase, not on-chain (reduces transaction size)
        description: '', // Empty - stored in Supabase instead
        website: '', // Empty - stored in Supabase instead
        twitter: '', // Empty - stored in Supabase instead
        telegram: '', // Empty - stored in Supabase instead
        discord: '', // Empty - stored in Supabase instead
      };

      // Base token is Token-2022, but quote token (WSOL) uses SPL Token program
      // TOKEN_PROGRAM_ID and WSOL_MINT are already declared at the top of the function
      const quoteTokenProgramId = quoteTokenMint.equals(WSOL_MINT) ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
      console.log('🔍 Token programs:');
      console.log('  Base token (launched token): Token-2022');
      console.log('  Quote token program:', quoteTokenProgramId.toBase58(), quoteTokenMint.equals(WSOL_MINT) ? '(SPL Token for WSOL)' : '(Token-2022)');
      
      // Derive cook_base_token ATA (for cook_pda to hold initial token supply)
      // Note: cook_pda is a PDA (off-curve), so we need allowOwnerOffCurve = true
      const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
      const cookBaseTokenATA = getAssociatedTokenAddressSync(
        baseTokenMintPDA,
        cookPdaPDA,
        true, // allowOwnerOffCurve = true (cook_pda is a PDA, which is off-curve)
        TOKEN_2022_PROGRAM_ID // Token-2022 program
      );
      console.log(`✅ Derived cook_base_token ATA: ${cookBaseTokenATA.toBase58()}`);
      
      // Use LetsCookProgram.createInstantLaunchInstruction for instant launches
      const createLaunchInstruction = LetsCookProgram.createInstantLaunchInstruction(
        createLaunchArgs,
        {
          user: publicKey,
          listing: listingPDA, // PDA, not keypair
          launchData: launchDataPDA, // PDA, not keypair
          baseTokenMint: baseTokenMintPDA,
          quoteTokenMint: quoteTokenMint,
          cookData: cookDataPDA,
          cookPda: cookPdaPDA,
          amm: ammPDA,
          ammQuote: ammQuoteKeypair.publicKey, // ✅ Use keypair public key
          lpTokenMint: lpTokenMintPDA,
          systemProgram: SystemProgram.programId,
          baseTokenProgram: TOKEN_2022_PROGRAM_ID, // Your launched token is Token-2022 ✅
          quoteTokenProgram: quoteTokenProgramId, // WSOL uses SPL Token, not Token-2022 ✅
          priceData: priceDataPDA,
          associatedToken: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
          cookBaseToken: cookBaseTokenATA, // ATA for cook_pda to hold initial token supply
          ammBase: ammBasePDA, // ✅ Use PDA (derived from AMM account)
          userData: userDataPDA,
        }
      );

      // Create transaction and add compute budget instruction FIRST
      const launchTransaction = new Transaction();
      
      // Add compute budget instruction FIRST to increase compute units
      // Must be added before any other instructions
      const { ComputeBudgetProgram } = await import('@solana/web3.js');
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1400000, // Increase to 1.4M units for complex operations (creating multiple accounts, tokens, etc.)
      });
      launchTransaction.add(computeBudgetIx);
      
      // Also add priority fee to ensure transaction gets processed
      const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1, // Small priority fee
      });
      launchTransaction.add(priorityFeeIx);

      launchTransaction.add(createLaunchInstruction);
      
      // Set fee payer first
      launchTransaction.feePayer = publicKey;

      // Log all account addresses for debugging
      console.log('📋 Transaction account addresses:');
      launchTransaction.instructions.forEach((ix, idx) => {
        console.log(`  Instruction ${idx}:`, ix.keys.map((key, keyIdx) => `  [${keyIdx}] ${key.pubkey.toBase58()} (signer: ${key.isSigner}, writable: ${key.isWritable})`));
      });

      // Get blockhash and sign transaction immediately to prevent expiration
      console.log('🔍 Getting fresh blockhash and signing transaction...');
      
      // Get blockhash right before signing to minimize expiration risk
      const { blockhash: freshBlockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      launchTransaction.recentBlockhash = freshBlockhash;
      
      console.log('🔍 Transaction details:', {
        blockhash: freshBlockhash.toString(),
        lastValidBlockHeight,
        feePayer: publicKey.toString(),
        instructionCount: launchTransaction.instructions.length
      });
      
      // Sign transaction with wallet and keypair for amm_quote
      // amm_base is now a PDA, so no keypair signing needed
      console.log('✍️ Signing transaction with wallet and amm_quote keypair...');
      
      // IMPORTANT: Sign keypair FIRST (before wallet), then wallet signs everything
      // This ensures all signatures are preserved when wallet signs
      // amm_base is a PDA, so it doesn't need to be signed (backend will sign with PDA seeds)
      launchTransaction.sign(ammQuoteKeypair);
      console.log('  ✅ Signed with amm_quote keypair (amm_base is a PDA, no signing needed)');
      
      // Then sign with wallet (this adds the user signature without overwriting existing signatures)
      const signedLaunchTransaction = await signTransaction(launchTransaction);
      console.log('  ✅ Signed with wallet');
      
      let launchSignature = '';
      try {
        // Send transaction immediately - skip preflight to avoid blockhash expiration in simulation
        // The transaction will still be validated on-chain
        console.log('📤 Sending transaction (skipPreflight=true to avoid blockhash expiration)...');
        launchSignature = await connection.sendRawTransaction(signedLaunchTransaction.serialize(), {
          skipPreflight: true, // Skip preflight to avoid blockhash expiration in simulation
          maxRetries: 3,
        });
        
        // Confirm transaction with longer timeout and better retry logic
        console.log('⏳ Confirming transaction (this may take up to 90 seconds)...');
        let confirmationResult: any;
        let transactionStatus: 'confirmed' | 'finalized' | 'timeout' | 'success' = 'timeout';
        
        // Strategy: Try multiple confirmation methods with increasing timeouts
        const confirmationStrategies = [
          // Strategy 1: Standard confirmation with blockhash (fastest if transaction is quick)
          async () => {
            try {
              return await Promise.race([
                connection.confirmTransaction({
                  signature: launchSignature,
                  blockhash: launchTransaction.recentBlockhash!,
                  lastValidBlockHeight: launchTransaction.lastValidBlockHeight!,
                }, 'confirmed'),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Confirmation timeout (30s)')), 30000)
                )
              ]);
            } catch (error) {
              throw error;
            }
          },
          // Strategy 2: Check signature status directly (works even if blockhash expired)
          async () => {
            // Poll for up to 60 seconds
            const maxAttempts = 20;
            const pollInterval = 3000; // 3 seconds
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
              const txStatus = await connection.getSignatureStatus(launchSignature, {
                searchTransactionHistory: true
              });
              
              if (txStatus.value) {
                if (txStatus.value.err) {
                  return { value: { err: txStatus.value.err } };
                } else if (txStatus.value.confirmationStatus) {
                  return { value: { err: null } };
                }
              }
              
              // Wait before next attempt
              if (attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));
              }
            }
            
            throw new Error('Transaction status check timeout');
          },
          // Strategy 3: Verify by checking if accounts were created (most reliable)
          async () => {
            console.log('🔍 Verifying transaction by checking account creation...');
            // Wait a bit for accounts to be created
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Check if launch account exists
            const launchAccountInfo = await connection.getAccountInfo(launchDataPDA);
            const mintAccountInfo = await connection.getAccountInfo(baseTokenMintPDA);
            
            if (launchAccountInfo && launchAccountInfo.lamports > 0 && 
                mintAccountInfo && mintAccountInfo.lamports > 0) {
              console.log('✅ Transaction succeeded (verified by account existence)');
              return { value: { err: null } };
            }
            
            throw new Error('Accounts not found - transaction may have failed');
          }
        ];
        
        // Try each strategy in order
        let lastError: any = null;
        for (let i = 0; i < confirmationStrategies.length; i++) {
          try {
            console.log(`🔄 Trying confirmation strategy ${i + 1}/${confirmationStrategies.length}...`);
            confirmationResult = await confirmationStrategies[i]();
            transactionStatus = 'success';
            console.log(`✅ Transaction confirmed using strategy ${i + 1}`);
            break;
          } catch (strategyError: any) {
            lastError = strategyError;
            console.warn(`⚠️ Strategy ${i + 1} failed:`, strategyError?.message || strategyError);
            
            // If this is the last strategy, we'll handle the error below
            if (i === confirmationStrategies.length - 1) {
              // Final fallback: Check transaction status one more time
              try {
                const finalStatus = await connection.getSignatureStatus(launchSignature, {
                  searchTransactionHistory: true
                });
                
                if (finalStatus.value) {
                  if (finalStatus.value.err) {
                    confirmationResult = { value: { err: finalStatus.value.err } };
                    transactionStatus = 'success'; // We got a result
                    break;
                  } else if (finalStatus.value.confirmationStatus) {
                    confirmationResult = { value: { err: null } };
                    transactionStatus = 'success';
                    console.log('✅ Transaction found via final status check');
                    break;
                  }
                }
              } catch (finalCheckError) {
                // Continue to error handling below
              }
              
              // If we get here, all strategies failed
              const explorerUrl = `https://solscan.io/tx/${launchSignature}?cluster=devnet`;
              throw new Error(
                `Transaction confirmation timed out after trying multiple methods. ` +
                `The transaction may still be processing. ` +
                `Please check the transaction manually: ${explorerUrl} ` +
                `Signature: ${launchSignature} ` +
                `Note: If the transaction shows as successful on Solscan, you can proceed. ` +
                `Original error: ${lastError?.message || 'Timeout'}`
              );
            }
          }
        }
        
        // Check if transaction actually succeeded
        if (confirmationResult?.value?.err) {
          console.error('❌ Transaction failed:', confirmationResult.value.err);
          
          // Fetch transaction logs for debugging
          try {
            const txDetails = await connection.getTransaction(launchSignature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            });
            
            if (txDetails?.meta?.logMessages) {
              console.error('❌ Transaction logs:', txDetails.meta.logMessages);
              
              // Filter for error logs
              const errorLogs = txDetails.meta.logMessages.filter((log: string) =>
                log.includes('Error') || log.includes('failed') || log.includes('❌') || log.includes('Program log:')
              );
              if (errorLogs.length > 0) {
                console.error('❌ Program error logs:', errorLogs);
              }
            }
            
            if (txDetails?.meta?.err) {
              console.error('❌ Transaction meta error:', txDetails.meta.err);
            }
          } catch (logError) {
            console.error('❌ Could not fetch transaction logs:', logError);
          }
          
          // Provide better error message for rent errors
          const rentErr = confirmationResult.value.err as any;
          if (rentErr.InsufficientFundsForRent) {
            const accountIndex = rentErr.InsufficientFundsForRent.account_index;
            const accountNames: { [key: number]: string } = {
              0: 'user',
              1: 'listing',
              2: 'launch_data',
              3: 'base_token_mint',
              4: 'quote_token_mint (WSOL)',
              5: 'cook_data',
              6: 'cook_pda',
              7: 'amm',
              8: 'amm_quote ⚠️ (account needing rent)',
              9: 'lp_token_mint',
              10: 'system_program',
              11: 'base_token_program',
              12: 'quote_token_program',
              13: 'price_data',
              14: 'associated_token',
              15: 'cook_base_token (ATA)',
              16: 'amm_base',
              17: 'user_data',
            };
            const accountName = accountNames[accountIndex] || `account ${accountIndex}`;
            
            // Check wallet balance
            const balance = await connection.getBalance(publicKey);
            const balanceSOL = balance / LAMPORTS_PER_SOL;
            
            throw new Error(
              `Transaction failed: Account "${accountName}" (index ${accountIndex}) doesn't have enough rent. ` +
              `Your wallet has ${balanceSOL.toFixed(6)} SOL. ` +
              `Please ensure you have at least ${MIN_BALANCE_REQUIRED.toFixed(6)} SOL in your wallet. ` +
              `The account needs rent to be created - this should be handled automatically by the program. ` +
              `If this persists, try again or contact support.`
            );
          }
          
          // Try to get more details about the error
          const errorDetails = JSON.stringify(confirmationResult.value.err);
          console.error('❌ Full error details:', errorDetails);
          
          // Check for InstructionError
          const err = confirmationResult.value.err as any;
          if (err?.InstructionError) {
            const [instructionIndex, error] = err.InstructionError;
            console.error(`❌ Failed at instruction ${instructionIndex}:`, error);
            
            // Try to get transaction logs
            try {
              const txDetails = await connection.getTransaction(launchSignature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
              });
              
              if (txDetails?.meta?.logMessages) {
                console.error('❌ Instruction error logs:', txDetails.meta.logMessages.slice(-20)); // Last 20 logs
              }
            } catch (e) {
              console.error('❌ Could not fetch logs for instruction error:', e);
            }
            
            throw new Error(
              `Transaction failed: Program failed to complete at instruction ${instructionIndex}. ` +
              `Error: ${JSON.stringify(error)}. ` +
              `Check the console for detailed logs or view the transaction: https://solscan.io/tx/${launchSignature}?cluster=devnet`
            );
          }
          
          throw new Error(
            `Transaction failed: ${errorDetails}. ` +
            `Check the console for detailed logs or view the transaction: https://solscan.io/tx/${launchSignature}?cluster=devnet`
          );
        }
        
        console.log('✅ Transaction confirmed successfully:', launchSignature);
        
        // Verify the launch account was actually created
        console.log('🔍 Verifying launch account creation...');
        try {
          const launchAccountInfo = await connection.getAccountInfo(launchDataPDA);
          if (!launchAccountInfo || launchAccountInfo.lamports === 0) {
            console.error('❌ Launch account not found after transaction:', launchDataPDA.toBase58());
            throw new Error('Launch account was not created. Transaction may have failed silently.');
          }
          
          console.log('✅ Launch account verified:', {
            address: launchDataPDA.toBase58(),
            owner: launchAccountInfo.owner.toBase58(),
            dataLength: launchAccountInfo.data.length,
            lamports: launchAccountInfo.lamports,
            executable: launchAccountInfo.executable,
          });
          
          // Verify the account has data (not just zeros)
          const hasData = launchAccountInfo.data.some((byte: number) => byte !== 0);
          if (!hasData) {
            console.warn('⚠️ Launch account exists but has no data (all zeros)');
          } else {
            console.log('✅ Launch account has data:', {
              firstBytes: Array.from(launchAccountInfo.data.slice(0, 32))
                .map((b: number) => b.toString(16).padStart(2, '0'))
                .join(' ')
            });
          }
          
          // Also verify the token mint was created
          const mintAccountInfo = await connection.getAccountInfo(baseTokenMintPDA);
          if (!mintAccountInfo || mintAccountInfo.lamports === 0) {
            console.error('❌ Token mint account not found after transaction:', baseTokenMintPDA.toBase58());
            throw new Error('Token mint account was not created. Transaction may have failed silently.');
          }
          
          console.log('✅ Token mint account verified:', {
            address: baseTokenMintPDA.toBase58(),
            owner: mintAccountInfo.owner.toBase58(),
            dataLength: mintAccountInfo.data.length,
            lamports: mintAccountInfo.lamports,
          });
          
        } catch (verifyError: any) {
          console.error('❌ Error verifying account creation:', verifyError);
          
          // Try to get transaction details for debugging
          try {
            const txDetails = await connection.getTransaction(launchSignature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            });
            
            if (txDetails?.meta?.err) {
              console.error('❌ Transaction error details:', txDetails.meta.err);
              throw new Error(`Transaction failed: ${JSON.stringify(txDetails.meta.err)}. Check console for details.`);
            }
            
            if (!txDetails) {
              console.error('❌ Could not fetch transaction details - transaction may not have been finalized');
              throw new Error('Transaction was sent but could not be verified. Please check Solana Explorer.');
            }
            
            console.log('📊 Transaction details:', {
              slot: txDetails.slot,
              blockTime: txDetails.blockTime,
              err: txDetails.meta?.err,
              computeUnitsConsumed: txDetails.meta?.computeUnitsConsumed,
              accountsCreated: txDetails.meta?.loadedAddresses?.readonly?.length || 0,
            });
            
          } catch (txError) {
            console.error('❌ Could not fetch transaction details:', txError);
          }
          
          throw verifyError;
        }
        
        console.log('✅ Instant launch created and verified successfully:', launchSignature);
        
        // Verify amm_base was created and store its address
        console.log('🔍 Verifying amm_base token account was created...');
        try {
          // Wait a bit for account to be fully initialized
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if amm_base exists on-chain
          const { tradingService } = await import('@/lib/tradingService');
          const ammBaseCheck = await tradingService.checkAmmBaseOnChain(ammPDA, baseTokenMintPDA);
          
          if (ammBaseCheck.exists && ammBaseCheck.address) {
            console.log('✅ amm_base verified on-chain:', ammBaseCheck.address);
            console.log('  Account info:', ammBaseCheck.accountInfo);
          } else {
            console.warn('⚠️ amm_base not found on-chain after launch:', ammBaseCheck.error);
            console.warn('  This may cause issues with trading. The account should have been created during launch.');
          }
        } catch (ammBaseError) {
          console.warn('⚠️ Could not verify amm_base (non-critical):', ammBaseError);
        }
        
        // Store name, symbol, image, description, socials, IPFS metadata URI, and amm_base address in Supabase
        // Name, symbol, and image are stored directly for fastest access (no IPFS fetch needed)
        try {
          const { LaunchMetadataService } = await import('@/lib/launchMetadataService');
          
            // Get amm_base address (now a PDA, deterministic)
            const ammBaseAddress = ammBasePDA.toBase58();
          
          // Calculate initial price from bonding curve (tokens_sold = 0)
          // Use real supply for calculations (already converted above)
          const { bondingCurveService } = await import('@/lib/bondingCurveService');
          const initialPrice = bondingCurveService.calculatePrice(0, {
            realSupply: supplyConversion.realSupply,
            virtualSupply: supplyConversion.virtualSupply,
            curveType: 'linear',
            decimals: decimals
          });
          
          // Get initial pool SOL balance from amm_quote (WSOL account)
          let poolSolBalance = 0;
          try {
            const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
            const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
            const ammQuoteATA = getAssociatedTokenAddressSync(
              WSOL_MINT,
              ammPDA,
              true, // allowOwnerOffCurve = true (ammPDA is a PDA)
              TOKEN_2022_PROGRAM_ID // WSOL uses Token-2022
            );
            
            const ammQuoteInfo = await connection.getAccountInfo(ammQuoteATA);
            if (ammQuoteInfo && ammQuoteInfo.data.length > 0) {
              // Parse WSOL token account balance (offset 64 for amount)
              const amount = ammQuoteInfo.data.readBigUInt64LE(64);
              poolSolBalance = Number(amount) / 1e9; // Convert to SOL
            }
          } catch (error) {
            console.warn('⚠️ Could not get initial pool SOL balance from amm_quote, defaulting to 0:', error);
            // For new launches, pool_sol_balance is 0 until first trade
          }
          
          // Derive page_name (same as backend)
          const pageName = formData.name.toLowerCase().replace(/\s+/g, '-').substring(0, 10);
          
          await LaunchMetadataService.storeMetadata({
            launch_id: launchDataPDA.toBase58(),
            token_mint: baseTokenMintPDA.toBase58(),
            metadata_uri: metadataUri || undefined, // Store IPFS metadata URI as fallback
            name: formData.name || undefined, // Store directly for fastest access
            symbol: formData.symbol || undefined, // Store directly for fastest access
            image: imageUrl || undefined, // Store directly for fastest access
            description: formData.description || undefined,
            website: formData.website || undefined,
            twitter: formData.twitter || undefined,
            telegram: formData.telegram || undefined,
            discord: formData.discord || undefined,
            amm_base_token_account: ammBaseAddress, // Store amm_base address for trading
            total_supply: supplyConversion.realSupply, // Store real supply (for backward compatibility)
            virtual_supply: supplyConversion.virtualSupply, // Store virtual supply (what user entered)
            real_supply: supplyConversion.realSupply, // Store real supply (what was actually minted)
            scale_factor: supplyConversion.scaleFactor, // Store scale factor
            creator_wallet_address: publicKey.toBase58(), // Store creator wallet address
            decimals: decimals, // Store decimals
            tokens_sold: 0, // Initialize to 0 for new launches
            page_name: pageName, // Store page_name for routing
            current_price: initialPrice, // Store initial price from bonding curve
            pool_sol_balance: poolSolBalance, // Store initial pool SOL balance
          });
          console.log('✅ Launch metadata stored in Supabase (including amm_base address)');
        } catch (metadataError) {
          console.warn('⚠️ Failed to store metadata in Supabase (non-critical):', metadataError);
          // Don't throw - metadata storage failure shouldn't block launch creation
        }
        
        // Verify metadata after launch is created (backend initializes it)
        // Wait a bit for the backend to fully initialize the mint
        console.log('⏳ Waiting for backend to initialize token metadata...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        try {
          const { SPLTokenMetadataService } = await import('@/lib/splTokenMetadataService');
          const metadataResult = await SPLTokenMetadataService.verifyTokenMetadata(
            connection,
            baseTokenMintPDA
          );
          
          if (metadataResult.hasMetadata) {
            console.log('✅ Token metadata verified:', {
              name: metadataResult.name,
              symbol: metadataResult.symbol,
              uri: metadataResult.uri
            });
            console.log('🎯 Token will display correctly in wallets!');
          } else {
            console.log('ℹ️ Metadata not yet available - backend may still be initializing');
            console.log('   This is normal and the token will work correctly');
          }
        } catch (metadataError) {
          console.log('ℹ️ Could not verify metadata yet (this is normal during creation):', metadataError);
        }
      } catch (error: any) {
        console.error('❌ Transaction error:', error);
        
        // Check for rent-related errors
        if (error?.message) {
          if (error.message.includes('insufficient funds for rent')) {
            throw new Error(
              `Transaction failed: An account has insufficient funds for rent. ` +
              `This usually means the wallet doesn't have enough SOL. ` +
              `Please ensure you have at least ${MIN_BALANCE_REQUIRED.toFixed(4)} SOL in your wallet. ` +
              `Error details: ${error.message}`
            );
          }
          
          if (error.message.includes('insufficient funds')) {
            throw new Error(
              `Transaction failed: Insufficient funds. ` +
              `Please ensure you have enough SOL (at least ${MIN_BALANCE_REQUIRED.toFixed(4)} SOL recommended). ` +
              `Current balance: ${balanceSOL.toFixed(4)} SOL. ` +
              `Error: ${error.message}`
            );
          }
          
          // Check for transaction errors that contain rent info
          if (error.logs) {
            const rentError = error.logs.find((log: string) => 
              log.includes('insufficient funds for rent') || 
              log.includes('rent-exempt')
            );
            
            if (rentError) {
              throw new Error(
                `Transaction failed: Account rent issue detected. ` +
                `${rentError}. ` +
                `Please ensure you have at least ${MIN_BALANCE_REQUIRED.toFixed(4)} SOL in your wallet.`
              );
            }
          }
        }
        
        if (error instanceof Error && error.message.includes('already been processed')) {
          console.log('⚠️ Launch transaction already processed, continuing...');
          // Continue with the process - the launch might already exist
          launchSignature = 'already-processed'; // Placeholder for already processed
        } else if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('expired'))) {
          // If confirmation timed out, check if accounts were actually created
          console.log('⚠️ Confirmation timed out, but checking if transaction actually succeeded...');
          
          try {
            // Wait a bit for accounts to be created
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Check if launch account exists
            const launchAccountInfo = await connection.getAccountInfo(launchDataPDA);
            const mintAccountInfo = await connection.getAccountInfo(baseTokenMintPDA);
            
            if (launchAccountInfo && launchAccountInfo.lamports > 0 && 
                mintAccountInfo && mintAccountInfo.lamports > 0) {
              console.log('✅ Transaction actually succeeded! Accounts were created despite timeout.');
              console.log('   Proceeding with launch setup...');
              // Transaction succeeded, continue with the process
              // launchSignature is already set from sendRawTransaction
            } else {
              // Accounts don't exist, transaction likely failed
              throw error;
            }
          } catch (verifyError) {
            // Verification failed, throw original error
            throw error;
          }
        } else {
          throw error;
        }
      }
      
      // Now handle additional transactions in separate transactions to avoid size limits
      
      // 1. Send token creation fee
      console.log('💰 Sending token creation fee...');
      const tokenCreationFee = 0.005 * 1e9; // 0.005 SOL in lamports
      
      // Add a small delay to ensure the previous transaction is fully processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const feeTransaction = new Transaction();
      feeTransaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: LEDGER_WALLET,
          lamports: tokenCreationFee,
        })
      );
      
      // Get a fresh blockhash for the fee transaction
      const { blockhash: feeBlockhash } = await connection.getLatestBlockhash();
      feeTransaction.recentBlockhash = feeBlockhash;
      feeTransaction.feePayer = publicKey;
      
      try {
        const feeSignature = await signTransaction(feeTransaction);
        const feeTxSignature = await connection.sendRawTransaction(feeSignature.serialize());
        await connection.confirmTransaction(feeTxSignature, 'confirmed');
        console.log('✅ Token creation fee sent:', feeTxSignature);
      } catch (feeError) {
        console.warn('⚠️ Fee transaction failed, but launch was created successfully:', feeError);
        // Don't throw error here - the main launch was successful
      }
      
      // Liquidity addition and creator purchase have been REMOVED
      // For pump.fun style launches:
      // - First buyer seeds the bonding curve pool automatically
      // - Pool graduates to Raydium when 30 SOL is collected
      // - No initial liquidity or creator purchase needed
      
      // Note: The old liquidity addition code has been removed
      // Old code would have added liquidity here, but now it's handled by the bonding curve
      console.log('✅ Launch created - bonding curve will be seeded by first buyer');
      
      // Note: Initial liquidity and creator purchase have been removed
      // The bonding curve will be seeded automatically by the first buyer
      // Pool graduates to Raydium when 30 SOL is collected in the bonding curve
      
      // Set the created launch ID and token mint
      // Use launchDataPDA as the launch ID since that's how launches are stored and retrieved
      setCreatedLaunchId(launchDataPDA.toBase58());
      setCreatedTokenMint(baseTokenMintPDA.toBase58());
      setTxSignature(launchSignature);

      toast({
        title: "Launch Created Successfully!",
        description: `Your token has been launched! First buyer will seed the bonding curve, and it will graduate to Raydium at 30 SOL.`,
      });

      // Show token visibility card
      setShowTokenVisibility(true);

    } catch (error) {
      console.error('Launch creation error:', error);
      toast({
        title: "Launch Failed",
        description: error instanceof Error ? error.message : "Failed to create launch. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      dexProvider: 'cook',
      name: '',
      symbol: '',
      description: '',
      totalSupply: 1000000000, // 1 billion (recommended default)
      decimals: 6,
      // initialPrice removed - price determined by bonding curve
      liquidityAmount: 0,
      liquidityTokenAmount: 0,
      creatorPurchaseAmount: 0,
      lockLiquidity: false,
      lockDuration: 30,
      lockAmount: undefined,
      website: '',
      twitter: '',
      telegram: '',
      discord: '',
      image: '',
      banner: '',
      type: 'instant'
    });
    setErrors({});
    setCurrentStep(0);
    setCreatedLaunchId(null);
    setCreatedTokenMint(null);
    setTxSignature(null);
    setShowTokenVisibility(false);
  };

  // Success screen
  if (createdLaunchId && txSignature) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
        <Header 
          title="Launch Successful!"
          subtitle="Your token has been deployed"
          showNavigation={true}
        />
        <div className="py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-8 text-center"
            >
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-4">Launch Successful!</h2>
              <p className="text-slate-400 mb-6">
                Your token <span className="text-yellow-400 font-semibold">{formData.symbol}</span> has been successfully launched on Solana.
              </p>

              <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Token Name:</span>
                    <p className="text-white font-semibold">{formData.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Symbol:</span>
                    <p className="text-white font-semibold">{formData.symbol}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Supply:</span>
                    <p className="text-white font-semibold">{formData.totalSupply.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Price Model:</span>
                    <p className="text-white font-semibold">Bonding Curve (Fair Launch)</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-4 mb-6">
                <a
                  href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View on Explorer
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(txSignature);
                    toast({
                      title: "Copied!",
                      description: "Transaction signature copied to clipboard.",
                    });
                  }}
                  className="flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Copy Signature
                </button>
              </div>

              {/* Creator token purchase has been removed - use bonding curve directly */}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={resetForm}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Create Another
                </button>
                <button
                  onClick={() => window.location.href = '/launches'}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  View All Launches
                </button>
              </div>
              
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-300 text-sm mb-2">
                  <Info className="w-4 h-4 inline mr-1" />
                  Your launch will appear on the launches page shortly
                </p>
                <p className="text-slate-400 text-xs">
                  It may take a few moments for the blockchain data to be processed and displayed
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <Header 
        title="Create Instant Launch"
        subtitle="Launch your token immediately on Solana"
        showNavigation={true}
      />
      <div className="py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Token Visibility Card */}
        {showTokenVisibility && createdTokenMint && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <TokenVisibilityCard
              tokenMint={createdTokenMint}
              metadata={{
                name: formData.name,
                symbol: formData.symbol,
                image: formData.image || '',
                decimals: formData.decimals || 6
              }}
            />
          </motion.div>
        )}

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">
              Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].charAt(0).toUpperCase() + STEPS[currentStep].slice(1)}
            </h2>
            <span className="text-slate-400 text-sm">
              {Math.round(((currentStep + 1) / STEPS.length) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Steps */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-8"
          >
            {/* Step 1: Basic Info */}
            {STEPS[currentStep] === 'basic' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Token Information</h2>
                  <p className="text-slate-400">Enter your token's basic details</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Token Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateFormData('name', e.target.value)}
                      placeholder="e.g., My Awesome Token"
                      className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                        errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                      }`}
                    />
                    {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Token Symbol *
                    </label>
                    <input
                      type="text"
                      value={formData.symbol}
                      onChange={(e) => updateFormData('symbol', e.target.value.toUpperCase())}
                      placeholder="e.g., MAT"
                      maxLength={10}
                      className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                        errors.symbol ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                      }`}
                    />
                    {errors.symbol && <p className="text-red-400 text-xs mt-1">{errors.symbol}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Launch Type *
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="launchType"
                        value="instant"
                        checked={formData.type === 'instant'}
                        onChange={(e) => updateFormData('type', e.target.value as 'instant')}
                        className="mr-2 text-yellow-500"
                      />
                      <span className="text-slate-300">⚡ Instant Launch</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="launchType"
                        value="raffle"
                        checked={formData.type === 'raffle'}
                        onChange={(e) => updateFormData('type', e.target.value as 'raffle')}
                        className="mr-2 text-yellow-500"
                      />
                      <span className="text-slate-300">🎫 Raffle Launch</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                      placeholder="Describe your token and its purpose..."
                    rows={4}
                    className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 resize-none ${
                      errors.description ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                    }`}
                  />
                  {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description}</p>}
                </div>

                {/* Image Upload Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                      Token Image <span className="text-red-400">*</span>
                    </h3>
                    {errors.image && (
                      <p className="text-red-400 text-xs mt-1">{errors.image}</p>
                    )}
                    <div className="flex items-center space-x-2">
                      {pinataService.isPinataConfigured() ? (
                        <div className="flex items-center space-x-1 text-green-400">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-xs">IPFS Ready</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 text-yellow-400">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <span className="text-xs">Local Mode</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300 text-center">
                        Upload Token Image <span className="text-red-400">*</span> (Recommended: Square, 512x512px)
                      </label>
                      <div className="relative">
                        {formData.image ? (
                          <div className="relative">
                            <img 
                              src={formData.image} 
                              alt="Token Image" 
                              className={`w-32 h-32 rounded-lg object-cover mx-auto border-2 ${
                                errors.image ? 'border-red-500' : 'border-yellow-500'
                              }`}
                              onLoad={() => {
                                console.log('✅ Image loaded successfully:', formData.image);
                              }}
                              onError={(e) => {
                                console.error('❌ Image failed to load:', formData.image);
                                
                                // Extract CID from current URL (supports modern CIDs with hyphens/underscores)
                                const cidMatch = formData.image.match(/\/ipfs\/([^/?#]+)/);
                                if (cidMatch && cidMatch[1]) {
                                  const cid = cidMatch[1];
                                  console.log('🔍 Extracted CID:', cid);
                                  
                                  // Try alternative gateways in order
                                  const gateways = [
                                    `https://gateway.pinata.cloud/ipfs/${cid}`,
                                    `https://ipfs.io/ipfs/${cid}`,
                                    `https://cloudflare-ipfs.com/ipfs/${cid}`,
                                    `https://dweb.link/ipfs/${cid}`,
                                  ];
                                  
                                  // Find current gateway index
                                  let currentGatewayIndex = -1;
                                  if (formData.image.includes('gateway.pinata.cloud')) {
                                    currentGatewayIndex = 0;
                                  } else if (formData.image.includes('ipfs.io')) {
                                    currentGatewayIndex = 1;
                                  } else if (formData.image.includes('cloudflare-ipfs.com')) {
                                    currentGatewayIndex = 2;
                                  } else if (formData.image.includes('dweb.link')) {
                                    currentGatewayIndex = 3;
                                  }
                                  
                                  // Try next gateway
                                  const nextGatewayIndex = (currentGatewayIndex + 1) % gateways.length;
                                  const alternativeUrl = gateways[nextGatewayIndex];
                                  
                                  console.log('🔄 Trying alternative gateway:', alternativeUrl);
                                  (e.target as HTMLImageElement).src = alternativeUrl;
                                } else {
                                  console.error('❌ Could not extract CID from URL:', formData.image);
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                // Allow replacing image by clicking to upload new one
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) handleImageUpload(file);
                                };
                                input.click();
                              }}
                              className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1 hover:bg-blue-600"
                              title="Replace image"
                            >
                              <Upload className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className={`w-32 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center mx-auto transition-colors cursor-pointer ${
                            errors.image 
                              ? 'border-red-500 bg-red-500/10' 
                              : 'border-slate-600 hover:border-yellow-500'
                          }`}>
                            <Image className={`w-8 h-8 mb-2 ${errors.image ? 'text-red-400' : 'text-slate-400'}`} />
                            <span className={`text-xs ${errors.image ? 'text-red-400' : 'text-slate-400'}`}>
                              {errors.image ? 'Image required' : 'Click to upload'}
                            </span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-400 text-center">
                    {pinataService.isPinataConfigured() 
                      ? "Upload a square image for your token. It will be permanently stored on IPFS."
                      : "Upload a square image for your token. Configure Pinata for IPFS storage."
                    }
                  </p>
                </div>

                {/* Banner Upload Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Banner Image (Optional)</h3>
                    <div className="flex items-center space-x-2">
                      {pinataService.isPinataConfigured() ? (
                        <div className="flex items-center space-x-1 text-green-400">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-xs">IPFS Ready</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 text-yellow-400">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <span className="text-xs">Local Mode</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300 text-center">
                        Upload Banner Image (Recommended: 1200x400px)
                      </label>
                      <div className="relative">
                        {formData.banner ? (
                          <div className="relative">
                            <img 
                              src={formData.banner} 
                              alt="Banner Image" 
                              className="w-64 h-20 rounded-lg object-cover mx-auto border-2 border-yellow-500"
                              onLoad={() => {
                                console.log('✅ Banner loaded successfully:', formData.banner);
                              }}
                              onError={(e) => {
                                console.error('❌ Banner failed to load:', formData.banner);
                                
                                // Extract CID from current URL (supports modern CIDs with hyphens/underscores)
                                const cidMatch = formData.banner.match(/\/ipfs\/([^/?#]+)/);
                                if (cidMatch && cidMatch[1]) {
                                  const cid = cidMatch[1];
                                  console.log('🔍 Extracted CID:', cid);
                                  
                                  // Try alternative gateways in order
                                  const gateways = [
                                    `https://gateway.pinata.cloud/ipfs/${cid}`,
                                    `https://ipfs.io/ipfs/${cid}`,
                                    `https://cloudflare-ipfs.com/ipfs/${cid}`,
                                    `https://dweb.link/ipfs/${cid}`,
                                  ];
                                  
                                  // Find current gateway index
                                  let currentGatewayIndex = -1;
                                  if (formData.banner.includes('gateway.pinata.cloud')) {
                                    currentGatewayIndex = 0;
                                  } else if (formData.banner.includes('ipfs.io')) {
                                    currentGatewayIndex = 1;
                                  } else if (formData.banner.includes('cloudflare-ipfs.com')) {
                                    currentGatewayIndex = 2;
                                  } else if (formData.banner.includes('dweb.link')) {
                                    currentGatewayIndex = 3;
                                  }
                                  
                                  // Try next gateway
                                  const nextGatewayIndex = (currentGatewayIndex + 1) % gateways.length;
                                  const alternativeUrl = gateways[nextGatewayIndex];
                                  
                                  console.log('🔄 Trying alternative gateway:', alternativeUrl);
                                  (e.target as HTMLImageElement).src = alternativeUrl;
                                } else {
                                  console.error('❌ Could not extract CID from URL:', formData.banner);
                                }
                              }}
                            />
                            <button
                              onClick={() => updateFormData('banner', '')}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-64 h-20 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center mx-auto hover:border-yellow-500 transition-colors cursor-pointer">
                            <Image className="w-6 h-6 text-slate-400 mb-1" />
                            <span className="text-xs text-slate-400">Click to upload</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleBannerUpload(file);
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-400 text-center">
                    {pinataService.isPinataConfigured() 
                      ? "Upload a banner image for your token page. It will be permanently stored on IPFS."
                      : "Upload a banner image for your token page. Configure Pinata for IPFS storage."
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: DEX Selection */}
            {STEPS[currentStep] === 'dex' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">DEX Provider</h2>
                  <p className="text-slate-400">Choose where your token will be traded</p>
                </div>

                <DEXSelector
                  selectedDEX={formData.dexProvider}
                  onSelectDEX={(dex: string) => updateFormData('dexProvider', dex)}
                />
              </div>
            )}

            {/* Step 3: Configuration */}
            {STEPS[currentStep] === 'config' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Launch Configuration</h2>
                  <p className="text-slate-400">Configure your instant token launch parameters</p>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <div className="flex items-start">
                    <Info className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-200">
                      <p className="font-medium mb-1">Instant Launch Benefits:</p>
                      <ul className="space-y-1 text-yellow-200/80">
                        <li>• Immediate trading on AMM</li>
                        <li>• Real-time price discovery</li>
                        <li>• Liquidity provided automatically</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Fair Launch Info - Price determined by bonding curve */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <Info className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-200">
                      <p className="font-medium mb-1">Fair Launch - No Manual Price Setting</p>
                      <p className="text-blue-200/80">
                        In a fair-launch bonding curve model, the token price is automatically determined by the bonding curve formula based on supply and demand. 
                        You cannot manually set a price - this ensures fairness where everyone starts from the same mathematical baseline.
                      </p>
                      <p className="text-blue-200/80 mt-2">
                        <strong>Price Formula:</strong> P(x) = a · x + b, where x is tokens sold, a is the slope, and b is the base price.
                        Price increases as more tokens are bought and decreases when sold.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Total Supply *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.totalSupply === 0 ? '' : formData.totalSupply}
                      onChange={(e) => handleNumberChange('totalSupply', e.target.value)}
                      className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                        errors.totalSupply ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                      }`}
                      placeholder="1000000000"
                    />
                    {errors.totalSupply && (
                      <p className={`text-xs mt-1 ${errors.totalSupply.includes('⚠️') ? 'text-yellow-400' : 'text-red-400'}`}>
                        {errors.totalSupply}
                      </p>
                    )}
                    {!errors.totalSupply && formData.totalSupply > 0 && (
                      <p className="text-blue-400 text-xs mt-1">
                        💡 You can enter any supply amount. The system will automatically scale it if needed to prevent overflow.
                      </p>
                    )}
                    {formData.totalSupply > 10_000_000_000 && !errors.totalSupply && (
                      <p className="text-yellow-400 text-xs mt-1">
                        ⚠️ Large supply detected. For best results, consider using a supply under 10 billion tokens.
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      Total token supply (recommended: 1-10 billion). Price will be determined by bonding curve formula. Higher supply = lower initial price per token.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Decimals *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="9"
                      value={formData.decimals || ''}
                      onChange={(e) => handleNumberChange('decimals', e.target.value)}
                      className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                        errors.decimals ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                      }`}
                    />
                    {errors.decimals && <p className="text-red-400 text-xs mt-1">{errors.decimals}</p>}
                    {!errors.decimals && (
                      <p className="text-xs text-slate-400 mt-1">
                        Default is <span className="text-yellow-300 font-semibold">6 decimals</span> (pump style). You can increase or decrease if your token needs different precision.
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-start">
                      <Zap className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-200">
                        <p className="font-medium mb-1">Bonding Curve Launch (pump.fun style)</p>
                        <p className="text-blue-200/80 mb-2">
                          • First buyer automatically seeds the bonding curve pool
                        </p>
                        <p className="text-blue-200/80 mb-2">
                          • Price increases as more tokens are bought
                        </p>
                        <p className="text-blue-200/80">
                          • Automatically graduates to Raydium when 30 SOL is collected
                        </p>
                      </div>
                    </div>
                  </div>
              </div>
            )}

            {/* Step 4: Social */}
            {STEPS[currentStep] === 'social' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Social Links</h2>
                  <p className="text-slate-400">Add your social media (optional but recommended)</p>
                </div>

                <div className="space-y-4">
                  {[
                    { key: 'website' as keyof FormData, icon: Globe, label: 'Website', placeholder: 'https://yourproject.com' },
                    { key: 'twitter' as keyof FormData, icon: Twitter, label: 'Twitter', placeholder: 'https://twitter.com/yourproject' },
                    { key: 'telegram' as keyof FormData, icon: MessageCircle, label: 'Telegram', placeholder: 'https://t.me/yourproject' },
                    { key: 'discord' as keyof FormData, icon: Hash, label: 'Discord', placeholder: 'https://discord.gg/yourproject' }
                  ].map(({ key, icon: Icon, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                        <Icon className="w-4 h-4 mr-2" />
                        {label}
                      </label>
                      <input
                        type="url"
                        value={formData[key] as string}
                        onChange={(e) => updateFormData(key, e.target.value)}
                        placeholder={placeholder}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {STEPS[currentStep] === 'review' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Review Your Launch</h2>
                  <p className="text-slate-400">Double-check everything before submitting</p>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-700">
                    <span className="text-slate-400">Launch Type</span>
                    <div className="flex items-center px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                      <Zap className="w-4 h-4 mr-1" />
                      <span className="font-medium">Instant</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-4 border-b border-slate-700">
                    <span className="text-slate-400">DEX Provider</span>
                    <div className={`flex items-center px-3 py-1 rounded-full ${
                      formData.dexProvider === 'cook' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {formData.dexProvider === 'cook' ? <Zap className="w-4 h-4 mr-1" /> : <TrendingUp className="w-4 h-4 mr-1" />}
                      <span className="font-medium capitalize">{formData.dexProvider === 'cook' ? 'Cook DEX' : 'Raydium'}</span>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-400 text-sm">Token Name</span>
                      <p className="text-white font-medium">{formData.name || 'Not set'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Symbol</span>
                      <p className="text-white font-medium">{formData.symbol || 'Not set'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Total Supply</span>
                      <p className="text-white font-medium">{formData.totalSupply.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Decimals</span>
                      <p className="text-white font-medium">{formData.decimals}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <span className="text-slate-400 text-sm">Description</span>
                    <p className="text-white mt-1">{formData.description || 'Not set'}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-700 grid md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-400 text-sm">Initial Price</span>
                      <p className="text-white font-medium">Bonding Curve</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Bonding Curve</span>
                      <p className="text-white font-medium">
                        First buyer seeds pool, graduates at 30 SOL
                      </p>
                    </div>
                  </div>

                  {(formData.website || formData.twitter || formData.telegram || formData.discord) && (
                    <div className="pt-4 border-t border-slate-700">
                      <span className="text-slate-400 text-sm block mb-2">Social Links</span>
                      <div className="flex flex-wrap gap-2">
                        {formData.website && (
                          <a href={formData.website} target="_blank" rel="noopener noreferrer" 
                             className="flex items-center px-3 py-1 bg-slate-700 rounded-full text-sm text-slate-300 hover:text-white">
                            <Globe className="w-3 h-3 mr-1" /> Website
                          </a>
                        )}
                        {formData.twitter && (
                          <a href={formData.twitter} target="_blank" rel="noopener noreferrer"
                             className="flex items-center px-3 py-1 bg-slate-700 rounded-full text-sm text-slate-300 hover:text-white">
                            <Twitter className="w-3 h-3 mr-1" /> Twitter
                          </a>
                        )}
                        {formData.telegram && (
                          <a href={formData.telegram} target="_blank" rel="noopener noreferrer"
                             className="flex items-center px-3 py-1 bg-slate-700 rounded-full text-sm text-slate-300 hover:text-white">
                            <MessageCircle className="w-3 h-3 mr-1" /> Telegram
                          </a>
                        )}
                        {formData.discord && (
                          <a href={formData.discord} target="_blank" rel="noopener noreferrer"
                             className="flex items-center px-3 py-1 bg-slate-700 rounded-full text-sm text-slate-300 hover:text-white">
                            <Hash className="w-3 h-3 mr-1" /> Discord
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <div className="flex items-start">
                    <Info className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-200">
                      <p className="font-medium mb-1">Ready to Launch?</p>
                      <p className="text-yellow-200/80">
                        Once you submit, your transaction will be processed on the Solana blockchain. 
                        Make sure all information is correct before proceeding.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <button
            onClick={handleBack}
            disabled={currentStep === 0 || isSubmitting}
            className="flex items-center px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="flex items-center px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center px-8 py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 text-black rounded-lg hover:from-yellow-700 hover:to-yellow-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                >
                  {isSubmitting ? (
                    <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Creating Launch...
                    </>
                  ) : (
                    <>
                  <Rocket className="w-5 h-5 mr-2" />
                  Launch Token
                    </>
                  )}
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
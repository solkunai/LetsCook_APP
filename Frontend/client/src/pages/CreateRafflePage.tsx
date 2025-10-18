import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Rocket, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Ticket,
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
  Gift,
  Target,
  Award
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, Keypair } from '@solana/web3.js';
import { useLocation } from 'wouter';
import { pinataService, uploadImageToIPFS } from '@/lib/pinataService';
import { ipfsMetadataService } from '@/lib/ipfsMetadataService';
import { toast } from '@/hooks/use-toast';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import * as borsh from 'borsh';
import { Buffer } from 'buffer';
import Header from '../components/Header';
import DEXSelector from '../components/DEXSelector';
import { realLaunchService } from '../lib/realLaunchService';
import { PROGRAM_ID, LetsCookProgram, LaunchInstruction } from '../lib/nativeProgram';
import { INSTRUCTION_DISCRIMINATORS } from '../lib/apiServices';

const STEPS = ['basic', 'dex', 'config', 'social', 'review'];

// Placeholder wallet address for fees - replace with actual fee wallet
const LEDGER_WALLET = new PublicKey('8fvPxVrPp1p3QGwjiFQVYg5xpBTVrWrarrUxQryftUZV');

export default function CreateRafflePage() {
  const { connected, publicKey, wallet, sendTransaction } = useWallet();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [createdLaunchId, setCreatedLaunchId] = useState<string | null>(null);
  const [createdTokenMint, setCreatedTokenMint] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [durationMode, setDurationMode] = useState<'hours' | 'date'>('hours');

  // Connection to devnet with better timeout settings
  const connection = new Connection('https://api.devnet.solana.com', {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
    disableRetryOnRateLimit: false,
    httpHeaders: {
      'Content-Type': 'application/json',
    },
  });

  // Define the form data type for raffle launches
  interface RaffleFormData {
    dexProvider: string;
    name: string;
    symbol: string;
    description: string;
    totalSupply: number;
    decimals: number;
    ticketPrice: number;
    maxTickets: number;
    raffleDuration: number;
    winnerCount: number;
    website: string;
    twitter: string;
    telegram: string;
    discord: string;
    image: string;
    banner: string;
    liquidityTokenAmount?: number;
    winnersAllocation?: number;
    teamAllocation?: number;
    marketingAllocation?: number;
    liquidityAllocation?: number;
    treasuryAllocation?: number;
    type: 'instant' | 'raffle'; // Launch type
  }
  
  const [formData, setFormData] = useState<RaffleFormData>({
    dexProvider: 'cook',
    name: '',
    symbol: '',
    description: '',
    totalSupply: 1000000,
    decimals: 9,
    ticketPrice: 0.1,
    maxTickets: 1000,
    raffleDuration: 24,
    winnerCount: 100,
    website: '',
    twitter: '',
    telegram: '',
    discord: '',
    image: '',
    banner: '',
    liquidityTokenAmount: 0,
    winnersAllocation: 50,
    teamAllocation: 20,
    marketingAllocation: 15,
    liquidityAllocation: 10,
    treasuryAllocation: 5,
    type: 'raffle' // Default to raffle launch
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Extract IPFS hash from URL to reduce transaction size
  const extractIPFSHash = (ipfsUrl: string): string => {
    if (!ipfsUrl) return '';
    
    // Extract hash from various IPFS URL formats
    const patterns = [
      /\/ipfs\/([a-zA-Z0-9]+)/,  // /ipfs/hash
      /ipfs\.io\/ipfs\/([a-zA-Z0-9]+)/,  // ipfs.io/ipfs/hash
      /gateway\.pinata\.cloud\/ipfs\/([a-zA-Z0-9]+)/,  // gateway.pinata.cloud/ipfs/hash
    ];
    
    for (const pattern of patterns) {
      const match = ipfsUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // If no pattern matches, return the original URL (fallback)
    return ipfsUrl;
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0: // Basic info
        if (!formData.name.trim()) newErrors.name = 'Token name is required';
        if (!formData.symbol.trim()) newErrors.symbol = 'Token symbol is required';
        if (!formData.description.trim()) newErrors.description = 'Description is required';
        if (formData.totalSupply <= 0) newErrors.totalSupply = 'Total supply must be greater than 0';
        if (formData.decimals < 0 || formData.decimals > 9) newErrors.decimals = 'Decimals must be between 0 and 9';
        break;
      case 1: // DEX Selection
        if (!formData.dexProvider) newErrors.dexProvider = 'Please select a DEX provider';
        break;
      case 2: // Config
        if (formData.ticketPrice <= 0) newErrors.ticketPrice = 'Ticket price must be greater than 0';
        if (formData.maxTickets <= 0) newErrors.maxTickets = 'Max tickets must be greater than 0';
        if (formData.raffleDuration <= 0) newErrors.raffleDuration = 'Duration must be greater than 0';
        if (formData.winnerCount <= 0) newErrors.winnerCount = 'Winner count must be greater than 0';
        if (formData.winnerCount > formData.maxTickets) newErrors.winnerCount = 'Winner count cannot exceed max tickets';
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

  const updateFormData = (field: keyof RaffleFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      const { [field]: _, ...rest } = errors;
      setErrors(rest);
    }
  };

  // Helper functions for duration conversion
  const convertHoursToDate = (hours: number) => {
    const now = new Date();
    const endTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
    return endTime;
  };

  const convertDateToHours = (date: Date) => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  };

  const updateDurationFromDate = (date: Date | undefined) => {
    if (date) {
      const hours = convertDateToHours(date);
      updateFormData('raffleDuration', hours);
    }
  };

  const updateDurationFromHours = (hours: number) => {
    const date = convertHoursToDate(hours);
    setEndDate(date);
  };

  // Helper function to handle number input changes
  const handleNumberChange = (field: keyof RaffleFormData, value: string) => {
    // Allow empty string for deletion
    if (value === '') {
      updateFormData(field, 0);
      return;
    }
    
    // Only allow numbers and decimal point
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue >= 0) {
      updateFormData(field, numericValue);
    }
  };

  // Image upload functions
  const handleImageUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!pinataService.isPinataConfigured()) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          updateFormData('image', result);
          toast({
            title: "Image Uploaded (Local)",
            description: "Image uploaded locally. Configure Pinata for IPFS storage.",
          });
        };
        reader.readAsDataURL(file);
        return;
      }

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
            uploadDate: new Date().toISOString()
          }
        }
      );

      updateFormData('image', ipfsUrl);
      toast({
        title: "Image Uploaded to IPFS!",
        description: "Your image is now permanently stored on IPFS.",
      });

    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBannerUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select a banner image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!pinataService.isPinataConfigured()) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          updateFormData('banner', result);
          toast({
            title: "Banner Uploaded (Local)",
            description: "Banner uploaded locally. Configure Pinata for IPFS storage.",
          });
        };
        reader.readAsDataURL(file);
        return;
      }

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

      updateFormData('banner', ipfsUrl);
      toast({
        title: "Banner Uploaded to IPFS!",
        description: "Your banner is now permanently stored on IPFS.",
      });

    } catch (error) {
      console.error('Banner upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload banner. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const removeImage = () => {
    updateFormData('image', '');
    toast({
      title: "Image Removed",
      description: "Token image removed.",
    });
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    if (!connected || !publicKey || !wallet || !sendTransaction) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create a raffle.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate keypairs for required accounts
      const listingKeypair = Keypair.generate();
      const launchDataKeypair = Keypair.generate();
      const baseTokenMintKeypair = Keypair.generate();
      const quoteTokenMintKeypair = Keypair.generate();
      const teamKeypair = Keypair.generate();

      const transaction = new Transaction();

      // Create all required accounts
      const accounts = [
        { keypair: listingKeypair, space: 200, name: 'listing' },
        { keypair: launchDataKeypair, space: 300, name: 'launchData' },
        { keypair: baseTokenMintKeypair, space: 82, name: 'baseTokenMint' },
        { keypair: quoteTokenMintKeypair, space: 82, name: 'quoteTokenMint' },
        { keypair: teamKeypair, space: 100, name: 'team' },
      ];

      // Add account creation instructions
      for (const account of accounts) {
        const lamports = await connection.getMinimumBalanceForRentExemption(account.space);
        transaction.add(
          SystemProgram.createAccount({
            fromPubkey: publicKey,
            newAccountPubkey: account.keypair.publicKey,
            space: account.space,
            lamports,
            programId: PROGRAM_ID,
          })
        );
      }

      // Create the raffle launch instruction first (without transfer to reduce size)
      console.log('🎫 Creating raffle launch...');
      
      const createLaunchArgs = {
        name: formData.name,
        symbol: formData.symbol,
        uri: formData.website || '',
        icon: formData.image ? extractIPFSHash(formData.image) : '',
        banner: formData.banner ? extractIPFSHash(formData.banner) : '',
        total_supply: formData.totalSupply,
        decimals: formData.decimals,
        launch_date: Math.floor(Date.now() / 1000), // Current timestamp
        close_date: Math.floor(Date.now() / 1000) + (formData.raffleDuration * 60 * 60), // Duration in seconds
        num_mints: formData.maxTickets,
        ticket_price: formData.ticketPrice * 1_000_000_000, // Convert to lamports
        page_name: formData.name.toLowerCase().replace(/\s+/g, '-'),
        transfer_fee: 0,
        max_transfer_fee: 0,
        extensions: 0,
        amm_provider: formData.dexProvider === 'cook' ? 0 : 1, // 0 for Cook, 1 for Raydium
        launch_type: 0, // Raffle launch
        whitelist_tokens: 0,
        whitelist_end: 0,
      };

      console.log('📊 Form data:', formData);
      console.log('📊 Create args:', createLaunchArgs);

      // Optimize createLaunchArgs for smaller transaction size
      const optimizedCreateArgs = {
        name: createLaunchArgs.name.substring(0, 16), // Limit to 16 chars (reduced from 20)
        symbol: createLaunchArgs.symbol.substring(0, 4), // Limit to 4 chars (reduced from 6)
        uri: '', // Empty to save space
      icon: '', // Will be updated after raffle creation
      banner: '', // Will be updated after raffle creation
        total_supply: createLaunchArgs.total_supply,
        decimals: createLaunchArgs.decimals,
        launch_date: createLaunchArgs.launch_date,
        close_date: createLaunchArgs.close_date,
        num_mints: createLaunchArgs.num_mints,
        ticket_price: createLaunchArgs.ticket_price,
        page_name: createLaunchArgs.page_name.substring(0, 8), // Limit to 8 chars (reduced from 12)
        transfer_fee: createLaunchArgs.transfer_fee,
        max_transfer_fee: createLaunchArgs.max_transfer_fee,
        extensions: createLaunchArgs.extensions,
        amm_provider: createLaunchArgs.amm_provider,
        launch_type: createLaunchArgs.launch_type,
        whitelist_tokens: createLaunchArgs.whitelist_tokens,
        whitelist_end: createLaunchArgs.whitelist_end,
      };

      console.log('📊 Optimized args:', optimizedCreateArgs);
      
      // Create Borsh schema for CreateArgs (matching Rust struct)
      const createArgsSchema = {
        struct: {
          name: 'string',
          symbol: 'string',
          uri: 'string',
          icon: 'string',
          banner: 'string',
          total_supply: 'u64',
          decimals: 'u8',
          launch_date: 'u64',
          close_date: 'u64',
          num_mints: 'u32',
          ticket_price: 'u64',
          page_name: 'string',
          transfer_fee: 'u16',
          max_transfer_fee: 'u64',
          extensions: 'u8',
          amm_provider: 'u8',
          launch_type: 'u8',
          whitelist_tokens: 'u64',
          whitelist_end: 'u64',
        }
      };

      // Use LetsCookProgram.createRaffleInstruction for raffle launches
      const createLaunchInstruction = LetsCookProgram.createRaffleInstruction(
        optimizedCreateArgs,
        {
          user: publicKey,
          listing: listingKeypair.publicKey,
          launchData: launchDataKeypair.publicKey,
          quoteTokenMint: quoteTokenMintKeypair.publicKey,
          launchQuote: publicKey, // Using user as placeholder
          cookData: publicKey, // Using user as placeholder
          cookPda: publicKey, // Using user as placeholder
          baseTokenMint: baseTokenMintKeypair.publicKey,
          cookBaseToken: publicKey, // Using user as placeholder
          team: teamKeypair.publicKey,
          quoteTokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          baseTokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          associatedToken: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
          systemProgram: SystemProgram.programId,
        }
      );

      transaction.add(createLaunchInstruction);

      // Skip initial liquidity for now to reduce transaction size
      // TODO: Add liquidity in a separate transaction if needed
      // if (formData.initialLiquidity > 0) {
      //   const liquidityInstruction = SystemProgram.transfer({
      //     fromPubkey: publicKey,
      //     toPubkey: baseTokenMintKeypair.publicKey,
      //     lamports: Math.floor(formData.initialLiquidity * 1e9),
      //   });
      //   transaction.add(liquidityInstruction);
      // }

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign the transaction with all keypairs
      const keypairs = accounts.map(acc => acc.keypair);
      transaction.sign(...keypairs);

      console.log('📤 Sending raffle creation transaction...');

      // Sign and send transaction
      const signature = await sendTransaction(transaction, connection);
      console.log('✅ Raffle created:', signature);
      console.log('📍 Launch data account:', launchDataKeypair.publicKey.toBase58());

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      // Now send the token creation fee in a separate transaction
      console.log('💰 Sending token creation fee...');
      const tokenCreationFee = 0.005 * 1e9; // 0.005 SOL in lamports
      
      const feeTransaction = new Transaction();
      feeTransaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: LEDGER_WALLET,
          lamports: tokenCreationFee,
        })
      );
      
      const { blockhash: feeBlockhash } = await connection.getLatestBlockhash();
      feeTransaction.recentBlockhash = feeBlockhash;
      feeTransaction.feePayer = publicKey;
      
      const feeSignature = await sendTransaction(feeTransaction, connection);
      console.log('✅ Token creation fee sent:', feeSignature);
      
          // Store IPFS image metadata for this raffle
          console.log('🖼️ Storing IPFS image metadata...');
          try {
            const iconHash = formData.image ? extractIPFSHash(formData.image) : '';
            const bannerHash = formData.banner ? extractIPFSHash(formData.banner) : '';
            
            if (iconHash || bannerHash) {
              const metadataCid = await ipfsMetadataService.storeRaffleImages(
                launchDataKeypair.publicKey.toBase58(),
                iconHash,
                bannerHash
              );
              console.log('✅ IPFS image metadata stored:', metadataCid);
              
              // Store the mapping locally for now (in a real app, you'd store this on-chain or in a database)
              localStorage.setItem(`raffle_metadata_${launchDataKeypair.publicKey.toBase58()}`, metadataCid);
              
              toast({
                title: "Images Stored!",
                description: `Raffle images have been stored in IPFS metadata. CID: ${metadataCid.slice(0, 8)}...`,
              });
            } else {
              console.log('⚠️ No images to store');
            }
          } catch (error) {
            console.error('❌ Error storing IPFS image metadata:', error);
            toast({
              title: "Image Storage Failed",
              description: "Raffle created but images couldn't be stored in metadata.",
              variant: "destructive",
            });
          }
      
      setTxSignature(signature);
      setCreatedLaunchId(launchDataKeypair.publicKey.toBase58());
      setCreatedTokenMint(baseTokenMintKeypair.publicKey.toBase58());

      toast({
        title: "Raffle Created Successfully!",
        description: `Your raffle has been created with fee paid. Launch Data Account: ${launchDataKeypair.publicKey.toBase58().slice(0, 8)}...`,
      });

    } catch (error) {
      console.error('❌ Error creating raffle:', error);
      
      let errorMessage = "An unknown error occurred.";
      let errorTitle = "Raffle Creation Failed";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes('Insufficient funds')) {
          errorTitle = "Insufficient Funds";
          errorMessage = "You don't have enough SOL to pay for the transaction fees.";
        } else if (error.message.includes('User rejected')) {
          errorTitle = "Transaction Cancelled";
          errorMessage = "You cancelled the transaction in your wallet.";
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setFormData({
      dexProvider: 'cook',
      name: '',
      symbol: '',
      description: '',
      totalSupply: 1000000,
      decimals: 9,
      ticketPrice: 0.1,
      maxTickets: 1000,
      raffleDuration: 24,
      winnerCount: 100,
      website: '',
      twitter: '',
      telegram: '',
      discord: '',
      image: '',
      banner: '',
      liquidityTokenAmount: 0,
      winnersAllocation: 50,
      teamAllocation: 20,
      marketingAllocation: 15,
      liquidityAllocation: 10,
      treasuryAllocation: 5,
      type: 'raffle'
    });
    setTxSignature(null);
    setErrors({});
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 rounded-2xl border border-slate-800 p-8 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ticket className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-slate-400 mb-6">
            Connect your Solana wallet to create a raffle launch
          </p>
          <button
            onClick={() => {/* Wallet connection is handled by the wallet adapter */}}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Connect Wallet
          </button>
        </motion.div>
      </div>
    );
  }

  if (txSignature) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 rounded-2xl border border-green-500/20 p-8 max-w-lg w-full text-center"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Raffle Created! 🎉</h2>
          <p className="text-slate-400 mb-6">
            Your raffle has been created and is ready for participants
          </p>
          
          <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Transaction</span>
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-400 hover:text-yellow-300 text-sm flex items-center"
              >
                View <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
            <code className="text-white text-xs break-all">{txSignature}</code>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={resetForm}
              className="bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Create Another
            </button>
            <button
              onClick={() => setLocation(`/raffle/${createdLaunchId}`)}
              className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium py-3 px-6 rounded-lg transition-colors"
            >
              View Raffle
            </button>
          </div>
          
          <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-yellow-300 text-sm mb-2">
              <Info className="w-4 h-4 inline mr-1" />
              Your raffle will appear on the raffles page shortly
            </p>
            <p className="text-slate-400 text-xs">
              It may take a few moments for the blockchain data to be processed and displayed
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <Header 
        title="Create Raffle"
        subtitle="Launch your token with fair distribution"
        showNavigation={true}
      />
      <div className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <Ticket className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Create Raffle Launch</h1>
            <p className="text-slate-400">Launch your token with fair distribution through raffle tickets</p>
          </motion.div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {STEPS.map((step, index) => (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      index < currentStep ? 'bg-yellow-600 text-white' :
                      index === currentStep ? 'bg-yellow-600 text-white ring-4 ring-yellow-600/30' :
                      'bg-slate-800 text-slate-500'
                    }`}>
                      {index < currentStep ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                    </div>
                    <span className="text-xs text-slate-400 mt-1 capitalize">{step}</span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`h-1 flex-1 mx-2 rounded ${
                      index < currentStep ? 'bg-yellow-600' : 'bg-slate-800'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-slate-900 rounded-2xl border border-slate-800 p-8"
            >
              {/* Step 0: Basic Info */}
              {STEPS[currentStep] === 'basic' && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Token Information</h2>
                    <p className="text-slate-400">Define your token's basic properties</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Token Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => updateFormData('name', e.target.value)}
                        placeholder="My Awesome Token"
                        className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                          errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                        }`}
                      />
                      {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Symbol *
                      </label>
                      <input
                        type="text"
                        value={formData.symbol}
                        onChange={(e) => updateFormData('symbol', e.target.value.toUpperCase())}
                        placeholder="MAT"
                        maxLength={10}
                        className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                          errors.symbol ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                        }`}
                      />
                      {errors.symbol && <p className="text-red-400 text-xs mt-1">{errors.symbol}</p>}
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
                            value="raffle"
                            checked={formData.type === 'raffle'}
                            onChange={(e) => updateFormData('type', e.target.value as 'raffle')}
                            className="mr-2 text-yellow-500"
                          />
                          <span className="text-slate-300">🎫 Raffle Launch</span>
                        </label>
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
                      </div>
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

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Total Supply *
                      </label>
                      <input
                        type="number"
                        value={formData.totalSupply}
                        onChange={(e) => updateFormData('totalSupply', Number(e.target.value))}
                        className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                          errors.totalSupply ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                        }`}
                      />
                      {errors.totalSupply && <p className="text-red-400 text-xs mt-1">{errors.totalSupply}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Decimals *
                      </label>
                      <input
                        type="number"
                        value={formData.decimals}
                        onChange={(e) => updateFormData('decimals', Number(e.target.value))}
                        min={0}
                        max={9}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                  </div>

                  {/* Image Upload Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">Token Image</h3>
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
                          Upload Token Image (Recommended: Square, 512x512px)
                        </label>
                        <div className="relative">
                          {formData.image ? (
                            <div className="relative">
                              <img 
                                src={formData.image} 
                                alt="Token Image" 
                                className="w-32 h-32 rounded-lg object-cover mx-auto border-2 border-yellow-500"
                              />
                              <button
                                onClick={removeImage}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-32 h-32 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center mx-auto hover:border-yellow-500 transition-colors cursor-pointer">
                              <Image className="w-8 h-8 text-slate-400 mb-2" />
                              <span className="text-xs text-slate-400">Click to upload</span>
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
                                className="w-48 h-24 rounded-lg object-cover mx-auto border-2 border-yellow-500"
                              />
                              <button
                                onClick={() => updateFormData('banner', '')}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-48 h-24 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center mx-auto hover:border-yellow-500 transition-colors cursor-pointer">
                              <Image className="w-6 h-6 text-slate-400 mb-1" />
                              <span className="text-xs text-slate-400">Click to upload banner</span>
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
                  </div>
                </div>
              )}

              {/* Step 1: DEX Selection */}
              {STEPS[currentStep] === 'dex' && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Choose DEX Provider</h2>
                    <p className="text-slate-400">Select the decentralized exchange for your raffle</p>
                  </div>

                  <DEXSelector
                    selectedDEX={formData.dexProvider}
                    onSelectDEX={(dexId) => updateFormData('dexProvider', dexId)}
                  />
                  {errors.dexProvider && (
                    <p className="text-red-400 text-sm flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.dexProvider}
                    </p>
                  )}
                </div>
              )}

              {/* Step 2: Config */}
              {STEPS[currentStep] === 'config' && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Raffle Configuration</h2>
                    <p className="text-slate-400">Set up your raffle parameters</p>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-yellow-200">
                        <p className="font-medium mb-1">Raffle Launch Benefits:</p>
                        <ul className="space-y-1 text-yellow-200/80">
                          <li>• Fair distribution through ticket system</li>
                          <li>• Build community before launch</li>
                          <li>• Anti-bot protection built-in</li>
                          <li>• Optional initial liquidity from creator</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Ticket Price (SOL) *
                      </label>
                        <input
                          type="number"
                          step="0.001"
                          value={formData.ticketPrice || ''}
                          onChange={(e) => handleNumberChange('ticketPrice', e.target.value)}
                          className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                            errors.ticketPrice ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                          }`}
                          placeholder="0.1"
                        />
                      {errors.ticketPrice && <p className="text-red-400 text-xs mt-1">{errors.ticketPrice}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Maximum Tickets *
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={formData.maxTickets || ''}
                          onChange={(e) => handleNumberChange('maxTickets', e.target.value)}
                          className={`flex-1 bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                            errors.maxTickets ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                          }`}
                          placeholder="Enter max tickets (0 for unlimited)"
                        />
                        <button
                          type="button"
                          onClick={() => updateFormData('maxTickets', 0)}
                          className="px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-black rounded-lg transition-colors text-sm font-medium"
                        >
                          Unlimited
                        </button>
                      </div>
                      <div className="mt-2 text-sm text-slate-400">
                        {formData.maxTickets === 0 
                          ? 'Unlimited tickets can be sold' 
                          : `Maximum ${formData.maxTickets.toLocaleString()} tickets can be sold`
                        }
                      </div>
                      {errors.maxTickets && <p className="text-red-400 text-xs mt-1">{errors.maxTickets}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Duration *
                      </label>
                      
                      {/* Duration Mode Toggle */}
                      <div className="flex mb-3 bg-slate-800 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => setDurationMode('hours')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                            durationMode === 'hours'
                              ? 'bg-yellow-600 text-black'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Clock className="w-4 h-4" />
                          Hours
                        </button>
                        <button
                          type="button"
                          onClick={() => setDurationMode('date')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                            durationMode === 'date'
                              ? 'bg-yellow-600 text-black'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Calendar className="w-4 h-4" />
                          End Date
                        </button>
                      </div>

                      {/* Hours Input */}
                      {durationMode === 'hours' && (
                        <input
                          type="number"
                          value={formData.raffleDuration || ''}
                          onChange={(e) => {
                            const hours = Number(e.target.value);
                            handleNumberChange('raffleDuration', e.target.value);
                            updateDurationFromHours(hours);
                          }}
                          className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                            errors.raffleDuration ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                          }`}
                          placeholder="Enter duration in hours"
                        />
                      )}

                      {/* Calendar Input */}
                      {durationMode === 'date' && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={`w-full justify-start text-left font-normal bg-slate-800 border-slate-700 text-white hover:bg-slate-700 ${
                                !endDate && 'text-slate-500'
                              }`}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {endDate ? format(endDate, "PPP") : "Pick end date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700">
                            <CalendarComponent
                              mode="single"
                              selected={endDate}
                              onSelect={(date) => {
                                setEndDate(date);
                                updateDurationFromDate(date);
                              }}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      )}

                      {/* Duration Display */}
                      {formData.raffleDuration > 0 && (
                        <div className="mt-2 text-sm text-slate-400">
                          {formData.raffleDuration} hours
                          {endDate && (
                            <span className="ml-2">
                              (Ends: {format(endDate, "MMM dd, yyyy 'at' h:mm a")})
                            </span>
                          )}
                        </div>
                      )}

                      {errors.raffleDuration && <p className="text-red-400 text-xs mt-1">{errors.raffleDuration}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Number of Winners *
                      </label>
                      <input
                        type="number"
                        value={formData.winnerCount || ''}
                        onChange={(e) => handleNumberChange('winnerCount', e.target.value)}
                        className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                          errors.winnerCount ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                        }`}
                        placeholder="100"
                      />
                      {errors.winnerCount && <p className="text-red-400 text-xs mt-1">{errors.winnerCount}</p>}
                    </div>

                    {/* Guaranteed Liquidity Threshold */}
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        <Info className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-yellow-200">
                          <strong>Guaranteed Liquidity Threshold</strong>
                        </div>
                      </div>
                      <div className="text-sm text-yellow-200">
                        <p className="mb-2">
                          This raffle requires a minimum liquidity threshold to succeed:
                        </p>
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-1">
                            <span>Winning Tickets:</span>
                            <span className="font-semibold">{formData.winnerCount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center mb-1">
                            <span>Ticket Price:</span>
                            <span className="font-semibold">{formData.ticketPrice} SOL</span>
                          </div>
                          <div className="border-t border-yellow-500/30 pt-2 mt-2">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold">Required Liquidity:</span>
                              <span className="font-bold text-yellow-400">
                                {(formData.winnerCount * formData.ticketPrice).toFixed(2)} SOL
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-yellow-200/80">
                          The raffle will only succeed if tickets worth at least this amount are sold.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Initial Liquidity Section */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-blue-400" />
                      Initial Liquidity (Optional)
                    </h3>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                      <div className="flex items-start">
                        <Info className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-200">
                          <p className="font-medium mb-1">Why add initial liquidity?</p>
                          <ul className="space-y-1 text-blue-200/80">
                            <li>• Provides price stability and reduces volatility</li>
                            <li>• Creates a better trading experience for users</li>
                            <li>• Helps establish fair market value</li>
                            <li>• Optional - you can launch without liquidity</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Token Allocation for Liquidity
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.liquidityTokenAmount || 0}
                          onChange={(e) => updateFormData('liquidityTokenAmount', Number(e.target.value))}
                          placeholder="0.0"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Amount of tokens to allocate for liquidity (optional)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tokenomics Section */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-yellow-400" />
                      Tokenomics Distribution
                    </h3>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                      <div className="flex items-start">
                        <Info className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-yellow-200">
                          <p className="font-medium mb-1">Token Distribution Strategy:</p>
                          <ul className="space-y-1 text-yellow-200/80">
                            <li>• Define how your tokens will be distributed</li>
                            <li>• Set aside tokens for different purposes</li>
                            <li>• Ensure fair and transparent allocation</li>
                            <li>• Plan for long-term sustainability</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Raffle Winners Allocation (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.winnersAllocation || 50}
                          onChange={(e) => updateFormData('winnersAllocation', Number(e.target.value))}
                          placeholder="50"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Percentage of total supply for raffle winners
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Team/Development (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.teamAllocation || 20}
                          onChange={(e) => updateFormData('teamAllocation', Number(e.target.value))}
                          placeholder="20"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Tokens reserved for team and development
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Marketing/Community (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.marketingAllocation || 15}
                          onChange={(e) => updateFormData('marketingAllocation', Number(e.target.value))}
                          placeholder="15"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Tokens for marketing and community building
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Liquidity Pool (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.liquidityAllocation || 10}
                          onChange={(e) => updateFormData('liquidityAllocation', Number(e.target.value))}
                          placeholder="10"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Tokens for initial liquidity provision
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Treasury/Reserve (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.treasuryAllocation || 5}
                          onChange={(e) => updateFormData('treasuryAllocation', Number(e.target.value))}
                          placeholder="5"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Tokens held in treasury for future use
                        </p>
                      </div>
                    </div>
                    
                    {/* Tokenomics Summary */}
                    <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
                      <h4 className="text-sm font-semibold text-white mb-3">Tokenomics Summary</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Raffle Winners:</span>
                          <span className="text-white">{(formData.totalSupply * (formData.winnersAllocation || 50) / 100).toLocaleString()} ({formData.winnersAllocation || 50}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Team:</span>
                          <span className="text-white">{(formData.totalSupply * (formData.teamAllocation || 20) / 100).toLocaleString()} ({formData.teamAllocation || 20}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Marketing:</span>
                          <span className="text-white">{(formData.totalSupply * (formData.marketingAllocation || 15) / 100).toLocaleString()} ({formData.marketingAllocation || 15}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Liquidity:</span>
                          <span className="text-white">{(formData.totalSupply * (formData.liquidityAllocation || 10) / 100).toLocaleString()} ({formData.liquidityAllocation || 10}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Treasury:</span>
                          <span className="text-white">{(formData.totalSupply * (formData.treasuryAllocation || 5) / 100).toLocaleString()} ({formData.treasuryAllocation || 5}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Allocated:</span>
                          <span className="text-white">{((formData.winnersAllocation || 50) + (formData.teamAllocation || 20) + (formData.marketingAllocation || 15) + (formData.liquidityAllocation || 10) + (formData.treasuryAllocation || 5))}%</span>
                        </div>
                      </div>
                      {((formData.winnersAllocation || 50) + (formData.teamAllocation || 20) + (formData.marketingAllocation || 15) + (formData.liquidityAllocation || 10) + (formData.treasuryAllocation || 5)) !== 100 && (
                        <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-300">
                          ⚠️ Total allocation should equal 100%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Social */}
              {STEPS[currentStep] === 'social' && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Social Links</h2>
                    <p className="text-slate-400">Add your project's social media links (optional)</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <Globe className="w-4 h-4 inline mr-1" />
                        Website
                      </label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => updateFormData('website', e.target.value)}
                        placeholder="https://yourwebsite.com"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <Twitter className="w-4 h-4 inline mr-1" />
                        Twitter
                      </label>
                      <input
                        type="url"
                        value={formData.twitter}
                        onChange={(e) => updateFormData('twitter', e.target.value)}
                        placeholder="https://twitter.com/yourhandle"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <MessageCircle className="w-4 h-4 inline mr-1" />
                        Telegram
                      </label>
                      <input
                        type="url"
                        value={formData.telegram}
                        onChange={(e) => updateFormData('telegram', e.target.value)}
                        placeholder="https://t.me/yourgroup"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <Hash className="w-4 h-4 inline mr-1" />
                        Discord
                      </label>
                      <input
                        type="url"
                        value={formData.discord}
                        onChange={(e) => updateFormData('discord', e.target.value)}
                        placeholder="https://discord.gg/yourserver"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {STEPS[currentStep] === 'review' && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Review Your Raffle</h2>
                    <p className="text-slate-400">Double-check your raffle details before launching</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white">Token Details</h3>
                      <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Name:</span>
                          <span className="text-white">{formData.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Symbol:</span>
                          <span className="text-white">{formData.symbol}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Supply:</span>
                          <span className="text-white">{formData.totalSupply.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Decimals:</span>
                          <span className="text-white">{formData.decimals}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white">Raffle Settings</h3>
                      <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Ticket Price:</span>
                          <span className="text-white">{formData.ticketPrice} SOL</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Max Tickets:</span>
                          <span className="text-white">{formData.maxTickets.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Duration:</span>
                          <span className="text-white">{formData.raffleDuration} hours</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Winners:</span>
                          <span className="text-white">{formData.winnerCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-yellow-200">
                        <p className="font-medium mb-1">Launch Summary:</p>
                        <ul className="space-y-1 text-yellow-200/80">
                          <li>• Raffle will run for {formData.raffleDuration} hours</li>
                          <li>• {formData.winnerCount} winners will be selected from {formData.maxTickets} tickets</li>
                          <li>• Each ticket costs {formData.ticketPrice} SOL</li>
                          <li>• Launch fee: 0.005 SOL + transaction costs</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between mt-8">
                <button
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className="flex items-center px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>

                {currentStep < STEPS.length - 1 ? (
                  <button
                    onClick={handleNext}
                    className="flex items-center px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-black rounded-lg transition-colors"
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex items-center px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg transition-colors"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Raffle...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4 mr-2" />
                        Create Raffle
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

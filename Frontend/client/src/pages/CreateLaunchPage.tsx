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
  TrendingUp
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
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

const STEPS = ['basic', 'dex', 'config', 'social', 'review'];

// Placeholder wallet address for fees - replace with actual fee wallet
const LEDGER_WALLET = new PublicKey('8fvPxVrPp1p3QGwjiFQVYg5xpBTVrWrarrUxQryftUZV');

export default function EnhancedLaunchPage() {
  const { connected, publicKey, wallet, signTransaction } = useWallet();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [createdLaunchId, setCreatedLaunchId] = useState<string | null>(null);
  const [createdTokenMint, setCreatedTokenMint] = useState<string | null>(null);
  const [showTokenVisibility, setShowTokenVisibility] = useState(false);

  // Connection to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

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
  
  // Define the form data type
  interface FormData {
    dexProvider: string;
    name: string;
    symbol: string;
    description: string;
    totalSupply: number;
    decimals: number;
    initialPrice: number;
    liquidityAmount: number;
    liquidityTokenAmount?: number;
    creatorPurchaseAmount?: number;
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
    totalSupply: 1000000,
    decimals: 9,
    initialPrice: 0.01,
    liquidityAmount: 0,
    liquidityTokenAmount: 0,
    creatorPurchaseAmount: 0,
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
        if (formData.initialPrice <= 0) {
          newErrors.initialPrice = 'Initial price must be greater than 0';
        }
        if (formData.totalSupply <= 0) {
          newErrors.totalSupply = 'Total supply must be greater than 0';
        }
        if (formData.decimals < 0 || formData.decimals > 9) {
          newErrors.decimals = 'Decimals must be between 0 and 9';
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

  const updateFormData = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      const { [field]: _, ...rest } = errors;
      setErrors(rest);
    }
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
        // Fallback to base64 for development
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
        // Fallback to base64 for development
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

  // Helper function to convert file to base64
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
    // Prevent double submission
    if (isSubmitting) {
      console.log('⚠️ Submission already in progress, ignoring duplicate request');
      return;
    }
    
    if (!validateStep(currentStep)) return;
    
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
        { keypair: launchDataKeypair, space: 1000, name: 'launchData' },
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
      
      const createLaunchArgs = {
        name: formData.name.substring(0, 20), // Limit to 20 chars
        symbol: formData.symbol.substring(0, 6), // Limit to 6 chars
        uri: '', // Empty to save space
        icon: formData.image ? extractIPFSHash(formData.image) : '', // Full IPFS hash
        banner: '', // Empty to save space
        total_supply: formData.totalSupply,
        decimals: formData.decimals,
        ticket_price: formData.initialPrice * 1_000_000_000, // Convert to lamports
        page_name: formData.name.toLowerCase().replace(/\s+/g, '-').substring(0, 12), // Limit to 12 chars
        transfer_fee: 0,
        max_transfer_fee: 0,
        extensions: 0,
        amm_provider: formData.dexProvider === 'cook' ? 0 : 1,
        launch_type: 1, // Instant launch
        whitelist_tokens: 0,
        whitelist_end: 0,
      };

      // Use LetsCookProgram.createInstantLaunchInstruction for instant launches
      const createLaunchInstruction = LetsCookProgram.createInstantLaunchInstruction(
        createLaunchArgs,
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

      // Set transaction properties required for signing
      // Add a small delay to ensure fresh blockhash
      await new Promise(resolve => setTimeout(resolve, 100));
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      // Add a unique identifier to prevent caching issues
      const uniqueId = Date.now().toString();
      console.log('🔍 Transaction details:', {
        blockhash: blockhash.toString(),
        feePayer: publicKey.toString(),
        uniqueId,
        instructionCount: transaction.instructions.length
      });

      // Sign and send transaction
      // First sign with all keypairs
      transaction.sign(
        listingKeypair,
        launchDataKeypair,
        baseTokenMintKeypair,
        quoteTokenMintKeypair,
        teamKeypair
      );
      
      // Then sign with user's wallet
      const signedTransaction = await signTransaction(transaction);
      const launchSignature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(launchSignature, 'confirmed');

      console.log('✅ Instant launch created successfully:', launchSignature);
      
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
      
      // 2. Add initial liquidity if specified
      if (formData.liquidityAmount > 0) {
        console.log('💧 Adding initial liquidity...');
        const liquidityTransaction = new Transaction();
        
        // Convert SOL to lamports for liquidity
        const liquidityLamports = Math.floor(formData.liquidityAmount * 1e9);
        
        liquidityTransaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: baseTokenMintKeypair.publicKey, // Transfer to token mint for liquidity
            lamports: liquidityLamports,
          })
        );
        
        const { blockhash: liquidityBlockhash } = await connection.getLatestBlockhash();
        liquidityTransaction.recentBlockhash = liquidityBlockhash;
        liquidityTransaction.feePayer = publicKey;
        
        const liquiditySignature = await signTransaction(liquidityTransaction);
        const liquidityTxSignature = await connection.sendRawTransaction(liquiditySignature.serialize());
        await connection.confirmTransaction(liquidityTxSignature, 'confirmed');
        console.log('✅ Initial liquidity added:', liquidityTxSignature);
      }
      
      // 3. Handle creator token purchase if specified
      if (formData.creatorPurchaseAmount && formData.creatorPurchaseAmount > 0) {
        console.log('🛒 Processing creator token purchase...');
        // This would typically involve buying tokens from the launch
        // For now, we'll just log it as the exact implementation depends on the launch mechanism
        console.log(`Creator wants to purchase ${formData.creatorPurchaseAmount} tokens`);
        // TODO: Implement actual token purchase logic
      }
      
      // Set the created launch ID and token mint
      // Use launchDataAccount as the launch ID since that's how launches are stored and retrieved
      setCreatedLaunchId(launchDataKeypair.publicKey.toBase58());
      setCreatedTokenMint(baseTokenMintKeypair.publicKey.toBase58());
      setTxSignature(launchSignature);

      toast({
        title: "Launch Created Successfully!",
        description: `Your token has been launched with fee paid${formData.liquidityAmount > 0 ? ' and initial liquidity added' : ''}.`,
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
      totalSupply: 1000000,
      decimals: 9,
      initialPrice: 0.01,
      liquidityAmount: 0,
      liquidityTokenAmount: 0,
      creatorPurchaseAmount: 0,
      website: '',
      twitter: '',
      telegram: '',
      discord: '',
      image: '',
      banner: ''
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
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
                    <span className="text-slate-400">Initial Price:</span>
                    <p className="text-white font-semibold">{formData.initialPrice} SOL</p>
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

              {/* Creator Token Purchase */}
              {(formData.creatorPurchaseAmount || 0) > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <DollarSign className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-green-200">
                      <p className="font-medium mb-1">Creator Token Purchase</p>
                      <p className="text-green-200/80 mb-3">
                        You selected to buy {(formData.creatorPurchaseAmount || 0) / formData.initialPrice} {formData.symbol} tokens for {(formData.creatorPurchaseAmount || 0)} SOL.
                      </p>
                      <button
                        onClick={async () => {
                          try {
                            if (!publicKey || !signTransaction) return;
                            
                            toast({
                              title: "Processing Purchase...",
                              description: "Please confirm the transaction in your wallet.",
                            });

                            // Use real blockchain transaction to buy tokens
                            const result = await realLaunchService.buyTokensAMM(
                              createdLaunchId || '',
                              publicKey.toBase58(),
                              formData.creatorPurchaseAmount || 0,
                              signTransaction
                            );

                            if (result.success) {
                              toast({
                                title: "Purchase Successful!",
                                description: `You now own ${(formData.creatorPurchaseAmount || 0) / formData.initialPrice} ${formData.symbol} tokens.`,
                              });
                            } else {
                              throw new Error(result.error || 'Failed to purchase tokens');
                            }
                          } catch (error) {
                            console.error('Purchase error:', error);
                            toast({
                              title: "Purchase Failed",
                              description: error instanceof Error ? error.message : "Failed to purchase tokens. Please try again.",
                              variant: "destructive",
                            });
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Buy My Tokens Now
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
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
                decimals: 9
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

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Initial Price (SOL) *
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.initialPrice}
                      onChange={(e) => updateFormData('initialPrice', Number(e.target.value))}
                      className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                        errors.initialPrice ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                      }`}
                    />
                    {errors.initialPrice && <p className="text-red-400 text-xs mt-1">{errors.initialPrice}</p>}
                  </div>

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
                      min="0"
                      max="9"
                      value={formData.decimals}
                      onChange={(e) => updateFormData('decimals', Number(e.target.value))}
                      className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                        errors.decimals ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-yellow-500'
                      }`}
                    />
                    {errors.decimals && <p className="text-red-400 text-xs mt-1">{errors.decimals}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Initial Liquidity (SOL) - Optional
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.liquidityAmount}
                      onChange={(e) => updateFormData('liquidityAmount', Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      placeholder="0"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Add initial liquidity to boost market cap and reduce price impact
                    </p>
                  </div>
                </div>

                {/* Token Allocation for Liquidity */}
                {formData.liquidityAmount > 0 && (
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-white mb-3">Token Allocation for Liquidity</h4>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Token Amount for Liquidity
                        </label>
                        <input
                          type="number"
                          value={formData.liquidityTokenAmount || 0}
                          onChange={(e) => updateFormData('liquidityTokenAmount', Number(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="0"
                        />
                      </div>
                      <div className="text-sm text-slate-400">
                        <p>Estimated Market Cap: ${((formData.liquidityAmount + (formData.liquidityTokenAmount || 0) * formData.initialPrice) * 1000000).toLocaleString()}</p>
                        <p>Price Impact: {formData.liquidityAmount > 0 ? 'Low' : 'High'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Creator Token Purchase */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-white mb-3">Creator Token Purchase (Optional)</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        SOL Amount to Invest
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={formData.creatorPurchaseAmount || 0}
                        onChange={(e) => updateFormData('creatorPurchaseAmount', Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        placeholder="0"
                      />
                    </div>
                    <div className="text-sm text-slate-400">
                      <p>Tokens you'll receive: {((formData.creatorPurchaseAmount || 0) / formData.initialPrice).toFixed(2)} {formData.symbol}</p>
                      <p>Investment: {(formData.creatorPurchaseAmount || 0)} SOL</p>
                    </div>
                  </div>
                </div>

                {/* Investment Summary */}
                {(formData.creatorPurchaseAmount || 0) > 0 && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-300">Total Creator Investment:</span>
                      <span className="text-green-400 font-semibold">
                        {(formData.creatorPurchaseAmount || 0) + (formData.liquidityAmount || 0)} SOL
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-green-300">Your Token Holdings:</span>
                      <span className="text-green-400 font-semibold">
                        {((formData.creatorPurchaseAmount || 0) / formData.initialPrice + (formData.liquidityTokenAmount || 0)).toFixed(2)} {formData.symbol}
                      </span>
                    </div>
                  </div>
                )}
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
                      <p className="text-white font-medium">{formData.initialPrice} SOL</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Initial Liquidity</span>
                      <p className="text-white font-medium">
                        {formData.dexProvider === 'cook' ? '1 SOL (Auto-provided)' : `${formData.liquidityAmount} SOL`}
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

                <div className="bg-purple-500/10 border border-yellow-500/20 rounded-lg p-4">
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
              className="flex items-center px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
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
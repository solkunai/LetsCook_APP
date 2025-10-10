import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Rocket, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Zap,
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
  Hash
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { SolanaProgramService } from '@/lib/solanaProgram';

const STEPS = ['type', 'basic', 'config', 'social', 'review'];

export default function EnhancedLaunchPage() {
  const { connected, publicKey, wallet } = useWallet();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // Test function for debugging wallet balance - can be called from browser console
  const testWalletBalance = async () => {
    if (!publicKey) {
      console.error('❌ No public key available');
      return;
    }
    
    try {
      const programService = new SolanaProgramService();
      const result = await programService.testConnectionAndBalance(publicKey);
      console.log('🧪 Test result:', result);
      return result;
    } catch (error) {
      console.error('❌ Test failed:', error);
      return error;
    }
  };

  // Make test function available globally for console debugging
  useEffect(() => {
    (window as any).testWalletBalance = testWalletBalance;
    console.log('🧪 Test function available: window.testWalletBalance()');
  }, [publicKey]);
  
  // Define the form data type
  interface FormData {
    launchType: string;
    name: string;
    symbol: string;
    description: string;
    totalSupply: number;
    decimals: number;
    initialPrice: number;
    liquidityAmount: number;
    ticketPrice: number;
    maxTickets: number;
    raffleDuration: number;
    winnerCount: number;
    website: string;
    twitter: string;
    telegram: string;
    discord: string;
  }
  
  const [formData, setFormData] = useState<FormData>({
    launchType: '',
    name: '',
    symbol: '',
    description: '',
    totalSupply: 1000000,
    decimals: 9,
    initialPrice: 0.01,
    liquidityAmount: 10,
    ticketPrice: 0.1,
    maxTickets: 1000,
    raffleDuration: 24,
    winnerCount: 100,
    website: '',
    twitter: '',
    telegram: '',
    discord: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch(STEPS[step]) {
      case 'type':
        if (!formData.launchType) {
          newErrors.launchType = 'Please select a launch type';
        }
        break;
      case 'basic':
        if (!formData.name || formData.name.length < 1) {
          newErrors.name = 'Token name is required';
        }
        if (!formData.symbol || formData.symbol.length < 1) {
          newErrors.symbol = 'Token symbol is required';
        }
        if (!formData.description || formData.description.length < 10) {
          newErrors.description = 'Description must be at least 10 characters';
        }
        if (formData.totalSupply < 1000) {
          newErrors.totalSupply = 'Minimum supply is 1,000 tokens';
        }
        break;
      case 'config':
        if (formData.launchType === 'instant') {
          if (formData.initialPrice < 0.001) {
            newErrors.initialPrice = 'Minimum price is 0.001 SOL';
          }
          if (formData.liquidityAmount < 1) {
            newErrors.liquidityAmount = 'Minimum liquidity is 1 SOL';
          }
        } else if (formData.launchType === 'raffle') {
          if (formData.ticketPrice < 0.001) {
            newErrors.ticketPrice = 'Minimum ticket price is 0.001 SOL';
          }
          if (formData.maxTickets < 10) {
            newErrors.maxTickets = 'Minimum tickets is 10';
          }
          if (formData.raffleDuration < 1) {
            newErrors.raffleDuration = 'Minimum duration is 1 hour';
          }
          if (formData.winnerCount < 1) {
            newErrors.winnerCount = 'At least 1 winner required';
          }
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

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    // Enhanced wallet validation
    if (!connected || !publicKey || !wallet) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create a launch.",
        variant: "destructive",
      });
      return;
    }

    // Additional wallet checks
    if (!wallet.adapter) {
      toast({
        title: "Wallet Error",
        description: "Wallet adapter not available. Please reconnect your wallet.",
        variant: "destructive",
      });
      return;
    }

    if (!wallet.adapter.connected) {
      toast({
        title: "Wallet Not Connected",
        description: "Wallet is not connected. Please connect your wallet.",
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
        const programService = new SolanaProgramService();
      
      // Pass the original wallet object to maintain proper this context
      // Add publicKey to the wallet object for the service
      const walletObject = {
        ...wallet,
        publicKey: publicKey
      };
      
      let signature: string;
      
      if (formData.launchType === 'instant') {
        console.log('⚡ Creating instant launch...');
        const instantData = {
          name: formData.name,
          symbol: formData.symbol,
          description: formData.description,
          totalSupply: formData.totalSupply,
          decimals: formData.decimals,
          initialPrice: formData.initialPrice,
          liquidityAmount: formData.liquidityAmount,
          launchType: 'instant' as const,
          programId: 'Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU',
          walletAddress: publicKey.toString(),
        };
        signature = await programService.createInstantLaunch(walletObject, instantData);
      } else {
        console.log('🎫 Creating raffle launch...');
        const raffleData = {
          name: formData.name,
          symbol: formData.symbol,
          description: formData.description,
          totalSupply: formData.totalSupply,
          decimals: formData.decimals,
          ticketPrice: formData.ticketPrice,
          maxTickets: formData.maxTickets,
          raffleDuration: formData.raffleDuration,
          winnerCount: formData.winnerCount,
          launchType: 'raffle' as const,
          programId: 'Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU',
          walletAddress: publicKey.toString(),
        };
        signature = await programService.createRaffleLaunch(walletObject, raffleData);
      }
      
      console.log('✅ Launch created successfully! Signature:', signature);
      setTxSignature(signature);

      const launchTypeText = formData.launchType === 'instant' ? 'Instant Launch' : 'Raffle Launch';

      toast({
        title: `${launchTypeText} Created Successfully!`,
        description: `Your ${launchTypeText.toLowerCase()} has been created. Transaction: ${signature.slice(0, 8)}...`,
      });
      
    } catch (error) {
      console.error('❌ Error creating launch:', error);
      
      let errorMessage = "An unknown error occurred.";
      let errorTitle = "Launch Creation Failed";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide more specific error messages
        if (error.message.includes('Failed to serialize or deserialize account data')) {
          errorTitle = "Program Error";
          errorMessage = "The program couldn't process the instruction data. This usually means the instruction format or accounts don't match what the program expects.";
        } else if (error.message.includes('Insufficient funds')) {
          errorTitle = "Insufficient Funds";
          errorMessage = "You don't have enough SOL to pay for the transaction fees.";
        } else if (error.message.includes('User rejected')) {
          errorTitle = "Transaction Cancelled";
          errorMessage = "You cancelled the transaction in your wallet.";
        } else if (error.message.includes('Transaction failed')) {
          errorTitle = "Transaction Failed";
          errorMessage = `Transaction failed: ${error.message}`;
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
      launchType: '',
      name: '',
      symbol: '',
      description: '',
      totalSupply: 1000000,
      decimals: 9,
      initialPrice: 0.01,
      liquidityAmount: 10,
      ticketPrice: 0.1,
      maxTickets: 1000,
      raffleDuration: 24,
      winnerCount: 100,
      website: '',
      twitter: '',
      telegram: '',
      discord: ''
    });
    setTxSignature(null);
    setErrors({});
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 rounded-2xl border border-slate-800 p-8 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Rocket className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-slate-400 mb-6">
            Connect your Solana wallet to create and launch your token
          </p>
          <button
            onClick={() => {/* Wallet connection is handled by the wallet adapter */}}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
                Connect Wallet
          </button>
        </motion.div>
      </div>
    );
  }

  if (txSignature) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 rounded-2xl border border-green-500/20 p-8 max-w-lg w-full text-center"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Launch Successful! 🎉</h2>
          <p className="text-slate-400 mb-6">
            Your token has been created and is ready to go live
          </p>
          
          <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Transaction</span>
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 text-sm flex items-center"
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
              onClick={() => window.location.href = '/launches'}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              View Launch
            </button>
        </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      <Header 
        title="Create Launch"
        subtitle="Launch your token on Solana"
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
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Rocket className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Create Token Launch</h1>
          <p className="text-slate-400">Launch your token with instant liquidity or fair raffle distribution</p>
        </motion.div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                    index < currentStep ? 'bg-purple-600 text-white' :
                    index === currentStep ? 'bg-purple-600 text-white ring-4 ring-purple-600/30' :
                    'bg-slate-800 text-slate-500'
                  }`}>
                    {index < currentStep ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                  </div>
                  <span className="text-xs text-slate-400 mt-1 capitalize">{step}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`h-1 flex-1 mx-2 rounded ${
                    index < currentStep ? 'bg-purple-600' : 'bg-slate-800'
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
            {/* Step 0: Launch Type */}
            {STEPS[currentStep] === 'type' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Choose Your Launch Strategy</h2>
                  <p className="text-slate-400">Select the distribution method that fits your project</p>
            </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={() => updateFormData('launchType', 'instant')}
                    className={`relative p-6 rounded-xl border-2 transition-all text-left ${
                      formData.launchType === 'instant'
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mr-3">
                        <Zap className="w-6 h-6 text-yellow-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white">Instant Launch</h3>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">
                      Go live immediately with automated liquidity pools. Perfect for projects ready to trade right away.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { icon: Clock, text: 'Instant' },
                        { icon: DollarSign, text: 'Auto LP' },
                        { icon: Users, text: 'Open Access' },
                        { icon: Zap, text: 'Trade Now' }
                      ].map(({ icon: Icon, text }) => (
                        <div key={text} className="flex items-center text-slate-300">
                          <Icon className="w-3 h-3 mr-1" />
                          {text}
                        </div>
                      ))}
                    </div>
                  </button>

                  <button
                    onClick={() => updateFormData('launchType', 'raffle')}
                    className={`relative p-6 rounded-xl border-2 transition-all text-left ${
                      formData.launchType === 'raffle'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mr-3">
                        <Ticket className="w-6 h-6 text-purple-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white">Raffle Launch</h3>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">
                      Fair distribution through ticket-based system. Build community engagement with scheduled launches.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { icon: Calendar, text: 'Scheduled' },
                        { icon: Ticket, text: 'Tickets' },
                        { icon: Users, text: 'Community' },
                        { icon: Shield, text: 'Fair Launch' }
                      ].map(({ icon: Icon, text }) => (
                        <div key={text} className="flex items-center text-slate-300">
                          <Icon className="w-3 h-3 mr-1" />
                          {text}
                        </div>
                      ))}
                    </div>
                  </button>
                </div>

                {errors.launchType && (
                  <p className="text-red-400 text-sm flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.launchType}
                  </p>
                )}
                  </div>
            )}

            {/* Step 1: Basic Info */}
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
                        errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'
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
                        errors.symbol ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'
                      }`}
                    />
                    {errors.symbol && <p className="text-red-400 text-xs mt-1">{errors.symbol}</p>}
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
                      errors.description ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'
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
                        errors.totalSupply ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Config */}
            {STEPS[currentStep] === 'config' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {formData.launchType === 'instant' ? 'Instant Launch' : 'Raffle'} Configuration
                  </h2>
                  <p className="text-slate-400">Set up your launch parameters</p>
                </div>

                {formData.launchType === 'instant' ? (
                  <>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                      <div className="flex items-start">
                        <Info className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-yellow-200">
                          <p className="font-medium mb-1">Instant Launch Benefits:</p>
                          <ul className="space-y-1 text-yellow-200/80">
                            <li>• Token goes live immediately after creation</li>
                            <li>• Automated liquidity pool deployment</li>
                            <li>• Trading starts instantly</li>
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
                          step="0.001"
                          value={formData.initialPrice}
                          onChange={(e) => updateFormData('initialPrice', Number(e.target.value))}
                          className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                            errors.initialPrice ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'
                          }`}
                        />
                        {errors.initialPrice && <p className="text-red-400 text-xs mt-1">{errors.initialPrice}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Liquidity Amount (SOL) *
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.liquidityAmount}
                          onChange={(e) => updateFormData('liquidityAmount', Number(e.target.value))}
                          className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                            errors.liquidityAmount ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'
                          }`}
                        />
                        {errors.liquidityAmount && <p className="text-red-400 text-xs mt-1">{errors.liquidityAmount}</p>}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                      <div className="flex items-start">
                        <Info className="w-5 h-5 text-purple-400 mr-3 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-purple-200">
                          <p className="font-medium mb-1">Raffle Launch Benefits:</p>
                          <ul className="space-y-1 text-purple-200/80">
                            <li>• Fair distribution through ticket system</li>
                            <li>• Build community before launch</li>
                            <li>• Anti-bot protection built-in</li>
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
                          value={formData.ticketPrice}
                          onChange={(e) => updateFormData('ticketPrice', Number(e.target.value))}
                          className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                            errors.ticketPrice ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'
                          }`}
                        />
                        {errors.ticketPrice && <p className="text-red-400 text-xs mt-1">{errors.ticketPrice}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Maximum Tickets *
                        </label>
                        <input
                          type="number"
                          value={formData.maxTickets}
                          onChange={(e) => updateFormData('maxTickets', Number(e.target.value))}
                          className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                            errors.maxTickets ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'
                          }`}
                        />
                        {errors.maxTickets && <p className="text-red-400 text-xs mt-1">{errors.maxTickets}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Duration (Hours) *
                        </label>
                        <input
                          type="number"
                          value={formData.raffleDuration}
                          onChange={(e) => updateFormData('raffleDuration', Number(e.target.value))}
                          className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                            errors.raffleDuration ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'
                          }`}
                        />
                        {errors.raffleDuration && <p className="text-red-400 text-xs mt-1">{errors.raffleDuration}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Number of Winners *
                        </label>
                        <input
                        type="number"
                          value={formData.winnerCount}
                          onChange={(e) => updateFormData('winnerCount', Number(e.target.value))}
                          className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 ${
                            errors.winnerCount ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-purple-500'
                          }`}
                        />
                        {errors.winnerCount && <p className="text-red-400 text-xs mt-1">{errors.winnerCount}</p>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Social */}
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
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {STEPS[currentStep] === 'review' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Review Your Launch</h2>
                  <p className="text-slate-400">Double-check everything before submitting</p>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-700">
                    <span className="text-slate-400">Launch Type</span>
                    <div className={`flex items-center px-3 py-1 rounded-full ${
                      formData.launchType === 'instant' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {formData.launchType === 'instant' ? <Zap className="w-4 h-4 mr-1" /> : <Ticket className="w-4 h-4 mr-1" />}
                      <span className="font-medium capitalize">{formData.launchType}</span>
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

                  {formData.launchType === 'instant' && (
                    <div className="pt-4 border-t border-slate-700 grid md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-400 text-sm">Initial Price</span>
                        <p className="text-white font-medium">{formData.initialPrice} SOL</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-sm">Liquidity Amount</span>
                        <p className="text-white font-medium">{formData.liquidityAmount} SOL</p>
                      </div>
                    </div>
                  )}

                  {formData.launchType === 'raffle' && (
                    <div className="pt-4 border-t border-slate-700 grid md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-400 text-sm">Ticket Price</span>
                        <p className="text-white font-medium">{formData.ticketPrice} SOL</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-sm">Max Tickets</span>
                        <p className="text-white font-medium">{formData.maxTickets.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-sm">Duration</span>
                        <p className="text-white font-medium">{formData.raffleDuration} hours</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-sm">Winners</span>
                        <p className="text-white font-medium">{formData.winnerCount}</p>
                      </div>
                    </div>
                  )}

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

                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                  <div className="flex items-start">
                    <Info className="w-5 h-5 text-purple-400 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-purple-200">
                      <p className="font-medium mb-1">Ready to Launch?</p>
                      <p className="text-purple-200/80">
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
              className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
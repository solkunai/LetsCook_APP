import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { 
  ArrowLeft,
  ExternalLink,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  Ticket,
  Star,
  Heart,
  Share2,
  Globe,
  Twitter,
  MessageCircle,
  Hash,
  Copy,
  Eye,
  BarChart3,
  ShoppingCart,
  ArrowUpDown,
  Loader2,
  RefreshCw,
  Activity,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Info,
  ChevronDown,
  ChevronUp,
  Target,
  Award,
  Flame,
  Rocket
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { toast } from '@/hooks/use-toast';
import { launchDataService } from '@/lib/launchDataService';
import { LaunchData } from '@/lib/launchDataService';
import { realLaunchService } from '@/lib/realLaunchService';
import { marketDataService, MarketData } from '@/lib/marketDataService';
import Header from '@/components/Header';
import PriceChart from '@/components/PriceChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

interface LaunchDetailPageProps {
  launchId: string;
}

const LaunchDetailPage: React.FC<LaunchDetailPageProps> = ({ launchId }) => {
  const { connected, publicKey, signTransaction } = useWallet();
  const [launch, setLaunch] = useState<LaunchData | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Trading state
  const [tradingMode, setTradingMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('');
  const [tradingLoading, setTradingLoading] = useState(false);
  const [quotePrice, setQuotePrice] = useState<number | null>(null);
  const [estimatedOutput, setEstimatedOutput] = useState<number | null>(null);
  const [slippage, setSlippage] = useState(0.5);
  
  // Wallet balance state
  const [solBalance, setSolBalance] = useState<number>(0);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  
  // UI state
  const [activeTab, setActiveTab] = useState('overview');
  const [showTradingPanel, setShowTradingPanel] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [expandedStats, setExpandedStats] = useState(false);
  
  // Chart data state
  const [pieChartData, setPieChartData] = useState<any[]>([]);
  const [priceChartData, setPriceChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  useEffect(() => {
    fetchLaunchData();
    
    // Set up real-time data updates every 30 seconds
    const interval = setInterval(() => {
      if (launchId) {
        fetchMarketData();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [launchId]);

  const fetchLaunchData = async () => {
      try {
        setLoading(true);
        const launchData = await launchDataService.getLaunchById(launchId);
        if (launchData) {
          setLaunch(launchData);
        
        // AMM data will be fetched separately if needed
        // try {
        //   const ammData = await realLaunchService.getAMMData(
        //     new PublicKey(launchData.baseTokenMint),
        //     new PublicKey(launchData.quoteTokenMint)
        //   );
        //   setAmmData(ammData);
        // } catch (error) {
        //   console.log('No AMM data available yet');
        // }
        
        // Fetch market data
        await fetchMarketData();
        
        } else {
          setError('Launch not found');
        }
    } catch (error) {
      console.error('Error fetching launch:', error);
      setError('Failed to load launch data');
      } finally {
        setLoading(false);
      }
    };

  const fetchMarketData = async () => {
    try {
      if (!launch) return;
      
      const marketData = await marketDataService.getMarketData(launch.baseTokenMint, launch.totalSupply);
      setMarketData(marketData);
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'upcoming': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'ended': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live': return <CheckCircle2 className="w-4 h-4" />;
      case 'upcoming': return <Clock className="w-4 h-4" />;
      case 'ended': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  // Fetch wallet balances
  const fetchWalletBalances = async () => {
    if (!publicKey || !launch) return;
    
    setBalanceLoading(true);
    try {
      // Fetch SOL balance
      const solBalanceLamports = await connection.getBalance(publicKey);
      setSolBalance(solBalanceLamports / 1e9);
      
      // Fetch token balance
      try {
        const tokenMint = new PublicKey(launch.baseTokenMint);
        const userTokenAccount = await getAssociatedTokenAddressSync(
          tokenMint,
          publicKey,
          false
        );
        
        const tokenAccountInfo = await connection.getTokenAccountBalance(userTokenAccount);
        setTokenBalance(parseFloat(tokenAccountInfo.value.uiAmountString || '0'));
      } catch (error) {
        // Token account might not exist yet
        setTokenBalance(0);
        console.log('Token account not found, balance is 0');
      }
    } catch (error) {
      console.error('Error fetching wallet balances:', error);
    } finally {
      setBalanceLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price < 0.000001) return `${price.toExponential(2)} SOL`;
    if (price < 0.01) return `${price.toFixed(6)} SOL`;
    return `${price.toFixed(4)} SOL`;
  };

  const formatVolume = (volume: number) => {
    if (volume < 1000) return `$${volume.toFixed(2)}`;
    if (volume < 1000000) return `$${(volume / 1000).toFixed(2)}K`;
    return `$${(volume / 1000000).toFixed(2)}M`;
  };

  const formatLiquidity = (liquidity: number) => {
    if (liquidity < 1) return `${liquidity.toFixed(4)} SOL`;
    if (liquidity < 1000) return `${liquidity.toFixed(2)} SOL`;
    return `${(liquidity / 1000).toFixed(2)}K SOL`;
  };

  const formatTimeRemaining = (endDate: Date) => {
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const fetchQuote = async () => {
    if (!launch || !amount || parseFloat(amount) <= 0 || !publicKey) {
      setQuotePrice(null);
      setEstimatedOutput(null);
      return;
    }

    try {
      const inputMint = tradingMode === 'buy' 
        ? new PublicKey("So11111111111111111111111111111111111111112") 
        : new PublicKey(launch.baseTokenMint);
      const outputMint = tradingMode === 'buy' 
        ? new PublicKey(launch.baseTokenMint) 
        : new PublicKey("So11111111111111111111111111111111111111112");
      
      const dexProvider = launch.dexProvider === 0 ? 'cook' : 'raydium';
      
      const quote = await realLaunchService.getSwapQuote(
        inputMint,
        outputMint,
        parseFloat(amount),
        dexProvider
      );
      
      setQuotePrice(quote.price);
      setEstimatedOutput(quote.outputAmount);
    } catch (err) {
      console.error("Error fetching quote:", err);
      setQuotePrice(null);
      setEstimatedOutput(null);
    }
  };

  useEffect(() => {
    fetchQuote();
  }, [amount, tradingMode, launch]);

  const handleTrade = async () => {
    if (!connected || !publicKey || !signTransaction || !launch || !amount || parseFloat(amount) <= 0 || !quotePrice || !estimatedOutput) {
      toast({
        title: "Error",
        description: "Please connect your wallet, enter a valid amount, and ensure a quote is available.",
        variant: "destructive",
      });
      return;
    }

    setTradingLoading(true);
    try {
      const dexProvider = launch.dexProvider === 0 ? 'cook' : 'raydium';
      
      if (tradingMode === 'buy') {
        const result = await realLaunchService.buyTokensAMM(
          launch.baseTokenMint,
          publicKey.toBase58(),
          parseFloat(amount),
          signTransaction,
          dexProvider
        );
        
        if (result.success) {
          toast({
            title: "Buy Order Placed",
            description: `Successfully bought ${result.tokensReceived?.toFixed(6) || estimatedOutput.toFixed(6)} ${launch.symbol} tokens for ${amount} SOL.`,
          });
        } else {
          throw new Error(result.error || 'Failed to buy tokens');
        }
      } else {
        const result = await realLaunchService.sellTokensAMM(
          launch.baseTokenMint,
          publicKey.toBase58(),
          parseFloat(amount),
          signTransaction,
          dexProvider
        );
        
        if (result.success) {
          toast({
            title: "Sell Order Placed",
            description: `Successfully sold ${amount} ${launch.symbol} tokens for ${result.solReceived?.toFixed(6) || estimatedOutput.toFixed(6)} SOL.`,
          });
        } else {
          throw new Error(result.error || 'Failed to sell tokens');
        }
      }
      
      // Refresh launch data after trade
      await fetchLaunchData();
      setAmount('');
      setQuotePrice(null);
      setEstimatedOutput(null);
      
    } catch (error) {
      console.error('Trade error:', error);
      let errorMessage = "Failed to process trade.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTradingLoading(false);
    }
  };

  // Generate real pie chart data based on launch data
  const generatePieChartData = () => {
    if (!launch) return [];
    
    const totalSupply = launch.totalSupply;
    const soldTickets = launch.soldTickets;
    const remainingTickets = launch.maxTickets - soldTickets;
    const liquidityPool = launch.liquidity;
    const creatorReserve = totalSupply * 0.1; // 10% creator reserve
    
    return [
      { name: 'Sold Tickets', value: soldTickets, color: '#3b82f6' },
      { name: 'Remaining Tickets', value: remainingTickets, color: '#64748b' },
      { name: 'Liquidity Pool', value: liquidityPool, color: '#10b981' },
      { name: 'Creator Reserve', value: creatorReserve, color: '#f59e0b' },
    ].filter(item => item.value > 0);
  };

  // Generate real price chart data with historical simulation
  const generatePriceChartData = () => {
    if (!launch) return [];
    
    const basePrice = launch.currentPrice;
    const data = [];
    const now = new Date();
    
    // Generate 24 hours of data points
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hour = time.getHours();
      
      // Simulate realistic price movement based on trading activity
      let priceVariation = 0;
      
      // Higher volatility during active trading hours
      if (hour >= 9 && hour <= 17) {
        priceVariation = (Math.random() - 0.5) * 0.1; // ±5% during active hours
      } else {
        priceVariation = (Math.random() - 0.5) * 0.05; // ±2.5% during off hours
      }
      
      // Add some trending based on hype score
      const hypeFactor = launch.hypeScore / 100;
      priceVariation += (Math.random() - 0.5) * hypeFactor * 0.02;
      
      const price = basePrice * (1 + priceVariation);
      const volume = Math.random() * launch.volume24h * (0.5 + Math.random() * 0.5);
      
      data.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        price: Math.max(price, 0.0001), // Ensure positive price
        volume: volume,
        timestamp: time.getTime()
      });
    }
    
    return data;
  };

  // Load chart data when launch data changes
  useEffect(() => {
    if (launch) {
      setChartLoading(true);
      
      // Generate pie chart data
      const pieData = generatePieChartData();
      setPieChartData(pieData);
      
      // Generate price chart data
      const priceData = generatePriceChartData();
      setPriceChartData(priceData);
      
      setChartLoading(false);
    }
  }, [launch]);

  // Auto-fetch quotes when amount changes
  useEffect(() => {
    if (launch && amount && parseFloat(amount) > 0) {
      const timeoutId = setTimeout(() => {
        fetchQuote();
      }, 500); // Debounce for 500ms
      
      return () => clearTimeout(timeoutId);
    } else {
      setQuotePrice(null);
      setEstimatedOutput(null);
    }
  }, [amount, tradingMode, launch]);

  // Fetch wallet balances when publicKey or launch changes
  useEffect(() => {
    if (publicKey && launch) {
      fetchWalletBalances();
    }
  }, [publicKey, launch]);

  // Auto-refresh balances every 30 seconds
  useEffect(() => {
    if (!publicKey || !launch) return;
    
    const interval = setInterval(() => {
      fetchWalletBalances();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [publicKey, launch]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading launch details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !launch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Launch Not Found</h2>
            <p className="text-slate-400 mb-4">{error || 'The requested launch could not be found.'}</p>
            <Button onClick={() => window.history.back()} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <Header />
      
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-yellow-500/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <Button 
            onClick={() => window.history.back()}
              variant="ghost" 
              className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Launches
            </Button>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFavorited(!isFavorited)}
                className="text-slate-400 hover:text-yellow-400"
              >
                <Heart className={`w-4 h-4 ${isFavorited ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(window.location.href)}
                className="text-slate-400 hover:text-white"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Token Header */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                      {launch.image ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden">
                          <img 
                            src={launch.image} 
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center">
                          <span className="text-2xl font-bold text-slate-900">
                        {launch.symbol.charAt(0)}
                      </span>
                    </div>
                      )}
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">
                          {launch.name}
                        </h1>
                        <div className="flex items-center space-x-3">
                          <Badge className={`${getStatusColor(launch.status)} border`}>
                            {getStatusIcon(launch.status)}
                            <span className="ml-1 capitalize">{launch.status}</span>
                          </Badge>
                          <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                            {launch.dexProvider === 0 ? 'Cook DEX' : 'Raydium'}
                          </Badge>
                        {launch.verified && (
                            <Badge variant="outline" className="border-green-500/30 text-green-400">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white mb-1">
                        {formatPrice(launch.currentPrice)}
                      </div>
                      <div className={`flex items-center text-sm ${
                        launch.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {launch.priceChange24h >= 0 ? (
                          <TrendingUpIcon className="w-4 h-4 mr-1" />
                        ) : (
                          <TrendingDownIcon className="w-4 h-4 mr-1" />
                        )}
                        {Math.abs(launch.priceChange24h).toFixed(2)}%
                      </div>
                  </div>
                </div>

                  <div className="mb-6">
                    <p className="text-slate-300 text-lg leading-relaxed mb-4">
                      Token launch for {launch.name} ({launch.symbol}).
                    </p>
                    <div className="flex items-center space-x-2 p-3 bg-slate-700/50 rounded-lg">
                      <span className="text-slate-400 text-sm">Contract:</span>
                      <code className="text-slate-300 font-mono text-sm flex-1">
                        {launch.launchDataAccount}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(launch.launchDataAccount)}
                        className="text-slate-400 hover:text-white"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                  </div>
                </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">Market Cap</div>
                      <div className="text-lg font-semibold text-white">
                        {marketData ? `$${marketData.marketCap.toLocaleString()}` : formatVolume(launch.marketCap)}
                      </div>
                      {marketData && (
                        <div className={`text-xs flex items-center justify-center ${
                          marketData.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {marketData.priceChange24h >= 0 ? (
                            <TrendingUp className="w-3 h-3 mr-1" />
                          ) : (
                            <TrendingDown className="w-3 h-3 mr-1" />
                          )}
                          {Math.abs(marketData.priceChange24h).toFixed(2)}%
                        </div>
                      )}
                    </div>
                    <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">24h Volume</div>
                      <div className="text-lg font-semibold text-white">
                        {marketData ? `${marketData.volume24h.toFixed(0)} SOL` : formatVolume(launch.volume24h)}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">Liquidity</div>
                      <div className="text-lg font-semibold text-white">
                        {marketData ? `${marketData.liquidity.toFixed(0)} SOL` : formatLiquidity(launch.liquidity)}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">Holders</div>
                      <div className="text-lg font-semibold text-yellow-400 flex items-center justify-center">
                        <Users className="w-4 h-4 mr-1" />
                        {marketData ? marketData.holders : launch.hypeScore}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Modern Trading Panel */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border border-slate-700/50 p-8 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-slate-900" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Trade {launch.symbol}</h2>
                      <p className="text-slate-400">Buy and sell instantly</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-4 py-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                      Live
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTradingPanel(!showTradingPanel)}
                      className="text-slate-400 hover:text-white p-2"
                    >
                      {showTradingPanel ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>

                {/* Trading Interface */}
                <div className="space-y-6">
                  {/* Buy/Sell Toggle */}
                  <div className="flex bg-slate-800/50 rounded-2xl p-2">
                    <button
                      onClick={() => setTradingMode('buy')}
                      className={`flex-1 flex items-center justify-center py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
                        tradingMode === 'buy'
                          ? 'bg-green-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <TrendingUp className="w-5 h-5 mr-2" />
                      Buy
                    </button>
                    <button
                      onClick={() => setTradingMode('sell')}
                      className={`flex-1 flex items-center justify-center py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
                        tradingMode === 'sell'
                          ? 'bg-red-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <TrendingDown className="w-5 h-5 mr-2" />
                      Sell
                    </button>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 font-medium text-lg">
                        Amount ({tradingMode === 'buy' ? 'SOL' : launch.symbol})
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchQuote}
                        disabled={!amount || parseFloat(amount) <= 0}
                        className="text-slate-400 hover:text-white p-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="relative">
                      <input
                        type="number"
                        step="0.000001"
                        placeholder={`0.00 ${tradingMode === 'buy' ? 'SOL' : launch.symbol}`}
                        value={amount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            setAmount('');
                            return;
                          }
                          const numericValue = parseFloat(value);
                          if (!isNaN(numericValue) && numericValue >= 0) {
                            setAmount(value);
                          }
                        }}
                        className="w-full bg-slate-800/50 border border-slate-600 rounded-2xl text-white placeholder-slate-500 text-xl py-6 px-6 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                      />
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <span className="text-slate-400 text-sm font-medium">
                          {tradingMode === 'buy' ? 'SOL' : launch.symbol}
                        </span>
                      </div>
                    </div>

                    {/* Quick Amount Buttons */}
                    <div className="flex space-x-2">
                      {tradingMode === 'buy' ? (
                        <>
                          <button
                            onClick={() => setAmount((solBalance * 0.25).toFixed(4))}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                          >
                            25%
                          </button>
                          <button
                            onClick={() => setAmount((solBalance * 0.5).toFixed(4))}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                          >
                            50%
                          </button>
                          <button
                            onClick={() => setAmount((solBalance * 0.75).toFixed(4))}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                          >
                            75%
                          </button>
                          <button
                            onClick={() => setAmount(solBalance.toFixed(4))}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                          >
                            Max
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setAmount((tokenBalance * 0.25).toFixed(2))}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                          >
                            25%
                          </button>
                          <button
                            onClick={() => setAmount((tokenBalance * 0.5).toFixed(2))}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                          >
                            50%
                          </button>
                          <button
                            onClick={() => setAmount((tokenBalance * 0.75).toFixed(2))}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                          >
                            75%
                          </button>
                          <button
                            onClick={() => setAmount(tokenBalance.toFixed(2))}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                          >
                            Max
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Wallet Balances */}
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 border border-blue-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-blue-400 font-semibold text-lg">Your Wallet</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchWalletBalances}
                        disabled={balanceLoading}
                        className="text-blue-400 hover:text-white p-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${balanceLoading ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-800/50 rounded-xl p-4">
                        <div className="text-slate-400 text-sm mb-1">SOL Balance</div>
                        <div className="text-white font-bold text-lg">
                          {balanceLoading ? 'Loading...' : publicKey ? `${solBalance.toFixed(4)} SOL` : 'Not connected'}
                        </div>
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-4">
                        <div className="text-slate-400 text-sm mb-1">{launch.symbol} Balance</div>
                        <div className="text-white font-bold text-lg">
                          {balanceLoading ? 'Loading...' : publicKey ? `${tokenBalance.toFixed(2)} ${launch.symbol}` : 'Not connected'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Market Info */}
                  <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-2xl p-6">
                    <h3 className="text-slate-300 font-semibold text-lg mb-4">Market Information</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-slate-400 text-sm mb-1">Current Price</div>
                        <div className="text-white font-bold text-xl">{formatPrice(launch.currentPrice)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-400 text-sm mb-1">Market Cap</div>
                        <div className="text-slate-300 font-semibold">{formatVolume(launch.marketCap)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-400 text-sm mb-1">Liquidity</div>
                        <div className="text-slate-300 font-semibold">{formatLiquidity(launch.liquidity)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Quote Preview */}
                  {quotePrice && estimatedOutput && amount && parseFloat(amount) > 0 && (
                    <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl p-6 border border-yellow-500/30">
                      <h3 className="text-yellow-400 font-semibold text-lg mb-4">Trade Preview</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">You {tradingMode === 'buy' ? 'pay' : 'sell'}:</span>
                          <span className="text-white font-bold text-lg">
                            {amount} {tradingMode === 'buy' ? 'SOL' : launch.symbol}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">You {tradingMode === 'buy' ? 'receive' : 'get'}:</span>
                          <span className="text-yellow-400 font-bold text-xl">
                            {estimatedOutput.toFixed(6)} {tradingMode === 'buy' ? launch.symbol : 'SOL'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">Effective Price:</span>
                          <span className="text-slate-300">{formatPrice(quotePrice)} SOL</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">Slippage:</span>
                          <span className="text-slate-300">
                            {((quotePrice - launch.currentPrice) / launch.currentPrice * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Trade Button */}
                  <button
                    onClick={handleTrade}
                    disabled={!connected || !amount || tradingLoading}
                    className={`w-full py-6 px-8 rounded-2xl font-bold text-xl transition-all transform ${
                      tradingMode === 'buy'
                        ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-2xl hover:shadow-green-500/30'
                        : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-2xl hover:shadow-red-500/30'
                    } ${
                      !connected || !amount || tradingLoading
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:scale-105'
                    }`}
                  >
                    {tradingLoading ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        {tradingMode === 'buy' ? (
                          <TrendingUp className="w-6 h-6 mr-3" />
                        ) : (
                          <TrendingDown className="w-6 h-6 mr-3" />
                        )}
                        {tradingMode === 'buy' ? 'Buy' : 'Sell'} {launch.symbol}
                      </div>
                    )}
                  </button>

                  {!connected && (
                    <div className="text-center p-4 bg-slate-800/50 rounded-xl">
                      <p className="text-slate-400 text-lg">
                        Please connect your wallet to start trading
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Chart */}
              <PriceChart 
                tokenMint={launch.baseTokenMint}
                initialPrice={launch.initialPrice}
                className="mb-6"
              />

              {/* Detailed Information */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 bg-slate-700">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="stats">Statistics</TabsTrigger>
                  <TabsTrigger value="social">Social</TabsTrigger>
                  <TabsTrigger value="contract">Contract</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6">
                  <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="grid md:grid-cols-2 gap-6">
                  <div>
                          <h3 className="text-lg font-semibold text-white mb-4">Launch Details</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Launch Type:</span>
                              <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                                {launch.launchType === 'instant' ? 'Instant' : 'Raffle'}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total Supply:</span>
                              <span className="text-white">{launch.totalSupply.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Decimals:</span>
                              <span className="text-white">{launch.decimals}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Participants:</span>
                              <span className="text-white">{launch.participants.toLocaleString()}</span>
                            </div>
                          </div>
                  </div>
                  
                  <div>
                          <h3 className="text-lg font-semibold text-white mb-4">Raffle Information</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Ticket Price:</span>
                              <span className="text-white">{launch.ticketPrice} SOL</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Max Tickets:</span>
                              <span className="text-white">{launch.maxTickets.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Sold Tickets:</span>
                              <span className="text-white">{launch.soldTickets.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Winners:</span>
                              <span className="text-white">{launch.winnerCount}</span>
                            </div>
                  </div>
                  </div>
                </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="stats" className="mt-6">
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Price Chart */}
                    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="text-lg text-white flex items-center">
                          <BarChart3 className="w-5 h-5 mr-2 text-yellow-400" />
                          Price Chart (24h)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {chartLoading ? (
                          <div className="h-64 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
                          </div>
                        ) : (
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={priceChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis 
                                  dataKey="time" 
                                  stroke="#9ca3af"
                                  fontSize={12}
                                />
                                <YAxis 
                                  stroke="#9ca3af"
                                  fontSize={12}
                                  domain={['dataMin * 0.95', 'dataMax * 1.05']}
                                />
                                <Tooltip 
                                  contentStyle={{
                                    backgroundColor: '#1e293b',
                                    border: '1px solid #475569',
                                    borderRadius: '8px',
                                    color: '#f1f5f9'
                                  }}
                                  formatter={(value: any, name: string) => [
                                    name === 'price' ? `$${value.toFixed(6)}` : `${value.toFixed(2)}`,
                                    name === 'price' ? 'Price' : 'Volume'
                                  ]}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="price" 
                                  stroke="#f59e0b" 
                                  strokeWidth={2}
                                  dot={false}
                                  activeDot={{ r: 4, fill: '#f59e0b' }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Token Distribution Pie Chart */}
                    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="text-lg text-white flex items-center">
                          <PieChart className="w-5 h-5 mr-2 text-yellow-400" />
                          Token Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {chartLoading ? (
                          <div className="h-64 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
                          </div>
                        ) : (
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieChartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={40}
                                  outerRadius={80}
                                  paddingAngle={2}
                                  dataKey="value"
                                >
                                  {pieChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  contentStyle={{
                                    backgroundColor: '#1e293b',
                                    border: '1px solid #475569',
                                    borderRadius: '8px',
                                    color: '#f1f5f9'
                                  }}
                                  formatter={(value: any, name: string) => [
                                    `${value.toLocaleString()}`,
                                    name
                                  ]}
                                />
                                <Legend 
                                  wrapperStyle={{ color: '#f1f5f9', fontSize: '12px' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Market Statistics */}
                  <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm mt-6">
                    <CardHeader>
                      <CardTitle className="text-lg text-white flex items-center">
                        <Activity className="w-5 h-5 mr-2 text-yellow-400" />
                        Market Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-slate-700/50 rounded-lg">
                          <div className="text-sm text-slate-400 mb-1">Market Cap</div>
                          <div className="text-lg font-semibold text-white">
                            {formatVolume(launch.marketCap)}
                          </div>
                        </div>
                        <div className="p-4 bg-slate-700/50 rounded-lg">
                          <div className="text-sm text-slate-400 mb-1">Volume (24h)</div>
                          <div className="text-lg font-semibold text-white">
                            {formatVolume(launch.volume24h)}
                          </div>
                        </div>
                        <div className="p-4 bg-slate-700/50 rounded-lg">
                          <div className="text-sm text-slate-400 mb-1">Liquidity</div>
                          <div className="text-lg font-semibold text-white">
                            {formatLiquidity(launch.liquidity)}
                          </div>
                        </div>
                        <div className="p-4 bg-slate-700/50 rounded-lg">
                          <div className="text-sm text-slate-400 mb-1">Hype Score</div>
                          <div className="text-lg font-semibold text-yellow-400 flex items-center">
                            <Flame className="w-4 h-4 mr-1" />
                            {launch.hypeScore}/100
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6">
                        <div className="flex justify-between mb-2">
                          <span className="text-slate-400">Price Change (24h)</span>
                          <span className={`font-semibold ${
                            launch.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {launch.priceChange24h >= 0 ? '+' : ''}{launch.priceChange24h.toFixed(2)}%
                          </span>
                        </div>
                        <Progress 
                          value={Math.abs(launch.priceChange24h)} 
                          className="h-2"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="social" className="mt-6">
                  <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-4">Social Links</h3>
                          <div className="space-y-3">
                            {launch.website && (
                              <Button
                                variant="outline"
                                className="w-full justify-start border-slate-600 text-slate-300 hover:text-white"
                                onClick={() => window.open(launch.website, '_blank')}
                              >
                                <Globe className="w-4 h-4 mr-2" />
                                Website
                                <ExternalLink className="w-3 h-3 ml-auto" />
                              </Button>
                            )}
                            {launch.twitter && (
                              <Button
                                variant="outline"
                                className="w-full justify-start border-slate-600 text-slate-300 hover:text-white"
                                onClick={() => window.open(launch.twitter, '_blank')}
                              >
                                <Twitter className="w-4 h-4 mr-2" />
                                Twitter
                                <ExternalLink className="w-3 h-3 ml-auto" />
                              </Button>
                            )}
                            {launch.telegram && (
                              <Button
                                variant="outline"
                                className="w-full justify-start border-slate-600 text-slate-300 hover:text-white"
                                onClick={() => window.open(launch.telegram, '_blank')}
                              >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Telegram
                                <ExternalLink className="w-3 h-3 ml-auto" />
                              </Button>
                            )}
                            {launch.discord && (
                              <Button
                                variant="outline"
                                className="w-full justify-start border-slate-600 text-slate-300 hover:text-white"
                                onClick={() => window.open(launch.discord, '_blank')}
                              >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Discord
                                <ExternalLink className="w-3 h-3 ml-auto" />
                              </Button>
              )}
            </div>
                  </div>
                  
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-4">Community</h3>
                          <div className="space-y-4">
                            <div className="p-4 bg-slate-700/50 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-400">Participants</span>
                                <Users className="w-4 h-4 text-blue-400" />
                              </div>
                              <div className="text-2xl font-bold text-white">
                                {launch.participants.toLocaleString()}
                              </div>
                  </div>
                  
                            <div className="p-4 bg-slate-700/50 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-400">Hype Score</span>
                                <Rocket className="w-4 h-4 text-yellow-400" />
                  </div>
                              <div className="text-2xl font-bold text-yellow-400">
                                {launch.hypeScore}/100
                  </div>
                </div>
                  </div>
                  </div>
                </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="contract" className="mt-6">
                  <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                  <div>
                          <Label className="text-slate-300 mb-2 block">Launch Account</Label>
                          <div className="flex items-center space-x-2 p-3 bg-slate-700/50 rounded-lg">
                            <code className="text-slate-300 font-mono text-sm flex-1">
                              {launch.launchDataAccount}
                      </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(launch.launchDataAccount)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                    </div>
                  </div>
                  
                  <div>
                          <Label className="text-slate-300 mb-2 block">Token Mint</Label>
                          <div className="flex items-center space-x-2 p-3 bg-slate-700/50 rounded-lg">
                            <code className="text-slate-300 font-mono text-sm flex-1">
                              {launch.baseTokenMint}
                      </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(launch.baseTokenMint)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                    </div>
                  </div>
                  
                  <div>
                          <Label className="text-slate-300 mb-2 block">Quote Token Mint</Label>
                          <div className="flex items-center space-x-2 p-3 bg-slate-700/50 rounded-lg">
                            <code className="text-slate-300 font-mono text-sm flex-1">
                              {launch.quoteTokenMint}
                      </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(launch.quoteTokenMint)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                    </div>
                  </div>
                </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => setShowTradingPanel(!showTradingPanel)}
                    className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-slate-900 font-semibold"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                  Trade {launch.symbol}
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:text-white"
                    onClick={() => copyToClipboard(window.location.href)}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Launch
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:text-white"
                    onClick={() => setIsFavorited(!isFavorited)}
                  >
                    <Heart className={`w-4 h-4 mr-2 ${isFavorited ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    {isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
                  </Button>
                </CardContent>
              </Card>

              {/* Launch Information */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-white flex items-center">
                    <Rocket className="w-5 h-5 mr-2 text-blue-400" />
                    Launch Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <div>
                          <div className="text-sm text-white">Launched</div>
                          <div className="text-xs text-slate-400">
                            {launch.launchDate.toLocaleDateString()} at {launch.launchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                        Live
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="text-sm text-white">Status</div>
                        <div className="text-xs text-slate-400 capitalize">
                          {launch.status} • {launch.launchType} launch
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* DEX Information */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-white flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-yellow-400" />
                    DEX Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Provider:</span>
                      <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                        {launch.dexProvider === 0 ? 'Cook DEX' : 'Raydium'}
                      </Badge>
                  </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fee:</span>
                    <span className="text-white">
                        {launch.dexProvider === 0 ? '0.25%' : '0.30%'}
                    </span>
                  </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Liquidity:</span>
                      <span className="text-white">{formatVolume(launch.liquidity)}</span>
                </div>
                </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaunchDetailPage;
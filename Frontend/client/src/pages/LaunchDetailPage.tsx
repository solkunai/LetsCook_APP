import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Rocket,
  Lock,
  Shield,
  Coins,
  Wallet,
  TrendingUp as TrendingUpIcon2
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { launchDataService } from '@/lib/launchDataService';
import { LaunchData } from '@/lib/launchDataService';
import { realLaunchService } from '@/lib/realLaunchService';
import { marketDataService, MarketData } from '@/lib/marketDataService';
import Header from '@/components/Header';
import PriceChart from '@/components/PriceChart';
import CandlestickChart from '@/components/CandlestickChart';
import MarketCapChart from '@/components/MarketCapChart';
import LiquidityLockBadge, { LiquidityLockInfo } from '@/components/LiquidityLockBadge';
import BondingCurveProgress from '@/components/BondingCurveProgress';
import { marketCapService, MarketCapData } from '@/lib/marketCapService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { DegenTradingPanel } from '@/components/DegenTradingPanel';
import { BondingCurveChart } from '@/components/BondingCurveChart';
import { DegenProgressBar } from '@/components/DegenProgressBar';
import { bondingCurveService } from '@/lib/bondingCurveService';
import { formatTokenAmount, formatLargeNumber } from '@/lib/largeNumberFormatter';

interface LaunchDetailPageProps {
  launchId: string;
}

const LaunchDetailPage: React.FC<LaunchDetailPageProps> = ({ launchId }) => {
  const { connected, publicKey, signTransaction } = useWallet();
  const [launch, setLaunch] = useState<LaunchData | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenImageUrl, setTokenImageUrl] = useState<string | null>(null);
  
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
  
  // Liquidity lock state
  const [liquidityLockInfo, setLiquidityLockInfo] = useState<LiquidityLockInfo>({
    isLocked: false
  });

  // Refresh trigger for BondingCurveProgress component
  const [bondingCurveRefreshTrigger, setBondingCurveRefreshTrigger] = useState(0);

  // Bonding curve data state
  const [bondingCurveData, setBondingCurveData] = useState<{
    solReserves: number;
    tokenReserves: number;
    initialPrice: number;
    tokensSold: number;
    currentBondingPrice: number;
  }>({
    solReserves: 0,
    tokenReserves: 0,
    initialPrice: 0,
    tokensSold: 0,
    currentBondingPrice: 0
  });

  // SOL price in USD for conversions
  const [solPriceUSD, setSolPriceUSD] = useState<number>(150);

  // Real-time liquidity state
  const [realLiquidity, setRealLiquidity] = useState<number | null>(null);

  // Actual token decimals
  const [tokenDecimals, setTokenDecimals] = useState<number>(9);
  
  // Trading state
  const [isTrading, setIsTrading] = useState(false);

  // Market cap data state
  const [marketCapData, setMarketCapData] = useState<MarketCapData | null>(null);
  const [isLoadingMarketCap, setIsLoadingMarketCap] = useState(false);
  const [candlestickData, setCandlestickData] = useState<Array<{
    time: string;
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>>([]);

  // Load data on mount
  useEffect(() => {
    let isMounted = true;
    let marketDataInterval: NodeJS.Timeout | null = null;
    let priceInterval: NodeJS.Timeout | null = null;

    const loadData = async () => {
      if (!isMounted) return;
      
      const { launchCacheService } = await import('@/lib/launchCacheService');
      const cached = await launchCacheService.getLaunch(launchId);
      
      if (cached && isMounted) {
        setLaunch(cached.launch);
        if (cached.marketData) {
          setMarketData(cached.marketData);
        }
        if (cached.bondingCurveData) {
          setBondingCurveData(cached.bondingCurveData);
        }
        if (cached.liquidityLockInfo) {
          setLiquidityLockInfo(cached.liquidityLockInfo as any);
        }
        setLoading(false);
      } else {
        await fetchLaunchData();
      }
      
      if (isMounted) {
        // Refresh market data every 30 seconds
        marketDataInterval = setInterval(async () => {
          if (isMounted && launchId) {
            await fetchMarketData();
          }
        }, 30000);
        
        // Refresh current price from Supabase every 2 seconds (faster updates)
        priceInterval = setInterval(async () => {
          if (isMounted && launch?.baseTokenMint) {
            try {
              const { LaunchMetadataService } = await import('@/lib/launchMetadataService');
              const metadata = await LaunchMetadataService.getMetadataByTokenMint(launch.baseTokenMint);
              if (metadata) {
                // Update bonding curve data with latest from Supabase
                if (metadata.current_price !== undefined && metadata.current_price !== null && metadata.current_price > 0) {
                  setBondingCurveData(prev => ({
                    ...prev,
                    currentBondingPrice: metadata.current_price!,
                    tokensSold: metadata.tokens_sold ?? prev.tokensSold,
                    solReserves: metadata.pool_sol_balance ?? prev.solReserves
                  }));
                }
              }
            } catch (error) {
              // Silent fail - will refresh on next market data fetch
            }
          }
        }, 2000); // Every 2 seconds
      }
    };

    loadData();
    
    return () => {
      isMounted = false;
      if (marketDataInterval) {
        clearInterval(marketDataInterval);
      }
      if (priceInterval) {
        clearInterval(priceInterval);
      }
    };
  }, [launchId, launch?.baseTokenMint]);

  // Fetch launch data
  const fetchLaunchData = async () => {
    try {
      setLoading(true);
      const launchData = await launchDataService.getLaunchById(launchId);
      
      if (launchData) {
        // Load metadata
        try {
          const { LaunchMetadataService } = await import('@/lib/launchMetadataService');
          const metadata = await LaunchMetadataService.getMetadata(launchId);
          if (metadata) {
            if (metadata.name) launchData.name = metadata.name;
            if (metadata.symbol) launchData.symbol = metadata.symbol;
            if (metadata.image) {
              launchData.image = metadata.image;
              setTokenImageUrl(metadata.image);
            }
          }
        } catch (error) {
          // Could not load metadata
        }
        
        setLaunch(launchData);
        await fetchMarketData();
        await fetchLiquidityLockInfo();
      } else {
        setError('Launch not found');
      }
    } catch (error) {
      // Error fetching launch
      setError('Failed to load launch data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch market data
  const fetchMarketData = async () => {
    if (!launch) return;
    
    try {
      const marketDataResult = await marketDataService.getMarketData(launch.baseTokenMint);
      if (marketDataResult) {
        setMarketData(marketDataResult);
      }
      
      // Fetch AMM pool data for liquidity
      const ammData = await marketDataService.getAMMAccountData(launch.baseTokenMint);
      if (ammData) {
        const calculatedLiquidity = ammData.solReserves > 0 ? ammData.solReserves * 2 : 0;
        setRealLiquidity(calculatedLiquidity);
      }
      
      // Update bonding curve data for instant launches
      // PRIORITY: Fetch from Supabase first (source of truth), then fallback to blockchain
      if (launch.launchType === 'instant') {
        const { LaunchMetadataService } = await import('@/lib/launchMetadataService');
        const { bondingCurveService } = await import('@/lib/bondingCurveService');
        
        // STEP 1: Try to get latest state from Supabase (always up-to-date after trades)
        let latestTokensSold = 0;
        let latestCurrentPrice = 0;
        let latestPoolSolBalance = 0;
        
        try {
          const metadata = await LaunchMetadataService.getMetadataByTokenMint(launch.baseTokenMint);
          if (metadata) {
            if (metadata.tokens_sold !== undefined && metadata.tokens_sold !== null) {
              latestTokensSold = metadata.tokens_sold;
            }
            if (metadata.current_price !== undefined && metadata.current_price !== null && metadata.current_price > 0) {
              latestCurrentPrice = metadata.current_price;
            }
            if (metadata.pool_sol_balance !== undefined && metadata.pool_sol_balance !== null) {
              latestPoolSolBalance = metadata.pool_sol_balance;
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not fetch latest state from Supabase, using blockchain data:', error);
        }
        
        // STEP 2: Fallback to blockchain calculation if Supabase doesn't have data
        if (latestTokensSold === 0 || latestCurrentPrice === 0) {
          const tokenReserves = ammData?.tokenReserves || 0;
          const actualTokensSold = tokenReserves > 0 
            ? Math.max(0, launch.totalSupply - tokenReserves)
            : 0;
          
          if (latestTokensSold === 0) {
            latestTokensSold = actualTokensSold;
          }
          
          const bondingCurveConfig = {
            totalSupply: launch.totalSupply,
            decimals: launch.decimals || 9,
            curveType: 'linear' as const,
          };
          
          // Calculate current price using bonding curve if not from Supabase
          if (latestCurrentPrice === 0) {
            latestCurrentPrice = bondingCurveService.calculatePrice(latestTokensSold, bondingCurveConfig);
          }
        }
        
        // STEP 3: Use pool_sol_balance from Supabase if available, otherwise from AMM data
        if (latestPoolSolBalance === 0 && ammData?.solReserves) {
          latestPoolSolBalance = ammData.solReserves;
        }
        
        const initialPriceCalc = bondingCurveService.calculateInitialPrice({
          totalSupply: launch.totalSupply,
          decimals: launch.decimals || 9,
          curveType: 'linear' as const
        });
        
        // Ensure we have a valid price (use initial price if calculated price is 0)
        const validCurrentPrice = latestCurrentPrice > 0 ? latestCurrentPrice : initialPriceCalc;
        
        // Calculate token reserves from tokens sold
        const tokenReserves = Math.max(0, launch.totalSupply - latestTokensSold);
        
        setBondingCurveData({
          solReserves: latestPoolSolBalance || ammData?.solReserves || 0,
          tokenReserves: tokenReserves,
          initialPrice: initialPriceCalc,
          tokensSold: latestTokensSold,
          currentBondingPrice: validCurrentPrice
        });
      }
      
      await fetchMarketCapData();
    } catch (error) {
      // Error fetching market data
    }
  };

  // Fetch market cap data
  const fetchMarketCapData = async () => {
    if (!launch) return;

    try {
      setIsLoadingMarketCap(true);
      const capData = await marketCapService.getMarketCap(
        launch.baseTokenMint,
        launch.totalSupply
      );
      setMarketCapData(capData);
    } catch (error) {
      // Error fetching market cap
    } finally {
      setIsLoadingMarketCap(false);
    }
  };

  // Fetch liquidity lock information
  const fetchLiquidityLockInfo = async () => {
    try {
      if (!launch) return;
      
      const { onChainEventsService } = await import('@/lib/onChainEventsService');
      const lockEvents = await onChainEventsService.loadEvents(launch.baseTokenMint, 'liquidity_lock');
      
      if (lockEvents && lockEvents.length > 0) {
        const latestLock = lockEvents[lockEvents.length - 1];
        const unlockDate = new Date(latestLock.unlockDate * 1000);
        const now = new Date();
        
        if (unlockDate > now) {
          setLiquidityLockInfo({
            isLocked: true,
            lockAddress: latestLock.lockAddress,
            unlockDate: unlockDate,
            lockDuration: latestLock.lockDuration / (24 * 60 * 60),
            lockedAmount: latestLock.lockedAmount,
            lpTokenMint: latestLock.lpTokenMint
          });
        } else {
          setLiquidityLockInfo({ isLocked: false });
        }
      } else {
        setLiquidityLockInfo({ isLocked: false });
      }
    } catch (error) {
      // Error fetching liquidity lock info
      setLiquidityLockInfo({ isLocked: false });
    }
  };

  // Fetch wallet balances
  const fetchWalletBalances = async () => {
    if (!publicKey || !launch) return;
    
    setBalanceLoading(true);
    try {
      const { getConnection } = await import('@/lib/connection');
      const connection = getConnection('confirmed');
      
      const solBal = await connection.getBalance(publicKey);
      setSolBalance(solBal / 1e9);
      
      const mintInfo = await connection.getAccountInfo(new PublicKey(launch.baseTokenMint));
      const isToken2022 = mintInfo?.owner.toBase58() === TOKEN_2022_PROGRAM_ID.toBase58();
      const tokenProgram = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      
      const tokenAccount = getAssociatedTokenAddressSync(
        new PublicKey(launch.baseTokenMint),
        publicKey,
        false,
        tokenProgram
      );
      
      const accountInfo = await connection.getAccountInfo(tokenAccount);
      if (accountInfo && accountInfo.data.length > 0) {
        const amount = accountInfo.data.readBigUInt64LE(64);
        setTokenBalance(Number(amount) / 1e9);
      } else {
        setTokenBalance(0);
      }
    } catch (error) {
      setSolBalance(0);
      setTokenBalance(0);
    } finally {
      setBalanceLoading(false);
    }
  };

  // Fetch SOL price
  useEffect(() => {
    const fetchSOLPrice = async () => {
      try {
        const { pythPriceService } = await import('@/lib/pythPriceService');
        const price = await pythPriceService.getSOLPrice();
        if (price && price > 0) {
          setSolPriceUSD(price);
        }
      } catch (error) {
        // Could not fetch SOL price
      }
    };
    fetchSOLPrice();
  }, []);

  // Fetch wallet balances when connected
  useEffect(() => {
    if (publicKey && launch) {
      fetchWalletBalances();
    }
  }, [publicKey, launch]);

  // Handle buy tokens
  const handleBuy = async (solAmount: number) => {
    if (!publicKey || !launch || !signTransaction) {
      toast({
        title: "Error",
        description: "Please connect your wallet to trade",
        variant: "destructive",
      });
      return;
    }

    setIsTrading(true);
    try {
      const { getConnection } = await import('@/lib/connection');
      const connection = getConnection('confirmed');
      const { TradingService } = await import('@/lib/tradingService');
      const service = new TradingService(connection);
      
      const dexProvider = launch.dexProvider === 0 ? 'cook' : 'raydium';
      const result = await service.buyTokensAMM(
        launch.baseTokenMint,
        publicKey.toBase58(),
        solAmount,
        signTransaction,
        dexProvider
      );

      if (result.success) {
        toast({
          title: "Success!",
          description: `Successfully bought tokens. Transaction: ${result.signature?.slice(0, 8)}...`,
        });
        // Refresh data
        await fetchMarketData();
        await fetchWalletBalances();
        setBondingCurveRefreshTrigger(prev => prev + 1);
      } else {
        throw new Error(result.error || 'Buy failed');
      }
    } catch (error: any) {
      // Buy error
      toast({
        title: "Buy Failed",
        description: error.message || "Failed to buy tokens. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTrading(false);
    }
  };

  // Handle sell tokens
  const handleSell = async (tokenAmount: number) => {
    if (!publicKey || !launch || !signTransaction) {
      toast({
        title: "Error",
        description: "Please connect your wallet to trade",
        variant: "destructive",
      });
      return;
    }

    setIsTrading(true);
    try {
      const { getConnection } = await import('@/lib/connection');
      const connection = getConnection('confirmed');
      const { TradingService } = await import('@/lib/tradingService');
      const service = new TradingService(connection);
      
      const dexProvider = launch.dexProvider === 0 ? 'cook' : 'raydium';
      const result = await service.sellTokensAMM(
        launch.baseTokenMint,
        publicKey.toBase58(),
        tokenAmount,
        signTransaction,
        dexProvider
      );

      if (result.success) {
        toast({
          title: "Success!",
          description: `Successfully sold tokens. Transaction: ${result.signature?.slice(0, 8)}...`,
        });
        // Refresh data
        await fetchMarketData();
        await fetchWalletBalances();
        setBondingCurveRefreshTrigger(prev => prev + 1);
      } else {
        throw new Error(result.error || 'Sell failed');
      }
    } catch (error: any) {
      // Sell error
      toast({
        title: "Sell Failed",
        description: error.message || "Failed to sell tokens. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTrading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
    });
  };

  const formatPrice = (price: number, showUSD: boolean = true) => {
    const priceUSD = price * solPriceUSD;
    let priceStr = '';
    
    if (priceUSD < 0.000001) {
      priceStr = `$${priceUSD.toFixed(12)}`;
    } else if (priceUSD < 0.01) {
      priceStr = `$${priceUSD.toFixed(8)}`;
    } else if (priceUSD < 1000) {
      priceStr = `$${priceUSD.toFixed(4)}`;
    } else if (priceUSD < 1000000) {
      priceStr = `$${(priceUSD / 1000).toFixed(2)}K`;
    } else {
      priceStr = `$${(priceUSD / 1000000).toFixed(2)}M`;
    }
    
    if (showUSD) {
      if (price < 0.000001) {
        return `${priceStr} (${price.toFixed(12)} SOL)`;
      } else if (price < 0.01) {
        return `${priceStr} (${price.toFixed(8)} SOL)`;
      } else {
        return `${priceStr} (${price.toFixed(6)} SOL)`;
      }
    }
    return priceStr;
  };

  const formatLiquidity = (liquidity: number, showUSD: boolean = true) => {
    const liquidityUSD = liquidity * solPriceUSD;
    let solStr = '';
    
    if (liquidity < 1) {
      solStr = `${liquidity.toFixed(4)} SOL`;
    } else if (liquidity < 1000) {
      solStr = `${liquidity.toFixed(2)} SOL`;
    } else {
      solStr = `${(liquidity / 1000).toFixed(2)}K SOL`;
    }
    
    if (showUSD) {
      let usdStr = '';
      if (liquidityUSD < 1000) {
        usdStr = `$${liquidityUSD.toFixed(2)}`;
      } else if (liquidityUSD < 1000000) {
        usdStr = `$${(liquidityUSD / 1000).toFixed(2)}K`;
      } else {
        usdStr = `$${(liquidityUSD / 1000000).toFixed(2)}M`;
      }
      return `${usdStr} (${solStr})`;
    }
    return solStr;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'upcoming': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'ended': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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

  // Get current price - prioritize bonding curve price for instant launches
  const currentPrice = launch.launchType === 'instant' 
    ? (bondingCurveData.currentBondingPrice > 0 
        ? bondingCurveData.currentBondingPrice 
        : bondingCurveData.initialPrice || 0)
    : (marketData?.price || launch.currentPrice || launch.ticketPrice || 0);

  // Get liquidity
  const liquidity = realLiquidity !== null 
    ? realLiquidity 
    : (marketData?.liquidity !== undefined && marketData.liquidity > 0 
      ? marketData.liquidity 
      : (launch.liquidity || 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      
      {/* Hero Banner - Add padding-top to account for fixed header */}
      <div className="relative overflow-hidden border-b border-yellow-500/20 pt-20 sm:pt-24 md:pt-28">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-transparent to-yellow-500/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <Button 
              onClick={() => window.history.back()}
              variant="ghost" 
              size="sm"
              className="text-slate-400 hover:text-white text-xs sm:text-sm"
            >
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFavorited(!isFavorited)}
                className="text-slate-400 hover:text-yellow-400 h-8 w-8 sm:h-9 sm:w-9 p-0"
              >
                <Heart className={`w-3 h-3 sm:w-4 sm:h-4 ${isFavorited ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(window.location.href)}
                className="text-slate-400 hover:text-white h-8 w-8 sm:h-9 sm:w-9 p-0"
              >
                <Share2 className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </div>

          {/* Token Header */}
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mb-6 sm:mb-8">
            {(tokenImageUrl || launch.image) ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-2 border-yellow-500/30 shadow-lg shadow-yellow-500/20 flex-shrink-0">
                <img 
                  src={tokenImageUrl || launch.image} 
                  alt={launch.name || 'Token'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      parent.innerHTML = `<div class="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center border-2 border-yellow-500/30"><span class="text-3xl font-bold text-slate-900">${launch.symbol?.charAt(0) || 'T'}</span></div>`;
                    }
                  }}
                />
              </div>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center border-2 border-yellow-500/30 shadow-lg shadow-yellow-500/20 flex-shrink-0">
                <span className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">
                  {launch.symbol?.charAt(0) || 'T'}
                </span>
              </div>
            )}
            
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white break-words">{launch.name}</h1>
                <Badge className={`${getStatusColor(launch.status)} border`}>
                  {launch.status}
                </Badge>
                {launch.verified && (
                  <Badge variant="outline" className="border-green-500/30 text-green-400">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
              <p className="text-slate-400 text-base sm:text-lg mb-3 sm:mb-4">{launch.symbol}</p>
              
              {/* Key Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-2 sm:p-3 md:p-4 border border-slate-700/50">
                  <div className="text-slate-400 text-xs mb-1">Price</div>
                  <div className="text-white font-bold text-sm sm:text-base md:text-lg break-words">{formatPrice(currentPrice)}</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-2 sm:p-3 md:p-4 border border-slate-700/50">
                  <div className="text-slate-400 text-xs mb-1">Market Cap</div>
                  <div className="text-white font-bold text-sm sm:text-base md:text-lg">
                    {marketCapData && marketCapData.marketCapUSD > 0 
                      ? `$${(marketCapData.marketCapUSD / 1e6).toFixed(2)}M`
                      : '—'}
                  </div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-2 sm:p-3 md:p-4 border border-slate-700/50">
                  <div className="text-slate-400 text-xs mb-1">Liquidity</div>
                  <div className="text-white font-bold text-sm sm:text-base md:text-lg break-words">{formatLiquidity(liquidity)}</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-2 sm:p-3 md:p-4 border border-slate-700/50">
                  <div className="text-slate-400 text-xs mb-1">24h Volume</div>
                  <div className="text-white font-bold text-sm sm:text-base md:text-lg">
                    {marketData?.volume24h 
                      ? `$${(marketData.volume24h / 1e3).toFixed(2)}K`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
          {/* Left Column - Trading & Charts */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6 order-2 lg:order-1">
            {/* Trading Panel */}
            {launch.launchType === 'instant' ? (
              <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-yellow-500/20 backdrop-blur-sm">
                <CardContent className="p-4 sm:p-5 md:p-6">
                  <DegenTradingPanel
                    tokenMint={launch.baseTokenMint}
                    tokenSymbol={launch.symbol || 'TOKEN'}
                    currentPrice={currentPrice}
                    initialPrice={bondingCurveData.initialPrice}
                    decimals={tokenDecimals}
                    solBalance={solBalance}
                    tokenBalance={tokenBalance}
                    tokensSold={bondingCurveData.tokensSold}
                    totalSupply={launch.totalSupply}
                    isGraduated={launch.isGraduated || false}
                    graduationThreshold={launch.graduationThreshold || 30_000_000_000}
                    onBuy={handleBuy}
                    onSell={handleSell}
                    isTrading={isTrading}
                    launchDate={launch.createdAt ? new Date(launch.createdAt).getTime() / 1000 : undefined}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-yellow-400" />
                    Trading
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-slate-400 text-center py-8">
                    Trading available after launch completion
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Progress Bar for Instant Launches */}
            {launch.launchType === 'instant' && (
              <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-yellow-500/20 backdrop-blur-sm">
                <CardContent className="p-4 sm:p-5 md:p-6">
                  <DegenProgressBar
                    solReserves={bondingCurveData.solReserves}
                    graduationThreshold={launch.graduationThreshold || 30_000_000_000}
                    isGraduated={launch.isGraduated || false}
                  />
                </CardContent>
              </Card>
            )}

            {/* Bonding Curve Chart */}
            {launch.launchType === 'instant' && (
              <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-yellow-400" />
                    Bonding Curve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BondingCurveChart
                    tokensSold={bondingCurveData.tokensSold}
                    totalSupply={launch.totalSupply}
                    currentPrice={currentPrice}
                    initialPrice={bondingCurveData.initialPrice}
                  />
                </CardContent>
              </Card>
            )}

            {/* Price Chart */}
            <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUpIcon className="w-5 h-5 text-yellow-400" />
                  Price Chart
                </CardTitle>
              </CardHeader>
              <CardContent>
                {launch.launchType === 'instant' ? (
                  <PriceChart 
                    tokenMint={launch.baseTokenMint}
                    height={300}
                  />
                ) : (
                  <CandlestickChart data={candlestickData} />
                )}
              </CardContent>
            </Card>

            {/* Market Cap Chart */}
            <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-yellow-400" />
                  Market Cap
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MarketCapChart tokenMint={launch.baseTokenMint} />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Info & Stats */}
          <div className="space-y-4 sm:space-y-5 md:space-y-6 order-1 lg:order-2">
            {/* Wallet Balance */}
            {connected && (
              <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-yellow-500/20 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-yellow-400" />
                    Your Balance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">SOL</span>
                    <span className="text-white font-semibold">
                      {balanceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : solBalance.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">{launch.symbol}</span>
                    <span className="text-white font-semibold">
                      {balanceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : formatTokenAmount(tokenBalance)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Token Info */}
            <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Info className="w-5 h-5 text-yellow-400" />
                  Token Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Supply</span>
                    <span className="text-white font-semibold">{formatLargeNumber(launch.totalSupply)}</span>
                  </div>
                  {launch.launchType === 'instant' && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tokens Sold</span>
                      <span className="text-white font-semibold">{formatLargeNumber(bondingCurveData.tokensSold)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">DEX</span>
                    <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                      {launch.dexProvider === 0 ? 'Cook DEX' : 'Raydium'}
                    </Badge>
                  </div>
                  {liquidityLockInfo.isLocked && (
                    <div className="pt-2 border-t border-slate-700">
                      <LiquidityLockBadge lockInfo={liquidityLockInfo} />
                    </div>
                  )}
                </div>
                
                <Separator className="bg-slate-700" />
                
                <div className="space-y-2">
                  <div className="text-slate-400 text-sm mb-2">Contract Address</div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg">
                    <code className="text-slate-300 font-mono text-xs flex-1 break-all">
                      {launch.baseTokenMint || launch.id}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(launch.baseTokenMint || launch.id)}
                      className="text-slate-400 hover:text-white flex-shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Social Links */}
            {(launch.website || launch.twitter || launch.telegram || launch.discord) && (
              <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-yellow-400" />
                    Links
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {launch.website && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-slate-300 hover:text-white"
                        onClick={() => window.open(launch.website, '_blank')}
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        Website
                      </Button>
                    )}
                    {launch.twitter && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-slate-300 hover:text-white"
                        onClick={() => window.open(launch.twitter, '_blank')}
                      >
                        <Twitter className="w-4 h-4 mr-2" />
                        Twitter
                      </Button>
                    )}
                    {launch.telegram && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-slate-300 hover:text-white"
                        onClick={() => window.open(launch.telegram, '_blank')}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Telegram
                      </Button>
                    )}
                    {launch.discord && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-slate-300 hover:text-white"
                        onClick={() => window.open(launch.discord, '_blank')}
                      >
                        <Hash className="w-4 h-4 mr-2" />
                        Discord
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* View on Explorer */}
            <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 backdrop-blur-sm">
              <CardContent className="p-4">
                <Button
                  variant="outline"
                  className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                  onClick={() => window.open(`https://solscan.io/token/${launch.baseTokenMint}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View on Solscan
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaunchDetailPage;

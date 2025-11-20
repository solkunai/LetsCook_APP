import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  Clock,
  Users,
  Ticket,
  Gift,
  TrendingUp,
  DollarSign,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Target,
  Award,
  BarChart3,
  Share2,
  Heart,
  MessageCircle,
  Twitter,
  Globe,
  Hash,
  Image as ImageIcon,
  Play,
  Pause,
  RefreshCw,
  Info,
  Zap,
  Shield,
  Star,
  Flame
} from 'lucide-react';
import { ipfsMetadataService } from '@/lib/ipfsMetadataService';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getConnectionWithTimeout } from '@/lib/connection';
import { useLocation, useRoute } from 'wouter';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { raffleService } from '@/lib/raffleService';
import { blockchainIntegrationService } from '@/lib/blockchainIntegrationService';
import { raffleBlockchainService } from '@/lib/raffleBlockchainService';
import { tradingService } from '@/lib/tradingService';
import VotingComponent from '@/components/VotingComponent';
import MarketMakingRewards from '@/components/MarketMakingRewards';
import { marketDataService } from '@/lib/marketDataService';
import { launchDataService } from '@/lib/launchDataService';
import { Badge } from '@/components/ui/badge';

interface RaffleData {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  banner: string;
  ticketPrice: number;
  maxTickets: number;
  soldTickets: number;
  raffleDuration: number;
  winnerCount: number;
  startTime: number;
  endTime: number;
  status: 'upcoming' | 'active' | 'ended' | 'completed';
  creator: string;
  totalSupply: number;
  decimals: number;
  initialLiquidity: number;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  votes: { up: number; down: number };
  marketCap: number;
  liquidity: number;
  volume24h: number;
  holders: number;
}

export default function RaffleDetailPage() {
  const { connected, publicKey, signTransaction } = useWallet();
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/raffle/:id');
  const raffleId = params?.id;

  const [raffleData, setRaffleData] = useState<RaffleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketCount, setTicketCount] = useState(1);
  const [isBuyingTickets, setIsBuyingTickets] = useState(false);
  const [userTickets, setUserTickets] = useState(0);
  const [userTicketNumbers, setUserTicketNumbers] = useState<number[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Ticket status state
  const [ticketStatus, setTicketStatus] = useState<{
    hasTickets: boolean;
    numTickets: number;
    isWinner: boolean;
    canClaim: boolean;
    canRefund: boolean;
    orderId?: string;
  } | null>(null);
  const [isCheckingTickets, setIsCheckingTickets] = useState(false);
  const [isClaimingTokens, setIsClaimingTokens] = useState(false);
  const [isClaimingRefund, setIsClaimingRefund] = useState(false);
  const [raffleFailed, setRaffleFailed] = useState(false); // Track if raffle failed (ended without completing)
  
  // Raffle graduation state
  const [isGraduated, setIsGraduated] = useState(false);
  const [marketData, setMarketData] = useState<{
    price: number;
    marketCap: number;
    liquidity: number;
    volume24h: number;
    priceChange24h: number;
  } | null>(null);
  const [dexProvider, setDexProvider] = useState<'cook' | 'raydium' | null>(null);
  const [isLoadingMarketData, setIsLoadingMarketData] = useState(false);

  // Connection using environment variable
  const connection = getConnectionWithTimeout('confirmed', 60000);

  useEffect(() => {
    if (raffleId) {
      fetchRaffleData();
    }
  }, [raffleId]);

  useEffect(() => {
    if (raffleData && raffleData.status === 'active') {
      const interval = setInterval(updateTimeRemaining, 1000);
      return () => clearInterval(interval);
    }
  }, [raffleData]);

  useEffect(() => {
    if (connected && publicKey && raffleData) {
      fetchUserTickets();
      fetchTicketStatus();
    }
  }, [connected, publicKey, raffleData]);

  // Check graduation status periodically
  useEffect(() => {
    if (raffleData && !isGraduated && (raffleData.status === 'ended' || raffleData.status === 'completed')) {
      const interval = setInterval(() => {
        checkGraduationStatus(raffleData);
      }, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [raffleData, isGraduated]);

  const fetchRaffleData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!raffleId) {
        throw new Error('No raffle ID provided');
      }

      console.log('🔍 Fetching raffle data for ID:', raffleId);
      
      // Use the new raffle blockchain service
      let raffleData = await raffleBlockchainService.getRaffleById(raffleId);
      
      // Fallback to old service if new one fails
      if (!raffleData) {
        console.log('⚠️ New service failed, trying old service...');
        blockchainIntegrationService.clearCache();
        raffleData = await raffleService.fetchRaffleById(raffleId);
      }
      
      if (raffleData) {
        // PRIORITY 1: Fetch name, symbol, image directly from Supabase (fastest - no IPFS fetch needed)
        // PRIORITY 2: Fetch from IPFS metadata URI if Supabase doesn't have direct values
        // PRIORITY 3: Use blockchain-parsed data as last resort
        try {
          const { LaunchMetadataService } = await import('@/lib/launchMetadataService');
          const metadata = await LaunchMetadataService.getMetadata(raffleId);
          
          if (metadata) {
            // PRIORITY: Use name, symbol, image directly from Supabase (fastest access)
            if (metadata.name) {
              raffleData.name = metadata.name;
              console.log('✅ Loaded token name from Supabase (fastest):', metadata.name);
            }
            if (metadata.symbol) {
              raffleData.symbol = metadata.symbol;
              console.log('✅ Loaded token symbol from Supabase (fastest):', metadata.symbol);
            }
            if (metadata.image) {
              raffleData.image = metadata.image;
              console.log('✅ Loaded token image from Supabase (fastest):', metadata.image);
            }
            
            // Merge other Supabase metadata with raffle data
            if (metadata.description) {
              raffleData.description = metadata.description;
            }
            if (metadata.website) {
              raffleData.website = metadata.website;
            }
            if (metadata.twitter) {
              raffleData.twitter = metadata.twitter;
            }
            if (metadata.telegram) {
              raffleData.telegram = metadata.telegram;
            }
            if (metadata.discord) {
              raffleData.discord = metadata.discord;
            }
            
            // PRIORITY 2: Fetch from IPFS metadata URI if Supabase doesn't have direct values
            const needsIPFSFetch = !raffleData.name || !raffleData.symbol || !raffleData.image;
            const metadataUri = metadata.metadata_uri;
            
            if (needsIPFSFetch && metadataUri) {
              console.log(`📥 Fetching missing metadata from IPFS (fallback):`, metadataUri);
              try {
                const { getFullTokenMetadata } = await import('@/lib/ipfsMetadataFetcher');
                const fullMetadata = await getFullTokenMetadata(metadataUri);
                
                if (fullMetadata) {
                  // Only update if Supabase didn't provide the value
                  if (!raffleData.name && fullMetadata.name) {
                    raffleData.name = fullMetadata.name;
                    console.log('✅ Fetched token name from IPFS (fallback):', fullMetadata.name);
                  }
                  if (!raffleData.symbol && fullMetadata.symbol) {
                    raffleData.symbol = fullMetadata.symbol;
                    console.log('✅ Fetched token symbol from IPFS (fallback):', fullMetadata.symbol);
                  }
                  if (!raffleData.image && fullMetadata.image) {
                    raffleData.image = fullMetadata.image;
                    console.log('✅ Fetched token image from IPFS (fallback):', fullMetadata.image);
                  }
                  if (fullMetadata.description && !raffleData.description) {
                    raffleData.description = fullMetadata.description;
                  }
                }
              } catch (ipfsError) {
                console.warn('⚠️ Could not fetch metadata from IPFS (will use blockchain data as fallback):', ipfsError);
              }
            } else if (!needsIPFSFetch) {
              console.log('✅ All metadata (name, symbol, image) loaded from Supabase - skipping IPFS fetch');
            } else {
              console.log('ℹ️ No IPFS metadata URI found in Supabase, using blockchain data');
            }
          }
        } catch (metadataError) {
          console.warn('⚠️ Could not load metadata from Supabase:', metadataError);
          // Continue without Supabase metadata - not critical
        }
        
        setRaffleData(raffleData);
        console.log('✅ Raffle data fetched successfully:', raffleData);
        
        // Check if raffle failed (ended without completing - not all tickets sold)
        const now = Date.now();
        const hasEnded = raffleData.status === 'ended' || raffleData.status === 'completed' || now > raffleData.endTime;
        const isIncomplete = raffleData.soldTickets < raffleData.maxTickets;
        const failed = hasEnded && isIncomplete && raffleData.status !== 'completed';
        setRaffleFailed(failed);
        
        console.log('📊 Raffle status check:', {
          status: raffleData.status,
          hasEnded,
          isIncomplete,
          soldTickets: raffleData.soldTickets,
          maxTickets: raffleData.maxTickets,
          failed
        });
        
        // Check if raffle has graduated (is tradable and pool exists)
        await checkGraduationStatus(raffleData);
        
        // Preload images for better UX
        try {
          await ipfsMetadataService.preloadRaffleImages(raffleId);
        } catch (error) {
          console.warn('⚠️ Image preloading failed:', error);
        }
      } else {
        setError('Raffle not found');
      }

    } catch (error) {
      console.error('❌ Error fetching raffle data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch raffle data');
      setRaffleData(null);
    } finally {
      setLoading(false);
    }
  };

  // Check if raffle has graduated to trading
  const checkGraduationStatus = async (raffle: RaffleData) => {
    try {
      setIsLoadingMarketData(true);
      
      // Get launch data to check is_tradable flag and DEX provider
      const launch = await launchDataService.getLaunchById(raffle.id);
      if (!launch) {
        console.log('⚠️ Launch data not found for raffle:', raffle.id);
        setIsLoadingMarketData(false);
        return;
      }

      // Check if raffle is tradable (graduated)
      // For raffles, we check if market data exists (pool created)
      if (launch.baseTokenMint) {
        try {
          const marketDataResult = await marketDataService.getMarketData(
            launch.baseTokenMint,
            raffle.totalSupply
          );
          
          // If market data exists and has price/liquidity, raffle has graduated
          if (marketDataResult && marketDataResult.price > 0 && marketDataResult.liquidity > 0) {
            setIsGraduated(true);
            setMarketData({
              price: marketDataResult.price,
              marketCap: marketDataResult.marketCap,
              liquidity: marketDataResult.liquidity,
              volume24h: marketDataResult.volume24h,
              priceChange24h: marketDataResult.priceChange24h
            });
            
            // Set DEX provider (from launch data)
            setDexProvider(launch.dexProvider === 1 ? 'raydium' : 'cook');
            
            console.log('✅ Raffle has graduated!', {
              price: marketDataResult.price,
              liquidity: marketDataResult.liquidity,
              dexProvider: launch.dexProvider === 1 ? 'raydium' : 'cook'
            });
          } else {
            setIsGraduated(false);
            setMarketData(null);
            console.log('ℹ️ Raffle has not graduated yet (pool not created)');
          }
        } catch (error) {
          // Pool doesn't exist yet or error fetching
          console.log('ℹ️ Pool not found yet or error fetching market data:', error);
          setIsGraduated(false);
          setMarketData(null);
        }
      }
    } catch (error) {
      console.error('❌ Error checking graduation status:', error);
      setIsGraduated(false);
      setMarketData(null);
    } finally {
      setIsLoadingMarketData(false);
    }
  };

  // Helper functions removed - now using raffleService

  const fetchUserTickets = async () => {
    if (!publicKey || !raffleData) return;

    try {
      // Fetch real user ticket data from blockchain
      const userTicketData = await raffleService.getUserTickets(raffleData.id, publicKey.toBase58());
      if (userTicketData) {
        setUserTickets(userTicketData.ticketCount);
        setUserTicketNumbers(userTicketData.ticketNumbers);
      } else {
        setUserTickets(0);
        setUserTicketNumbers([]);
      }
    } catch (err) {
      console.error('Error fetching user tickets:', err);
      setUserTickets(0);
      setUserTicketNumbers([]);
    }
  };

  const updateTimeRemaining = () => {
    if (!raffleData) return;

    const now = Date.now();
    const timeLeft = raffleData.endTime - now;

    // Don't show countdown if raffle is ended or completed
    if (raffleData.status === 'ended' || raffleData.status === 'completed') {
      setTimeRemaining(null);
      return;
    }

    // Don't show countdown if raffle hasn't started yet
    if (raffleData.status === 'upcoming') {
      const timeUntilStart = raffleData.startTime - now;
      if (timeUntilStart > 0) {
        const days = Math.floor(timeUntilStart / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeUntilStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilStart % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntilStart % (1000 * 60)) / 1000);
        setTimeRemaining({ days, hours, minutes, seconds });
        return;
      }
    }

    if (timeLeft <= 0) {
      setTimeRemaining(null);
      return;
    }

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    setTimeRemaining({ days, hours, minutes, seconds });
  };

  const handleBuyTickets = async () => {
    if (!connected || !publicKey || !signTransaction || !raffleData) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to buy tickets.",
        variant: "destructive",
      });
      return;
    }

    if (raffleData.status !== 'active') {
      toast({
        title: "Raffle Not Active",
        description: "This raffle is not currently accepting ticket purchases.",
        variant: "destructive",
      });
      return;
    }

    if (raffleData.soldTickets + ticketCount > raffleData.maxTickets) {
      toast({
        title: "Not Enough Tickets",
        description: "Not enough tickets remaining for your purchase.",
        variant: "destructive",
      });
      return;
    }

    // Check if user already has tickets
    try {
      const ticketStatus = await tradingService.getUserTicketStatus(raffleData.id, publicKey.toBase58());
      if (ticketStatus.hasTickets) {
        toast({
          title: "Tickets Already Purchased",
          description: `You have already purchased ${ticketStatus.numTickets} ticket(s) for this raffle. Order ID: ${ticketStatus.orderId}`,
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error('Error checking ticket status:', error);
    }

    setIsBuyingTickets(true);

    try {
      const totalCost = ticketCount * raffleData.ticketPrice;
      
      console.log('🎫 Buying tickets:', {
        ticketCount,
        totalCost,
        raffleId: raffleData.id,
        userPublicKey: publicKey.toBase58()
      });

      // Use real blockchain transaction to buy tickets
      const result = await raffleService.buyTickets(
        raffleData.id,
        publicKey.toBase58(),
        ticketCount,
        totalCost, // SOL amount
        signTransaction
      );
      
      if (result.success) {
        toast({
          title: "Tickets Purchased!",
          description: `You bought ${ticketCount} ticket(s) for ${raffleData.name}. Transaction: ${result.signature?.slice(0, 8) || 'pending'}...`,
        });
        
        // Refresh user tickets
        await fetchUserTickets();
        // Refresh raffle data
        await fetchRaffleData();
      } else {
        throw new Error(result.error || 'Failed to purchase tickets');
      }

    } catch (error) {
      console.error('Error buying tickets:', error);
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "Failed to purchase tickets. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBuyingTickets(false);
    }
  };

  const fetchTicketStatus = async () => {
    if (!publicKey || !raffleData) return;
    
    try {
      const status = await tradingService.getUserTicketStatus(raffleData.id, publicKey.toBase58());
      setTicketStatus(status);
    } catch (error) {
      console.error('Error fetching ticket status:', error);
    }
  };

  const handleCheckTickets = async () => {
    if (!connected || !publicKey || !signTransaction || !raffleData) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to check tickets.",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingTickets(true);

    try {
      const result = await tradingService.checkTickets(
        raffleData.id,
        publicKey.toBase58(),
        signTransaction
      );

      if (result.success) {
        toast({
          title: result.isWinner ? "🎉 Congratulations!" : "😔 Better Luck Next Time",
          description: result.isWinner 
            ? `You won with ${result.winningTickets} winning ticket(s)! Click "Claim Tokens" to claim your prize.`
            : "You didn't win this time. Click 'Claim Refund' to get your SOL back.",
        });
        
        // Refresh ticket status
        await fetchTicketStatus();
      } else {
        throw new Error(result.error || 'Failed to check tickets');
      }
    } catch (error) {
      console.error('Error checking tickets:', error);
      toast({
        title: "Check Failed",
        description: error instanceof Error ? error.message : "Failed to check tickets. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingTickets(false);
    }
  };

  const handleClaimTokens = async () => {
    if (!connected || !publicKey || !signTransaction || !raffleData) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to claim tokens.",
        variant: "destructive",
      });
      return;
    }

    setIsClaimingTokens(true);

    try {
      const result = await tradingService.claimTokens(
        raffleData.id,
        publicKey.toBase58(),
        signTransaction
      );

      if (result.success) {
        toast({
          title: "🎉 Tokens Claimed!",
          description: `Successfully claimed ${result.tokenAmount} tokens. The token is now tradeable!`,
        });
        
        // Refresh ticket status
        await fetchTicketStatus();
      } else {
        throw new Error(result.error || 'Failed to claim tokens');
      }
    } catch (error) {
      console.error('Error claiming tokens:', error);
      toast({
        title: "Claim Failed",
        description: error instanceof Error ? error.message : "Failed to claim tokens.",
        variant: "destructive",
      });
    } finally {
      setIsClaimingTokens(false);
    }
  };

  const handleClaimRefund = async () => {
    if (!connected || !publicKey || !signTransaction || !raffleData) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to claim refund.",
        variant: "destructive",
      });
      return;
    }

    setIsClaimingRefund(true);

    try {
      const result = await tradingService.claimRefund(
        raffleData.id,
        publicKey.toBase58(),
        signTransaction
      );

      if (result.success) {
        toast({
          title: "💰 Refund Claimed!",
          description: `Successfully claimed ${result.refundAmount} SOL refund.`,
        });
        
        // Refresh ticket status
        await fetchTicketStatus();
      } else {
        throw new Error(result.error || 'Failed to claim refund');
      }
    } catch (error) {
      console.error('Error claiming refund:', error);
      toast({
        title: "Refund Failed",
        description: error instanceof Error ? error.message : "Failed to claim refund.",
        variant: "destructive",
      });
    } finally {
      setIsClaimingRefund(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard",
      });
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareRaffle = () => {
    setShowShareModal(true);
  };

  const getStatusColor = (status: string, failed: boolean) => {
    if (failed) return 'text-red-400 bg-red-500/20';
    switch (status) {
      case 'upcoming': return 'text-blue-400 bg-blue-500/20';
      case 'active': return 'text-green-400 bg-green-500/20';
      case 'ended': return 'text-orange-400 bg-orange-500/20';
      case 'completed': return 'text-purple-400 bg-purple-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  const getStatusText = (status: string, failed: boolean) => {
    if (failed) return 'Failed';
    switch (status) {
      case 'upcoming': return 'Upcoming';
      case 'active': return 'Active';
      case 'ended': return 'Ended';
      case 'completed': return 'Completed';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading raffle details...</p>
        </div>
      </div>
    );
  }

  if (error || !raffleData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Raffle Not Found</h2>
          <p className="text-slate-400 mb-6">{error || 'The raffle you are looking for does not exist.'}</p>
          <button
            onClick={() => setLocation('/')}
            className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <Header 
        title="Raffle Details"
        subtitle={`${raffleData.name} (${raffleData.symbol})`}
        showNavigation={true}
      />

      <div className="py-4 sm:py-6 md:py-8 px-3 sm:px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Back Button and Refresh */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
            <button
              onClick={() => setLocation('/raffles')}
              className="flex items-center text-slate-400 hover:text-white transition-colors text-sm sm:text-base min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Back to Raffles</span>
              <span className="sm:hidden">Back</span>
            </button>
            
            <button
              onClick={fetchRaffleData}
              disabled={loading}
              className="flex items-center text-slate-400 hover:text-white transition-colors disabled:opacity-50 text-sm sm:text-base min-h-[44px]"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
              <span className="sm:hidden">Refresh</span>
            </button>
          </div>

          {/* Banner */}
          <div className="relative mb-6 sm:mb-8 rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 h-[200px] sm:h-[300px] md:h-[400px]">
            {raffleData.banner && !raffleData.banner.includes('placeholder') && !raffleData.banner.includes('data:image') ? (
              <img 
                src={raffleData.banner} 
                alt={`${raffleData.name} banner`}
                className="w-full h-full object-cover"
                onError={async (e) => {
                  // Try to fetch optimized image with fallback gateways
                  if (raffleData.banner && raffleData.banner.includes('ipfs')) {
                    try {
                      const hash = raffleData.banner.split('/').pop();
                      if (hash) {
                        const optimizedImage = await ipfsMetadataService.getOptimizedImage(hash, 'banner', false);
                        if (optimizedImage) {
                          e.currentTarget.src = optimizedImage;
                          return;
                        }
                      }
                    } catch (error) {
                      console.error('❌ Fallback IPFS fetch failed:', error);
                    }
                  }
                  // Hide image and show gradient background
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            
            {/* Status Badge */}
            <div className="absolute bottom-6 left-6">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(raffleData.status, raffleFailed)} backdrop-blur-sm bg-black/20`}>
                {getStatusText(raffleData.status, raffleFailed)}
              </div>
            </div>
            
            {/* Contract Address Overlay */}
            <div className="absolute top-3 sm:top-6 right-3 sm:right-6">
              <div className="bg-black/30 backdrop-blur-md rounded-lg sm:rounded-xl p-2 sm:p-4 border border-white/10">
                <div className="text-white text-xs sm:text-sm font-medium mb-1 sm:mb-2">Contract</div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <code className="text-[10px] sm:text-xs text-gray-200 font-mono bg-black/40 px-2 sm:px-3 py-1 sm:py-2 rounded">
                    {raffleData.baseTokenMint.slice(0, 6)}...{raffleData.baseTokenMint.slice(-6)}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(raffleData.baseTokenMint);
                      toast({
                        title: "Copied!",
                        description: "Contract address copied to clipboard",
                      });
                    }}
                    className="p-1.5 sm:p-2 hover:bg-white/20 rounded transition-colors min-h-[32px] min-w-[32px]"
                    title="Copy contract address"
                  >
                    <Copy className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Token Name Overlay */}
            <div className="absolute bottom-3 sm:bottom-6 right-3 sm:right-6 left-3 sm:left-auto">
              <div className="text-right sm:text-right">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2 drop-shadow-lg break-words">{raffleData.name}</h1>
                <p className="text-sm sm:text-base md:text-lg lg:text-xl text-purple-200 font-semibold drop-shadow-lg">{raffleData.symbol}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-1">
              {/* Token Info */}
              <div className="bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-800 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mb-4 sm:mb-6">
                  {raffleData.image && !raffleData.image.includes('placeholder') && !raffleData.image.includes('data:image') ? (
                    <img 
                      src={raffleData.image} 
                      alt={raffleData.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-2 border-purple-500 object-cover flex-shrink-0"
                      onError={async (e) => {
                        // Try to fetch optimized image with fallback gateways
                        if (raffleData.image && raffleData.image.includes('ipfs')) {
                          try {
                            const hash = raffleData.image.split('/').pop();
                            if (hash) {
                              const optimizedImage = await ipfsMetadataService.getOptimizedImage(hash, 'icon', false);
                              if (optimizedImage) {
                                e.currentTarget.src = optimizedImage;
                                return;
                              }
                            }
                          } catch (error) {
                            console.error('❌ Fallback IPFS fetch failed:', error);
                          }
                        }
                        // Hide image and show fallback
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-2 border-purple-500 bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-base sm:text-lg md:text-xl">
                        {raffleData.symbol ? raffleData.symbol.slice(0, 2) : 'TK'}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 w-full sm:w-auto">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 break-words">{raffleData.name}</h1>
                    <p className="text-lg sm:text-xl md:text-2xl font-semibold text-purple-400 mb-2 sm:mb-3">{raffleData.symbol}</p>
                    <p className="text-sm sm:text-base text-slate-400 mb-3 sm:mb-4 line-clamp-3">{raffleData.description}</p>
                    
                    {/* Contract Address Section */}
                    <div className="bg-slate-800 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-slate-400 mb-2">Contract Address</div>
                          <code className="text-sm text-white font-mono bg-slate-700 px-3 py-2 rounded break-all">
                            {raffleData.baseTokenMint}
                          </code>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(raffleData.baseTokenMint);
                            toast({
                              title: "Copied!",
                              description: "Contract address copied to clipboard",
                            });
                          }}
                          className="p-2 hover:bg-slate-700 rounded-lg transition-colors ml-3 flex-shrink-0"
                          title="Copy contract address"
                        >
                          <Copy className="w-5 h-5 text-slate-400" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Token Stats */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="bg-slate-800 rounded-lg p-3 sm:p-4">
                        <div className="text-xs sm:text-sm text-slate-400 mb-1">Total Supply</div>
                        <div className="text-base sm:text-lg md:text-xl font-semibold text-white break-words">
                          {raffleData.totalSupply ? raffleData.totalSupply.toLocaleString() : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-3 sm:p-4">
                        <div className="text-xs sm:text-sm text-slate-400 mb-1">Decimals</div>
                        <div className="text-base sm:text-lg md:text-xl font-semibold text-white">
                          {raffleData.decimals || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setIsLiked(!isLiked)}
                      className={`p-2 rounded-lg transition-colors ${
                        isLiked ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-400 hover:text-red-400'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={shareRaffle}
                      className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Social Links */}
                <div className="flex flex-wrap gap-4 mb-6">
                  {raffleData.website && (
                    <a
                      href={raffleData.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-slate-400 hover:text-white transition-colors"
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      Website
                    </a>
                  )}
                  {raffleData.twitter && (
                    <a
                      href={raffleData.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-slate-400 hover:text-white transition-colors"
                    >
                      <Twitter className="w-4 h-4 mr-2" />
                      Twitter
                    </a>
                  )}
                  {raffleData.telegram && (
                    <a
                      href={raffleData.telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-slate-400 hover:text-white transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Telegram
                    </a>
                  )}
                  {raffleData.discord && (
                    <a
                      href={raffleData.discord}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-slate-400 hover:text-white transition-colors"
                    >
                      <Hash className="w-4 h-4 mr-2" />
                      Discord
                    </a>
                  )}
                </div>

                {/* Voting Component */}
                <VotingComponent 
                  launchId={raffleData.id}
                  currentVotes={{ upvotes: raffleData.votes.up, downvotes: raffleData.votes.down }}
                />
              </div>

              {/* Raffle Stats */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-purple-400" />
                  Raffle Statistics
                </h2>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">
                        {isGraduated && marketData ? 'Current Price' : 'Ticket Price'}
                      </span>
                      <span className="text-white font-semibold">
                        {isGraduated && marketData 
                          ? `${marketData.price.toFixed(8)} SOL`
                          : `${raffleData.ticketPrice.toFixed(6)} SOL`}
                      </span>
                    </div>
                    {isGraduated && marketData && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-700">
                        <span className="text-slate-400">Price Source</span>
                        <Badge variant="outline" className="border-green-500/30 text-green-400">
                          {dexProvider === 'raydium' ? 'Raydium' : 'Cook DEX'} Pool
                        </Badge>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Max Tickets</span>
                      <span className="text-white font-semibold">{raffleData.maxTickets.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Sold Tickets</span>
                      <span className="text-white font-semibold">{raffleData.soldTickets.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-400">Winners</span>
                      <span className="text-white font-semibold">{raffleData.winnerCount}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Total Supply</span>
                      <span className="text-white font-semibold">{raffleData.totalSupply.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Initial Liquidity</span>
                      <span className="text-white font-semibold">{raffleData.initialLiquidity} SOL</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Creator</span>
                      <span className="text-white font-semibold truncate">{raffleData.creator}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-400">Progress</span>
                      <span className="text-white font-semibold">
                        {((raffleData.soldTickets / raffleData.maxTickets) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400 text-sm">Tickets Sold</span>
                    <span className="text-white text-sm font-semibold">
                      {raffleData.soldTickets} / {raffleData.maxTickets}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${(raffleData.soldTickets / raffleData.maxTickets) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Market Making Rewards */}
              <MarketMakingRewards
                tokenMint={raffleData.id}
                tokenSymbol={raffleData.symbol}
                tokenName={raffleData.name}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
              {/* Timer */}
              {timeRemaining && (
                <div className="bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-800 p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-orange-400" />
                    Time Remaining
                  </h3>
                  <div className="grid grid-cols-4 gap-1 sm:gap-2">
                    <div className="text-center">
                      <div className="text-lg sm:text-xl md:text-2xl font-bold text-white">{timeRemaining.days}</div>
                      <div className="text-[10px] sm:text-xs text-slate-400">Days</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg sm:text-xl md:text-2xl font-bold text-white">{timeRemaining.hours}</div>
                      <div className="text-[10px] sm:text-xs text-slate-400">Hours</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg sm:text-xl md:text-2xl font-bold text-white">{timeRemaining.minutes}</div>
                      <div className="text-[10px] sm:text-xs text-slate-400">Minutes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg sm:text-xl md:text-2xl font-bold text-white">{timeRemaining.seconds}</div>
                      <div className="text-[10px] sm:text-xs text-slate-400">Seconds</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Buy Tickets */}
              {raffleData.status === 'active' && (
                <div className="bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-800 p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center">
                    <Ticket className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-400" />
                    Buy Tickets
                  </h3>
                  
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">
                        Number of Tickets
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={raffleData.maxTickets - raffleData.soldTickets}
                        value={ticketCount}
                        onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[44px]"
                      />
                    </div>
                    
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">Price per ticket:</span>
                        <span className="text-white">{raffleData.ticketPrice} SOL</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">Total tickets:</span>
                        <span className="text-white">{ticketCount}</span>
                      </div>
                      <div className="border-t border-slate-700 pt-2">
                        <div className="flex justify-between font-semibold">
                          <span className="text-white">Total cost:</span>
                          <span className="text-green-400">{(ticketCount * raffleData.ticketPrice).toFixed(3)} SOL</span>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleBuyTickets}
                      disabled={isBuyingTickets || !connected}
                      className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium py-3 sm:py-3.5 px-4 sm:px-6 rounded-lg transition-colors flex items-center justify-center text-sm sm:text-base min-h-[48px]"
                    >
                      {isBuyingTickets ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Ticket className="w-4 h-4 mr-2" />
                          Buy Tickets
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Raffle Failed - Refund Section */}
              {raffleFailed && connected && (
                <div className="bg-slate-900 rounded-2xl border border-red-500/30 p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 text-red-400" />
                    Raffle Failed
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                      <div className="text-red-400 font-semibold mb-2">⚠️ Raffle Did Not Complete</div>
                      <div className="text-white text-sm mb-3">
                        This raffle ended without selling all tickets ({raffleData.soldTickets} / {raffleData.maxTickets} sold).
                        All participants are eligible for a full refund.
                      </div>
                    </div>
                    
                    {ticketStatus && ticketStatus.hasTickets ? (
                      <>
                        <div className="bg-slate-800 rounded-lg p-4">
                          <div className="text-sm text-slate-400 mb-1">Your Tickets</div>
                          <div className="text-white font-semibold text-lg">{ticketStatus.numTickets} ticket(s)</div>
                          <div className="text-sm text-slate-400 mt-2">
                            Refund Amount: {(ticketStatus.numTickets || 0) * raffleData.ticketPrice} SOL
                          </div>
                        </div>
                        
                        <button
                          onClick={handleClaimRefund}
                          disabled={isClaimingRefund}
                          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                        >
                          {isClaimingRefund ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Claiming Refund...
                            </>
                          ) : (
                            <>
                              <DollarSign className="w-4 h-4 mr-2" />
                              Claim Full Refund
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="text-slate-400 text-sm text-center py-4">
                        You don't have any tickets for this raffle.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ticket Status & Results Section - Only show if raffle completed successfully */}
              {!raffleFailed && (raffleData.status === 'ended' || raffleData.status === 'completed') && connected && ticketStatus && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <Award className="w-5 h-5 mr-2 text-purple-400" />
                    Your Ticket Status
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Order ID */}
                    {ticketStatus.orderId && (
                      <div className="bg-slate-800 rounded-lg p-4">
                        <div className="text-sm text-slate-400 mb-1">Order ID</div>
                        <div className="text-white font-mono text-xs break-all">{ticketStatus.orderId}</div>
                      </div>
                    )}
                    
                    {/* Ticket Count */}
                    <div className="bg-slate-800 rounded-lg p-4">
                      <div className="text-sm text-slate-400 mb-1">Your Tickets</div>
                      <div className="text-white font-semibold text-lg">{ticketStatus.numTickets} ticket(s)</div>
                    </div>
                    
                    {/* Check Tickets Button (if not checked yet) */}
                    {ticketStatus.hasTickets && !ticketStatus.isWinner && ticketStatus.canRefund === false && (
                      <button
                        onClick={handleCheckTickets}
                        disabled={isCheckingTickets}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                      >
                        {isCheckingTickets ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Checking Tickets...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Check Tickets
                          </>
                        )}
                      </button>
                    )}
                    
                    {/* Winner Display */}
                    {ticketStatus.isWinner && (
                      <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 rounded-lg p-4 border border-green-500/30">
                        <div className="flex items-center mb-2">
                          <Award className="w-6 h-6 text-green-400 mr-2" />
                          <div className="text-green-400 font-bold text-lg">🎉 YOU WON!</div>
                        </div>
                        <div className="text-white text-sm mb-3">
                          Congratulations! You are a winner. Claim your tokens now!
                        </div>
                        <button
                          onClick={handleClaimTokens}
                          disabled={isClaimingTokens}
                          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                        >
                          {isClaimingTokens ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Claiming Tokens...
                            </>
                          ) : (
                            <>
                              <Gift className="w-4 h-4 mr-2" />
                              Claim Tokens
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {/* Loser Display */}
                    {ticketStatus.hasTickets && !ticketStatus.isWinner && ticketStatus.canRefund && (
                      <div className="bg-gradient-to-r from-orange-900/50 to-red-900/50 rounded-lg p-4 border border-orange-500/30">
                        <div className="flex items-center mb-2">
                          <AlertCircle className="w-6 h-6 text-orange-400 mr-2" />
                          <div className="text-orange-400 font-bold text-lg">😔 Better Luck Next Time</div>
                        </div>
                        <div className="text-white text-sm mb-3">
                          You didn't win this time. Click below to claim your refund.
                        </div>
                        <button
                          onClick={handleClaimRefund}
                          disabled={isClaimingRefund}
                          className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                        >
                          {isClaimingRefund ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Claiming Refund...
                            </>
                          ) : (
                            <>
                              <DollarSign className="w-4 h-4 mr-2" />
                              Claim Refund
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Claim/Refund Section (Legacy - if no ticket status) - Only for completed raffles */}
              {!raffleFailed && (raffleData.status === 'ended' || raffleData.status === 'completed') && connected && !ticketStatus && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <Award className="w-5 h-5 mr-2 text-green-400" />
                    Raffle Results
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="bg-slate-800 rounded-lg p-4">
                      <div className="text-sm text-slate-400 mb-2">Raffle Status</div>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        raffleData.status === 'completed' ? 'text-green-400 bg-green-500/20' : 'text-orange-400 bg-orange-500/20'
                      }`}>
                        {raffleData.status === 'completed' ? 'Completed' : 'Ended'}
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={handleClaimTokens}
                        disabled={isClaimingTokens}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                      >
                        {isClaimingTokens ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Award className="w-4 h-4 mr-2" />
                        )}
                        Claim Tokens
                      </button>
                      
                      <button
                        onClick={handleClaimRefund}
                        disabled={isClaimingRefund}
                        className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                      >
                        {isClaimingRefund ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Claim Refund
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* User Tickets */}
              {connected && userTickets > 0 && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <Gift className="w-5 h-5 mr-2 text-yellow-400" />
                    Your Tickets
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total tickets:</span>
                      <span className="text-white font-semibold">{userTickets}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ticket numbers:</span>
                      <span className="text-white font-semibold">
                        {userTicketNumbers.slice(0, 3).join(', ')}
                        {userTicketNumbers.length > 3 && ` +${userTicketNumbers.length - 3} more`}
                      </span>
                    </div>
                  </div>
                  
                  {/* Show claim/refund options when raffle ends */}
                  {raffleData.status === 'ended' && (
                    <div className="mt-4 space-y-2">
                      <button
                        onClick={async () => {
                          try {
                            const result = await raffleService.claimTokens(raffleData.id, publicKey!.toBase58(), signTransaction!);
                            if (result.success) {
                              toast({
                                title: "Tokens Claimed!",
                                description: result.won ? `Congratulations! You won ${result.tokenAmount} tokens!` : "No tokens won this time.",
                              });
                              await fetchUserTickets();
                            } else {
                              toast({
                                title: "Claim Failed",
                                description: result.error || "Failed to claim tokens.",
                                variant: "destructive",
                              });
                            }
                          } catch (error) {
                            toast({
                              title: "Claim Failed",
                              description: error instanceof Error ? error.message : "Failed to claim tokens.",
                              variant: "destructive",
                            });
                          }
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Check if You Won
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const result = await raffleService.claimRefund(raffleData.id, publicKey!.toBase58(), signTransaction!);
                            if (result.success) {
                              toast({
                                title: "Refund Claimed!",
                                description: `Successfully refunded ${result.refundAmount} SOL.`,
                              });
                              await fetchUserTickets();
                            } else {
                              toast({
                                title: "Refund Failed",
                                description: result.error || "Failed to claim refund.",
                                variant: "destructive",
                              });
                            }
                          } catch (error) {
                            toast({
                              title: "Refund Failed",
                              description: error instanceof Error ? error.message : "Failed to claim refund.",
                              variant: "destructive",
                            });
                          }
                        }}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Claim Refund
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Raffle Graduation Status */}
              {(raffleData.status === 'ended' || raffleData.status === 'completed') && !raffleFailed && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center">
                      <Zap className="w-5 h-5 mr-2 text-yellow-400" />
                      Trading Status
                    </h3>
                    {isLoadingMarketData && (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    )}
                  </div>
                  
                  {isGraduated && marketData ? (
                    <>
                      {/* Graduation Success Badge */}
                      <div className="mb-4 p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                            <span className="text-green-400 font-semibold text-lg">Graduated to Trading</span>
                          </div>
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            {dexProvider === 'raydium' ? 'Raydium' : 'Cook DEX'}
                          </Badge>
                        </div>
                        <p className="text-green-200/80 text-sm mt-2">
                          This raffle has successfully graduated! Tokens are now tradeable on {dexProvider === 'raydium' ? 'Raydium' : 'Cook DEX'}.
                        </p>
                      </div>

                      {/* Market Data */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-slate-700">
                          <span className="text-slate-400">Current Price:</span>
                          <span className="text-white font-bold text-xl">
                            {marketData.price.toFixed(8)} SOL
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Market Cap:</span>
                          <span className="text-white font-semibold">
                            ${marketData.marketCap.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Liquidity:</span>
                          <span className="text-white font-semibold">
                            ${marketData.liquidity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">24h Volume:</span>
                          <span className="text-white font-semibold">
                            ${marketData.volume24h.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">24h Price Change:</span>
                          <span className={`font-semibold ${
                            marketData.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {marketData.priceChange24h >= 0 ? '+' : ''}{marketData.priceChange24h.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">DEX Provider:</span>
                          <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                            {dexProvider === 'raydium' ? 'Raydium' : 'Cook DEX'}
                          </Badge>
                        </div>
                      </div>

                      {/* Trading Link */}
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <button
                          onClick={() => setLocation(`/trade?token=${raffleData.id}`)}
                          className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center"
                        >
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Trade on {dexProvider === 'raydium' ? 'Raydium' : 'Cook DEX'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Not Graduated Yet */}
                      <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Clock className="w-5 h-5 text-yellow-400" />
                          <span className="text-yellow-400 font-semibold">Awaiting Graduation</span>
                        </div>
                        <p className="text-yellow-200/80 text-sm mt-2">
                          {raffleData.status === 'ended' 
                            ? 'Raffle has ended. Pool will be created automatically when liquidity threshold is met and first winner claims tokens.'
                            : 'Pool will be created automatically when liquidity threshold is met after raffle ends.'}
                        </p>
                      </div>

                      {/* Current Ticket Price (Before Graduation) */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-slate-700">
                          <span className="text-slate-400">Ticket Price:</span>
                          <span className="text-white font-bold text-xl">
                            {raffleData.ticketPrice.toFixed(6)} SOL
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Status:</span>
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            <Clock className="w-3 h-3 mr-1" />
                            Pre-Graduation
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Sold Tickets:</span>
                          <span className="text-white font-semibold">
                            {raffleData.soldTickets.toLocaleString()} / {raffleData.maxTickets > 0 ? raffleData.maxTickets.toLocaleString() : 'Unlimited'}
                          </span>
                        </div>
                      </div>

                      {/* Info Notice */}
                      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-blue-400 text-xs">
                          💡 Once winners claim their tokens and the liquidity threshold is met, a liquidity pool will be created automatically on the selected DEX (Cook DEX or Raydium). The token price will then be determined by the AMM pool.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-4">Share Raffle</h3>
              <p className="text-slate-400 mb-4">Share this raffle with your friends and community!</p>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/raffle/${raffleData.id}`}
                    readOnly
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/raffle/${raffleData.id}`)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      window.open(`https://twitter.com/intent/tweet?text=Check out this awesome raffle: ${raffleData.name}&url=${window.location.origin}/raffle/${raffleData.id}`);
                      setShowShareModal(false);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <Twitter className="w-4 h-4 mr-2" />
                    Twitter
                  </button>
                  <button
                    onClick={() => {
                      navigator.share({
                        title: raffleData.name,
                        text: `Check out this awesome raffle: ${raffleData.name}`,
                        url: `${window.location.origin}/raffle/${raffleData.id}`
                      });
                      setShowShareModal(false);
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
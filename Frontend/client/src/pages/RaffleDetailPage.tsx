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
import { Connection, PublicKey } from '@solana/web3.js';
import { useLocation, useRoute } from 'wouter';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { raffleService } from '@/lib/raffleService';
import VotingComponent from '@/components/VotingComponent';
import MarketMakingRewards from '@/components/MarketMakingRewards';

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

  // Connection to devnet with better timeout settings
  const connection = new Connection('https://api.devnet.solana.com', {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
    disableRetryOnRateLimit: false,
    httpHeaders: {
      'Content-Type': 'application/json',
    },
  });

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
    }
  }, [connected, publicKey, raffleData]);

  const fetchRaffleData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!raffleId) {
        throw new Error('No raffle ID provided');
      }

      console.log('🔍 Fetching raffle data for ID:', raffleId);
      
      // Use dedicated raffle service to fetch the raffle data
      const raffleData = await raffleService.fetchRaffleById(raffleId);
      
      if (raffleData) {
        setRaffleData(raffleData);
        console.log('✅ Raffle data fetched successfully:', raffleData);
        
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

  // Helper functions removed - now using raffleService

  const fetchUserTickets = async () => {
    if (!publicKey || !raffleData) return;

    try {
      // Fetch real user ticket data from blockchain
      const userTicketData = await raffleService.getUserTicketData(raffleData.id, publicKey.toBase58());
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

  const handleClaimTokens = async () => {
    if (!connected || !publicKey || !signTransaction || !raffleData) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to claim tokens.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Use real blockchain transaction to claim tokens
      const result = await raffleService.claimTokens(
        raffleData.id,
        publicKey.toBase58(),
        signTransaction
      );

      if (result.success) {
        toast({
          title: "Tokens Claimed!",
          description: `Successfully claimed ${result.tokenAmount} tokens.`,
        });
        
        // Refresh user tickets
        await fetchUserTickets();
      } else {
        toast({
          title: "Claim Failed",
          description: result.error || "Failed to claim tokens.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error claiming tokens:', error);
      toast({
        title: "Claim Failed",
        description: error instanceof Error ? error.message : "Failed to claim tokens.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

    try {
      setLoading(true);
      
      // Use real blockchain transaction to claim refund
      const result = await raffleService.claimRefund(
        raffleData.id,
        publicKey.toBase58(),
        signTransaction
      );

      if (result.success) {
        toast({
          title: "Refund Claimed!",
          description: `Successfully claimed ${result.refundAmount} SOL refund.`,
        });
        
        // Refresh user tickets
        await fetchUserTickets();
      } else {
        toast({
          title: "Refund Failed",
          description: result.error || "Failed to claim refund.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error claiming refund:', error);
      toast({
        title: "Refund Failed",
        description: error instanceof Error ? error.message : "Failed to claim refund.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'text-blue-400 bg-blue-500/20';
      case 'active': return 'text-green-400 bg-green-500/20';
      case 'ended': return 'text-orange-400 bg-orange-500/20';
      case 'completed': return 'text-purple-400 bg-purple-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  const getStatusText = (status: string) => {
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

      <div className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Back Button and Refresh */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setLocation('/raffles')}
              className="flex items-center text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Raffles
            </button>
            
            <button
              onClick={fetchRaffleData}
              disabled={loading}
              className="flex items-center text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>

          {/* Banner */}
          <div className="relative mb-8 rounded-2xl overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 h-[400px]">
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
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(raffleData.status)} backdrop-blur-sm bg-black/20`}>
                {getStatusText(raffleData.status)}
              </div>
            </div>
            
            {/* Contract Address Overlay */}
            <div className="absolute top-6 right-6">
              <div className="bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10">
                <div className="text-white text-sm font-medium mb-2">Contract Address</div>
                <div className="flex items-center space-x-3">
                  <code className="text-xs text-gray-200 font-mono bg-black/40 px-3 py-2 rounded-lg">
                    {raffleData.id.slice(0, 8)}...{raffleData.id.slice(-8)}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(raffleData.id);
                      toast({
                        title: "Copied!",
                        description: "Contract address copied to clipboard",
                      });
                    }}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    title="Copy contract address"
                  >
                    <Copy className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Token Name Overlay */}
            <div className="absolute bottom-6 right-6">
              <div className="text-right">
                <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">{raffleData.name}</h1>
                <p className="text-xl text-purple-200 font-semibold drop-shadow-lg">{raffleData.symbol}</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Token Info */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <div className="flex items-start space-x-6 mb-6">
                  {raffleData.image && !raffleData.image.includes('placeholder') && !raffleData.image.includes('data:image') ? (
                    <img 
                      src={raffleData.image} 
                      alt={raffleData.name}
                      className="w-24 h-24 rounded-full border-2 border-purple-500 object-cover flex-shrink-0"
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
                    <div className="w-24 h-24 rounded-full border-2 border-purple-500 bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-xl">
                        {raffleData.symbol ? raffleData.symbol.slice(0, 2) : 'TK'}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-3xl font-bold text-white mb-2 truncate">{raffleData.name}</h1>
                    <p className="text-2xl font-semibold text-purple-400 mb-3">{raffleData.symbol}</p>
                    <p className="text-slate-400 mb-4 line-clamp-2">{raffleData.description}</p>
                    
                    {/* Contract Address Section */}
                    <div className="bg-slate-800 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-slate-400 mb-2">Contract Address</div>
                          <code className="text-sm text-white font-mono bg-slate-700 px-3 py-2 rounded break-all">
                            {raffleData.id}
                          </code>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(raffleData.id);
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-800 rounded-lg p-4">
                        <div className="text-sm text-slate-400 mb-1">Total Supply</div>
                        <div className="text-xl font-semibold text-white">
                          {raffleData.totalSupply ? raffleData.totalSupply.toLocaleString() : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-4">
                        <div className="text-sm text-slate-400 mb-1">Decimals</div>
                        <div className="text-xl font-semibold text-white">
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
                      <span className="text-slate-400">Ticket Price</span>
                      <span className="text-white font-semibold">{raffleData.ticketPrice} SOL</span>
                    </div>
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
            <div className="space-y-6">
              {/* Timer */}
              {timeRemaining && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-orange-400" />
                    Time Remaining
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{timeRemaining.days}</div>
                      <div className="text-xs text-slate-400">Days</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{timeRemaining.hours}</div>
                      <div className="text-xs text-slate-400">Hours</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{timeRemaining.minutes}</div>
                      <div className="text-xs text-slate-400">Minutes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{timeRemaining.seconds}</div>
                      <div className="text-xs text-slate-400">Seconds</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Buy Tickets */}
              {raffleData.status === 'active' && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <Ticket className="w-5 h-5 mr-2 text-green-400" />
                    Buy Tickets
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Number of Tickets
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={raffleData.maxTickets - raffleData.soldTickets}
                        value={ticketCount}
                        onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                      className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
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

              {/* Claim/Refund Section */}
              {(raffleData.status === 'ended' || raffleData.status === 'completed') && connected && (
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
                        disabled={loading}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Award className="w-4 h-4 mr-2" />
                        )}
                        Claim Tokens
                      </button>
                      
                      <button
                        onClick={handleClaimRefund}
                        disabled={loading}
                        className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                      >
                        {loading ? (
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

              {/* Token Metrics - Only show after raffle graduates */}
              {raffleData.status === 'completed' && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-blue-400" />
                    Token Metrics
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Market Cap:</span>
                      <span className="text-white font-semibold">${raffleData.marketCap.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Liquidity:</span>
                      <span className="text-white font-semibold">${raffleData.liquidity.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">24h Volume:</span>
                      <span className="text-white font-semibold">${raffleData.volume24h.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Holders:</span>
                      <span className="text-white font-semibold">{raffleData.holders}</span>
                    </div>
                  </div>
                  
                  {/* Trading Notice */}
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-green-400 text-sm">
                      🎉 This raffle has graduated! Tokens are now tradeable on the AMM.
                    </p>
                  </div>
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
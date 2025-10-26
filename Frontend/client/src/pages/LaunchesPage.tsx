import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search,
  RefreshCw,
  Loader2,
  ExternalLink,
  Clock,
  Zap,
  Star,
  Grid3X3,
  List
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import VotingComponent from '@/components/VotingComponent';
import { launchService } from '@/lib/launchService';
import { LaunchData } from '@/lib/launchDataService';

const LaunchesPage: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const [launches, setLaunches] = useState<LaunchData[]>([]);
  const [filteredLaunches, setFilteredLaunches] = useState<LaunchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'instant' | 'raffle'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'live' | 'ended'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price' | 'volume' | 'hype'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Connection to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Fetch launches from blockchain
  const fetchLaunches = async () => {
    setLoading(true);
    try {
      const fetchedLaunches = await launchService.fetchAllLaunches();
      setLaunches(fetchedLaunches);
      setFilteredLaunches(fetchedLaunches);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch launches. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort launches
  useEffect(() => {
    let filtered = [...launches];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(launch =>
        launch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        launch.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        launch.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(launch => launch.launchType === filterType);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(launch => launch.status === filterStatus);
    }

    // Show all launches for now (both instant and raffle)
    // TODO: In production, you might want to filter raffles based on graduation status
    // filtered = filtered.filter(launch => {
    //   if (launch.launchType === 'raffle') {
    //     return launch.status === 'ended' || launch.status === 'live';
    //   }
    //   return true;
    // });

    // Sort launches
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          const bTime = a.launchDate instanceof Date ? a.launchDate.getTime() : new Date(a.launchDate).getTime();
          const aTime = b.launchDate instanceof Date ? b.launchDate.getTime() : new Date(b.launchDate).getTime();
          return aTime - bTime;
        case 'oldest':
          const aTimeOld = a.launchDate instanceof Date ? a.launchDate.getTime() : new Date(a.launchDate).getTime();
          const bTimeOld = b.launchDate instanceof Date ? b.launchDate.getTime() : new Date(b.launchDate).getTime();
          return aTimeOld - bTimeOld;
        case 'price':
          return b.currentPrice - a.currentPrice;
        case 'volume':
          return b.volume24h - a.volume24h;
        case 'hype':
          return b.hypeScore - a.hypeScore;
        default:
          return 0;
      }
    });

    setFilteredLaunches(filtered);
  }, [launches, searchTerm, filterType, filterStatus, sortBy]);

  // Fetch launches on component mount
  useEffect(() => {
    fetchLaunches();
  }, []);

  // Utility functions
  const formatTimeAgo = (date: Date | number): string => {
    const now = new Date();
    const dateObj = date instanceof Date ? date : new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const formatMarketCap = (marketCap: number): string => {
    if (marketCap >= 1000000) {
      return `${(marketCap / 1000000).toFixed(1)}M`;
    } else if (marketCap >= 1000) {
      return `${(marketCap / 1000).toFixed(1)}K`;
    } else {
      return marketCap.toFixed(2);
    }
  };

  const formatPrice = (price: number): string => {
    if (price < 0.01) {
      return price.toFixed(6);
    } else if (price < 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(2);
    }
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    } else {
      return volume.toFixed(2);
    }
  };

  const LaunchCard: React.FC<{ launch: LaunchData }> = ({ launch }) => {
    const [imageError, setImageError] = useState(false);
    const [currentImageSrc, setCurrentImageSrc] = useState(launch.image);
    
    const progressPercentage = launch.launchType === 'raffle' 
      ? ((launch.soldTickets || 0) / (launch.maxTickets || 1000)) * 100 
      : Math.min(100, (launch.volume24h / launch.marketCap) * 100);

    // Handle image loading with multiple IPFS gateways
    const handleImageError = () => {
      console.log(`🖼️ Image failed to load: ${currentImageSrc}`);
      
      if (currentImageSrc && currentImageSrc.includes('ipfs.io')) {
        // Try alternative IPFS gateway
        const ipfsHash = currentImageSrc.split('/ipfs/')[1];
        if (ipfsHash) {
          const alternativeUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
          console.log(`🔄 Trying alternative gateway: ${alternativeUrl}`);
          setCurrentImageSrc(alternativeUrl);
          return;
        }
      }
      
      if (currentImageSrc && currentImageSrc.includes('gateway.pinata.cloud')) {
        // Try third gateway
        const ipfsHash = currentImageSrc.split('/ipfs/')[1];
        if (ipfsHash) {
          const alternativeUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
          console.log(`🔄 Trying third gateway: ${alternativeUrl}`);
          setCurrentImageSrc(alternativeUrl);
          return;
        }
      }
      
      // All gateways failed
      console.log(`❌ All IPFS gateways failed for image`);
      setImageError(true);
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10 cursor-pointer"
        onClick={() => {
          const route = launch.launchType === 'raffle' ? `/raffle/${launch.id}` : `/launch/${launch.id}`;
          window.location.href = route;
        }}
      >
        {/* Image and Basic Info */}
        <div className="flex items-start space-x-4 mb-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
            {launch.image && !imageError ? (
              <img 
                src={currentImageSrc} 
                alt={launch.name}
                className="w-full h-full object-cover"
                onError={handleImageError}
                onLoad={() => console.log(`✅ Image loaded successfully: ${currentImageSrc}`)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <span className="text-white font-bold text-2xl">
                  {launch.symbol.charAt(0)}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-base truncate">{launch.name}</h3>
              {launch.featured && (
                <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                  <Star className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-1">{launch.symbol}</p>
            <p className="text-gray-500 text-xs mt-1">CA: {launch.baseTokenMint.substring(0, 4)}...{launch.baseTokenMint.substring(launch.baseTokenMint.length - 4)}</p>
          </div>
        </div>

        {/* Time and Market Cap */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2 text-gray-400 text-sm">
            <Clock className="w-4 h-4" />
            <span>{formatTimeAgo(launch.launchDate)}</span>
          </div>
          <div className="text-white font-semibold text-base">
            ${formatMarketCap(launch.marketCap)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-400 mt-2">
            <span>{progressPercentage.toFixed(2)}%</span>
            <span>{launch.launchType === 'raffle' ? `${launch.soldTickets || 0}/${launch.maxTickets || 1000}` : 'Progress'}</span>
          </div>
        </div>

        {/* Voting Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Community Rating</span>
            <VotingComponent
              launchId={launch.id}
              currentVotes={{
                upvotes: launch.hypeScore || 0,
                downvotes: Math.max(0, (launch.participants || 0) - (launch.hypeScore || 0))
              }}
              size="sm"
              onVote={(vote) => {
                console.log(`Vote submitted for ${launch.id}:`, vote);
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button 
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-3 px-4 rounded-lg text-sm transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `/launch/${launch.id}`;
            }}
          >
            Trade
          </button>
          <button 
            className="p-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              // Copy contract address (SPL token mint) to clipboard
              navigator.clipboard.writeText(launch.baseTokenMint);
              toast({
                title: "Copied!",
                description: "Contract address copied to clipboard.",
              });
            }}
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Token Launches</h1>
              <p className="text-gray-400">Discover and trade the latest token launches on Solana</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchLaunches}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search launches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500/50 transition-colors"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
              >
                <option value="all">All Types</option>
                <option value="instant">Instant</option>
                <option value="raffle">Raffle</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
              >
                <option value="all">All Status</option>
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="ended">Ended</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="price">Price</option>
                <option value="volume">Volume</option>
                <option value="hype">Hype Score</option>
              </select>

              <div className="flex items-center bg-white/5 border border-white/10 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-yellow-500 text-white' : 'text-gray-400 hover:text-white'} transition-colors`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-yellow-500 text-white' : 'text-gray-400 hover:text-white'} transition-colors`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mb-4">
          <p className="text-gray-400 text-sm">
            Showing {filteredLaunches.length} of {launches.length} launches
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
            <span className="ml-2 text-gray-400">Loading launches...</span>
          </div>
        )}

        {/* Launches Grid */}
        {!loading && (
          <AnimatePresence>
            <div className={`grid gap-4 ${
              viewMode === 'grid' 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                : 'grid-cols-1'
            }`}>
              {filteredLaunches.map((launch) => (
                <LaunchCard key={launch.id} launch={launch} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Empty State */}
        {!loading && filteredLaunches.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No launches found</h3>
            <p className="text-gray-400 mb-6">
              {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Be the first to create a launch!'
              }
            </p>
            {connected && (
              <button
                onClick={() => window.location.href = '/create-launch'}
                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors"
              >
                Create Launch
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LaunchesPage;
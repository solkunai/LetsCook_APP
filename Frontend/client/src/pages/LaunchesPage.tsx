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
  const fetchLaunches = async (forceRefresh: boolean = false) => {
    setLoading(true);
    try {
      console.log('🔄 Fetching launches...', forceRefresh ? '(force refresh)' : '');
      
      // If force refresh, clear cache first
      if (forceRefresh) {
        const { blockchainIntegrationService } = await import('@/lib/blockchainIntegrationService');
        blockchainIntegrationService.clearCache();
        localStorage.removeItem('blockchain_launches_cache');
        console.log('🗑️ Cache cleared for force refresh');
      }
      
      const fetchedLaunches = await launchService.fetchAllLaunches(forceRefresh);
      console.log('✅ Fetched', fetchedLaunches.length, 'launches');
      
      setLaunches(fetchedLaunches);
      setFilteredLaunches(fetchedLaunches);
      
      if (fetchedLaunches.length === 0 && !forceRefresh) {
        console.warn('⚠️ No launches found. Try force refresh or check console for errors.');
      }
    } catch (error) {
      console.error('❌ Error fetching launches:', error);
      toast({
        title: "Error",
        description: `Failed to fetch launches: ${error instanceof Error ? error.message : 'Unknown error'}. Check console for details.`,
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
    const [launchName, setLaunchName] = useState(launch.name);
    const [launchSymbol, setLaunchSymbol] = useState(launch.symbol);
    
    // PRIORITY 1: Fetch name, symbol, image directly from Supabase (fastest - no IPFS fetch needed)
    // PRIORITY 2: Fetch from IPFS metadata URI if Supabase doesn't have direct values
    useEffect(() => {
      const fetchMetadata = async () => {
        try {
          const { LaunchMetadataService } = await import('@/lib/launchMetadataService');
          const metadata = await LaunchMetadataService.getMetadata(launch.id);
          
          if (metadata) {
            // PRIORITY: Use name, symbol, image directly from Supabase (fastest access)
            if (metadata.name) {
              setLaunchName(metadata.name);
              console.log('✅ Loaded token name from Supabase (fastest):', metadata.name);
            }
            if (metadata.symbol) {
              setLaunchSymbol(metadata.symbol);
              console.log('✅ Loaded token symbol from Supabase (fastest):', metadata.symbol);
            }
            if (metadata.image) {
              setCurrentImageSrc(metadata.image);
              console.log('✅ Loaded token image from Supabase (fastest):', metadata.image);
            }
            
            // PRIORITY 2: Fetch from IPFS only if Supabase doesn't have direct values
            const needsIPFSFetch = !metadata.name || !metadata.symbol || !metadata.image;
            const metadataUri = metadata.metadata_uri || launch.metadataUri;
            
            if (needsIPFSFetch && metadataUri) {
              console.log(`📥 Fetching missing metadata from IPFS (fallback):`, metadataUri);
              try {
                const { getFullTokenMetadata } = await import('@/lib/ipfsMetadataFetcher');
                const fullMetadata = await getFullTokenMetadata(metadataUri);
                
                if (fullMetadata) {
                  // Only update if Supabase didn't provide the value
                  if (!metadata.name && fullMetadata.name) {
                    setLaunchName(fullMetadata.name);
                    console.log('✅ Fetched token name from IPFS (fallback):', fullMetadata.name);
                  }
                  if (!metadata.symbol && fullMetadata.symbol) {
                    setLaunchSymbol(fullMetadata.symbol);
                    console.log('✅ Fetched token symbol from IPFS (fallback):', fullMetadata.symbol);
                  }
                  if (!metadata.image && fullMetadata.image) {
                    setCurrentImageSrc(fullMetadata.image);
                    console.log('✅ Fetched token image from IPFS (fallback):', fullMetadata.image);
                  }
                }
              } catch (ipfsError) {
                console.warn('⚠️ Could not fetch metadata from IPFS (will use blockchain data as fallback):', ipfsError);
              }
            } else if (!needsIPFSFetch) {
              console.log('✅ All metadata (name, symbol, image) loaded from Supabase - skipping IPFS fetch');
            }
          }
        } catch (error) {
          // Non-critical - continue with existing data
          console.log('ℹ️ Could not load metadata from Supabase (non-critical):', error);
        }
      };
      
      fetchMetadata();
    }, [launch.id, launch.metadataUri]);
    
    const progressPercentage = launch.launchType === 'raffle' 
      ? (launch.maxTickets > 0 ? ((launch.soldTickets || 0) / launch.maxTickets) * 100 : 0) 
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
        className="bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10 cursor-pointer"
        onClick={() => {
          const route = launch.launchType === 'raffle' ? `/raffle/${launch.id}` : `/launch/${launch.id}`;
          window.location.href = route;
        }}
      >
        {/* Image and Basic Info */}
        <div className="flex items-start space-x-3 sm:space-x-4 mb-3 sm:mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
            {currentImageSrc && !imageError ? (
              <img 
                src={currentImageSrc} 
                alt={launchName}
                className="w-full h-full object-cover"
                onError={handleImageError}
                onLoad={() => console.log(`✅ Image loaded successfully: ${currentImageSrc}`)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg sm:text-2xl">
                  {launchSymbol.charAt(0)}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-white font-semibold text-sm sm:text-base truncate">{launchName}</h3>
              {launch.featured && (
                <div className="w-4 h-4 sm:w-5 sm:h-5 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                </div>
              )}
            </div>
            <p className="text-gray-400 text-xs sm:text-sm mt-0.5 sm:mt-1">{launchSymbol}</p>
            <p className="text-gray-500 text-xs mt-0.5 sm:mt-1 truncate">CA: {launch.baseTokenMint.substring(0, 4)}...{launch.baseTokenMint.substring(launch.baseTokenMint.length - 4)}</p>
          </div>
        </div>

        {/* Time and Market Cap */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center space-x-1.5 sm:space-x-2 text-gray-400 text-xs sm:text-sm">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="truncate">{formatTimeAgo(launch.launchDate)}</span>
          </div>
          <div className="text-white font-semibold text-sm sm:text-base">
            ${formatMarketCap(launch.marketCap)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3 sm:mb-4">
          <div className="w-full bg-gray-700 rounded-full h-1.5 sm:h-2">
            <div 
              className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-1.5 sm:h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs sm:text-sm text-gray-400 mt-1.5 sm:mt-2">
            <span>{progressPercentage.toFixed(2)}%</span>
            <span className="truncate ml-2">{launch.launchType === 'raffle' ? `${launch.soldTickets || 0}${launch.maxTickets > 0 ? `/${launch.maxTickets}` : ' (unlimited)'}` : 'Progress'}</span>
          </div>
        </div>

        {/* Voting Section */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center justify-between gap-2">
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
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button 
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-xs sm:text-sm transition-colors min-h-[44px]"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `/launch/${launch.id}`;
            }}
          >
            Trade
          </button>
          <button 
            className="p-2.5 sm:p-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              // Copy contract address (SPL token mint) to clipboard
              navigator.clipboard.writeText(launch.baseTokenMint);
              toast({
                title: "Copied!",
                description: "Contract address copied to clipboard.",
              });
            }}
            aria-label="Copy contract address"
          >
            <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Header Section */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">Token Launches</h1>
              <p className="text-sm sm:text-base text-gray-400">Discover and trade the latest token launches on Solana</p>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
              <button
                onClick={fetchLaunches}
                disabled={loading}
                className="flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base min-h-[44px] flex-1 sm:flex-none"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
                <span className="sm:hidden">Refresh</span>
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search launches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-base text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500/50 transition-colors min-h-[44px]"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="flex-1 sm:flex-none px-3 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-sm sm:text-base text-white focus:outline-none focus:border-yellow-500/50 transition-colors min-h-[44px]"
              >
                <option value="all">All Types</option>
                <option value="instant">Instant</option>
                <option value="raffle">Raffle</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="flex-1 sm:flex-none px-3 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-sm sm:text-base text-white focus:outline-none focus:border-yellow-500/50 transition-colors min-h-[44px]"
              >
                <option value="all">All Status</option>
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="ended">Ended</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="flex-1 sm:flex-none px-3 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-sm sm:text-base text-white focus:outline-none focus:border-yellow-500/50 transition-colors min-h-[44px]"
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
                  className={`p-2 sm:p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center ${viewMode === 'grid' ? 'bg-yellow-500 text-white' : 'text-gray-400 hover:text-white'} transition-colors`}
                  aria-label="Grid view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 sm:p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center ${viewMode === 'list' ? 'bg-yellow-500 text-white' : 'text-gray-400 hover:text-white'} transition-colors`}
                  aria-label="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mb-3 sm:mb-4">
          <p className="text-gray-400 text-xs sm:text-sm">
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
          <div className="text-center py-8 sm:py-12">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">No launches found</h3>
            <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-6 px-4">
              {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Be the first to create a launch!'
              }
            </p>
            {connected && (
              <button
                onClick={() => window.location.href = '/create-launch'}
                className="px-4 sm:px-6 py-2.5 sm:py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors text-sm sm:text-base min-h-[44px]"
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
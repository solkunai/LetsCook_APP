import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import VotingComponent from '@/components/VotingComponent';
import FloatingActionButton from '@/components/FloatingActionButton';
import { 
  ChevronRight, 
  ChevronLeft,
  Shield, 
  Zap, 
  Users, 
  TrendingUp, 
  Clock, 
  Star,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Rocket,
  BarChart3,
  Target,
  Globe,
  Loader2,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShoppingCart,
  PieChart,
  Activity,
  Flame,
  ExternalLink,
  Copy,
  Heart,
  Share2,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { launchService } from '@/lib/launchService';
import { enhancedLaunchService } from '@/lib/enhancedLaunchService';
import type { LaunchData } from '@/lib/launchDataService';
import type { EnhancedLaunchData } from '@/lib/enhancedLaunchService';
import BuyTicketsModal from '@/components/BuyTicketsModal';
import { useLocation } from 'wouter';
import { toast } from '@/hooks/use-toast';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, Pie, Tooltip, Legend } from 'recharts';
import { Connection, PublicKey } from '@solana/web3.js';

export default function HomePage() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const [, setLocation] = useLocation();
  const [launches, setLaunches] = useState<EnhancedLaunchData[]>([]);
  const [filteredLaunches, setFilteredLaunches] = useState<EnhancedLaunchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLaunch, setSelectedLaunch] = useState<any>(null);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  
  // Pagination and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'instant' | 'raffle'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'live' | 'ended'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price' | 'volume' | 'hype'>('newest');

  useEffect(() => {
    fetchLaunches();
  }, []);

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

    // Enhanced raffle filtering logic
    filtered = filtered.filter(launch => {
      if (launch.launchType === 'raffle') {
        // For homepage, show raffles based on their status:
        // - 'upcoming': Raffle hasn't started yet
        // - 'live': Raffle is currently running
        // - 'ended': Raffle phase is complete and now tradeable (graduated)
        
        // If filtering by specific status, show that status
        if (filterStatus !== 'all') {
          return launch.status === filterStatus;
        }
        
        // If no status filter, show all raffle statuses
        return true;
      }
      // Show all instant launches
      return true;
    });

    // Sort launches
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.launchDate.getTime() - a.launchDate.getTime();
        case 'oldest':
          return a.launchDate.getTime() - b.launchDate.getTime();
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
    setCurrentPage(1); // Reset to first page when filters change
  }, [launches, searchTerm, filterType, filterStatus, sortBy]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredLaunches.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLaunches = filteredLaunches.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const refreshLaunches = async () => {
    await fetchLaunches();
  };

  const fetchLaunches = async () => {
    try {
      setLoading(true);
      console.log('🔍 HomePage: Fetching enhanced launches from blockchain...');
      
      // Fetch launches using the enhanced service that handles different types
      const fetchedLaunches = await enhancedLaunchService.fetchAllLaunchesEnhanced();
      console.log('✅ HomePage: Fetched enhanced launches:', fetchedLaunches.length);
      
      // Debug: Log each launch's details with type information
      console.log('📊 HomePage Enhanced Launch data:');
      fetchedLaunches.forEach((launch, index) => {
        console.log(`Launch ${index + 1}: ${launch.name}`);
        console.log(`  - Type: ${launch.launchType} (Instant: ${launch.isInstantLaunch}, Raffle: ${launch.isRaffleLaunch}, IDO: ${launch.isIDOLaunch})`);
        console.log(`  - Image URL: "${launch.image}"`);
        console.log(`  - Status: ${launch.status}`);
        console.log(`  - ID: ${launch.id}`);
        console.log(`  - Liquidity Pool: ${launch.liquidityPoolStatus}`);
        console.log(`  - Trading Volume: ${launch.tradingVolume}`);
      });
      
      setLaunches(fetchedLaunches);
    } catch (error) {
      console.error('❌ HomePage: Error fetching enhanced launches:', error);
      setLaunches([]);
      toast({
        title: "Error",
        description: "Failed to fetch launches. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <img 
                  src="/logo.jpg" 
                  alt="Let's Cook Logo" 
                  className="w-10 h-10 object-contain"
                />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Let's Cook
                </h1>
                <p className="text-xs text-muted-foreground">Solana Launchpad</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <nav className="hidden md:flex items-center space-x-6">
                <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </a>
                <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  How it Works
                </a>
                <a href="#launches" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Live Launches
                </a>
                <button 
                  onClick={() => setLocation('/liquidity')}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Liquidity
                </button>
                <button 
                  onClick={() => setLocation('/referrals')}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Referrals
                </button>
              </nav>
              
              <WalletMultiButton className="wallet-adapter-button-custom" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]"></div>
        
        {/* Animated Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] animate-pulse"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
                <Rocket className="w-4 h-4 mr-2" />
                Fair Raffle Launches First
              </Badge>
              
              <div className="flex items-center justify-center mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="mr-4"
                >
                  <img 
                    src="/logo.jpg" 
                    alt="Let's Cook Logo" 
                    className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 object-contain"
                  />
                </motion.div>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
                  <span className="bg-gradient-to-r from-primary via-yellow-400 to-secondary bg-clip-text text-transparent">
                    Let's Cook
                  </span>
                </h1>
              </div>
              
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
                Fair Raffle-Based Token Launches on Solana
              </h2>
              
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                🎫 <span className="text-primary font-semibold">Create Fair Raffle Launches</span> that give everyone equal chances! 
                No more losing your SOL to instant dumps. Our raffle system ensures 
                <span className="text-primary font-semibold"> transparent, fair distribution</span> with 
                guaranteed refunds and community-driven success.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col gap-6 justify-center items-center"
            >
              {/* Main Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <Button 
                  size="lg" 
                  className="group relative overflow-hidden bg-gradient-to-r from-yellow-500 via-yellow-600 to-yellow-700 hover:from-yellow-400 hover:via-yellow-500 hover:to-yellow-600 text-lg px-10 py-5 text-black font-bold shadow-2xl hover:shadow-yellow-500/30 transition-all duration-500 border-2 border-yellow-400 hover:border-yellow-300 transform hover:scale-105 hover:-translate-y-1"
                  onClick={() => setLocation('/create-raffle')}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  <span className="relative z-10 flex items-center">
                    🎫 Create Raffle Launch
                    <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Button>
                
                <Button 
                  size="lg" 
                  className="group relative overflow-hidden bg-white hover:bg-gray-100 text-lg px-10 py-5 text-black font-bold shadow-2xl hover:shadow-gray-500/30 transition-all duration-500 border-2 border-gray-300 hover:border-gray-400 transform hover:scale-105 hover:-translate-y-1"
                  onClick={() => setLocation('/create-launch')}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  <span className="relative z-10 flex items-center">
                    ⚡ Instant Launch
                    <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Button>
              </div>

              {/* Secondary Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="group relative overflow-hidden text-lg px-8 py-4 border-2 border-yellow-500/60 text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300 font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20 backdrop-blur-sm bg-white/5 hover:border-yellow-400"
                  onClick={() => document.getElementById('launches')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <span className="relative z-10 flex items-center">
                    View Active Raffles
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="group relative overflow-hidden text-lg px-8 py-4 border-2 border-blue-500/60 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 backdrop-blur-sm bg-white/5 hover:border-blue-400"
                  onClick={() => setLocation('/trending-raffles')}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <span className="relative z-10 flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Trending Raffles
                  </span>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="group relative overflow-hidden text-lg px-8 py-4 border-2 border-green-500/60 text-green-400 hover:bg-green-500/10 hover:text-green-300 font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20 backdrop-blur-sm bg-white/5 hover:border-green-400"
                  onClick={() => setLocation('/trending-tokens')}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <span className="relative z-10 flex items-center">
                    <BarChart3 className="mr-2 h-5 w-5" />
                    Trending Tokens
                  </span>
                </Button>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto pt-8"
            >
              <StatCard 
                number={loading ? <Loader2 className="w-6 h-6 animate-spin" /> : `$${launches.reduce((sum, launch) => sum + launch.volume24h, 0) / 1000}K+`} 
                label="Total Volume" 
              />
              <StatCard 
                number={loading ? <Loader2 className="w-6 h-6 animate-spin" /> : `${launches.length}+`} 
                label="Active Launches" 
              />
              <StatCard 
                number={loading ? <Loader2 className="w-6 h-6 animate-spin" /> : `${launches.reduce((sum, launch) => sum + launch.participants, 0) / 1000}K+`} 
                label="Active Users" 
              />
              <StatCard 
                number="24/7" 
                label="Support" 
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <Badge variant="outline" className="px-4 py-2">
              <Star className="w-4 h-4 mr-2" />
              Why Choose Let's Cook
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              Built for <span className="bg-gradient-to-r from-primary to-yellow-400 bg-clip-text text-transparent">Fairness</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our platform eliminates the common pitfalls of token launches with innovative solutions
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={Shield}
              title="No More Dev Dumps"
              description="Raffle system prevents instant sell-offs. Losing tickets get refunded, protecting your SOL from shady launches."
              gradient="from-yellow-400 to-yellow-500"
            />
            <FeatureCard
              icon={Zap}
              title="Guaranteed Liquidity"
              description="Automated pool deployment with liquidity thresholds. If not met, all tickets refunded - no failed launches!"
              gradient="from-blue-600 to-blue-700"
            />
            <FeatureCard
              icon={Users}
              title="Equal Chances for All"
              description="Randomized ticket draws give everyone the same shot at tokens, regardless of wallet size or timing."
              gradient="from-yellow-500 to-yellow-600"
            />
            <FeatureCard
              icon={Target}
              title="Customizable Tokenomics"
              description="Developers set allocations for airdrops, marketing, team, and liquidity - all transparent and fair."
              gradient="from-blue-500 to-blue-600"
            />
            <FeatureCard
              icon={Clock}
              title="Real-Time Odds"
              description="Watch your winning chances update live as more tickets sell. Complete transparency in every raffle."
              gradient="from-yellow-300 to-yellow-400"
            />
            <FeatureCard
              icon={Globe}
              title="Mobile-First Experience"
              description="Vibrant, intuitive app for browsing raffles, buying tickets, and claiming winnings on the go."
              gradient="from-blue-400 to-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Live Launches Section */}
      <section id="launches" className="py-20 bg-black">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <Badge variant="outline" className="px-4 py-2 border-yellow-500/30 text-yellow-400">
              <Rocket className="w-4 h-4 mr-2" />
              Token Launches
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">Active</span> Launches
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Discover and participate in token launches and raffles
            </p>
          </motion.div>

          {/* Filter and Search Controls */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search launches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-yellow-500"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-4 items-center">
                {/* Type Filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'all' | 'instant' | 'raffle')}
                  className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:border-yellow-500"
                >
                  <option value="all">All Types</option>
                  <option value="instant">Instant</option>
                  <option value="raffle">Raffle</option>
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'upcoming' | 'live' | 'ended')}
                  className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:border-yellow-500"
                >
                  <option value="all">All Status</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="ended">Ended</option>
                </select>

                {/* Sort Filter */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'price' | 'volume' | 'hype')}
                  className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:border-yellow-500"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="price">Price</option>
                  <option value="volume">Volume</option>
                  <option value="hype">Hype Score</option>
                </select>

                {/* Refresh Button */}
                <Button
                  onClick={refreshLaunches}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="border-gray-700 text-gray-300 hover:text-white hover:border-yellow-500"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Results Info */}
            <div className="flex justify-between items-center text-sm text-gray-400">
              <span>
                Showing {startIndex + 1}-{Math.min(endIndex, filteredLaunches.length)} of {filteredLaunches.length} launches
              </span>
              <span>
                Page {currentPage} of {totalPages}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="flex items-start space-x-4">
                      <div className="w-20 h-20 bg-gray-700 rounded-2xl"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                  </div>
                    </div>
                    <div className="flex justify-between">
                      <div className="h-3 bg-gray-700 rounded w-1/4"></div>
                      <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full"></div>
                    <div className="flex space-x-3">
                      <div className="h-10 bg-gray-700 rounded-lg flex-1"></div>
                      <div className="w-12 h-10 bg-gray-700 rounded-lg"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : currentLaunches && currentLaunches.length > 0 ? (
              currentLaunches.map((launch) => (
                <LaunchCard 
                  key={launch.id} 
                  launch={launch} 
                  onBuyTickets={(launch) => {
                    setSelectedLaunch(launch);
                    setIsBuyModalOpen(true);
                  }}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <Rocket className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-white">No Active Launches</h3>
                <p className="text-gray-400">Check back soon for new token launches!</p>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-4 mt-8">
              <Button
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:text-white hover:border-yellow-500 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              {/* Page Numbers */}
              <div className="flex space-x-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      className={
                        currentPage === pageNum
                          ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                          : "border-gray-700 text-gray-300 hover:text-white hover:border-yellow-500"
                      }
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:text-white hover:border-yellow-500 disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Featured Launches */}
          {launches.filter(launch => launch.featured).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mt-16"
            >
              <div className="text-center space-y-4 mb-12">
                <Badge variant="outline" className="px-4 py-2 border-yellow-500/30 text-yellow-400">
                  <Star className="w-4 h-4 mr-2" />
                  Featured
                </Badge>
                <h3 className="text-2xl font-bold text-white">Featured Launches</h3>
                <p className="text-gray-400">Hand-picked launches worth checking out</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {launches.filter(launch => launch.featured).slice(0, 3).map((launch) => (
                  <LaunchCard 
                    key={launch.id} 
                    launch={launch} 
                    onBuyTickets={(launch) => {
                      setSelectedLaunch(launch);
                      setIsBuyModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <Badge variant="outline" className="px-4 py-2">
              <Rocket className="w-4 h-4 mr-2" />
              Raffle Workflow
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              How <span className="bg-gradient-to-r from-primary to-yellow-400 bg-clip-text text-transparent">Let's Cook</span> Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Fair, transparent, and safe token launches that protect everyone
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <StepCard
              step="01"
              title="Create Raffle"
              description="Set ticket price, winning odds, and liquidity threshold. Customize tokenomics for airdrops, team, and marketing."
              icon={CheckCircle}
            />
            <StepCard
              step="02"
              title="Buy Tickets"
              description="Users buy unlimited tickets during the open period. Real-time odds update as more tickets sell."
              icon={Target}
            />
            <StepCard
              step="03"
              title="Win & Trade"
              description="Winners claim tokens, losers get refunds. First claim triggers automated liquidity pool deployment."
              icon={Rocket}
            />
          </div>
        </div>
      </section>

      {/* Anti-Dev Dump Section */}
      <section className="py-20 bg-gradient-to-br from-yellow-500/10 via-yellow-400/5 to-blue-600/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center space-y-8 max-w-4xl mx-auto"
          >
            <div className="flex items-center justify-center mb-4">
              <span className="text-4xl mr-3">😤</span>
              <h2 className="text-3xl md:text-4xl font-bold text-yellow-500">
                Tired of Dev Dumps?
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-red-500">The Old Way (Broken)</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">❌</span>
                    Devs dump their bags instantly
                  </li>
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">❌</span>
                    Price tanks before you can sell
                  </li>
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">❌</span>
                    Your SOL is gone forever
                  </li>
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">❌</span>
                    No protection, no refunds
                  </li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-yellow-500">Let's Cook (Fixed)</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✅</span>
                    Raffle system prevents dumps
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✅</span>
                    Losing tickets get refunded
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✅</span>
                    Your SOL is protected
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✅</span>
                    Fair chances for everyone
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-primary/20 to-yellow-400/20 rounded-2xl p-6 border border-primary/30">
              <p className="text-lg font-medium mb-2">🍳 Ready to cook up something better?</p>
              <p className="text-muted-foreground">
                Join the revolution against unfair launches. Let's Cook ensures every participant 
                gets a fair shot while protecting your investments.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/10 via-yellow-400/10 to-primary/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center space-y-8 max-w-3xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Cook Up Something Fair?
            </h2>
            <p className="text-xl text-muted-foreground">
              Join the revolution against dev dumps. Launch your token the right way with Let's Cook.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-lg px-8 py-4 text-black font-bold shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-yellow-400 hover:border-yellow-300"
                onClick={() => window.location.href = '/create-launch'}
              >
                🍳 Let's Cook!
                <Rocket className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-4 border-yellow-500 text-yellow-400 hover:bg-yellow-500 hover:text-black font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-yellow-400 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold">Let's Cook</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Buy Tickets Modal */}
      {selectedLaunch && (
        <BuyTicketsModal
          isOpen={isBuyModalOpen}
          onClose={() => {
            setIsBuyModalOpen(false);
            setSelectedLaunch(null);
          }}
          launch={selectedLaunch}
        />
      )}
    </div>
  );
}

function StatCard({ number, label }: { number: React.ReactNode; label: string }) {
  return (
    <div className="text-center space-y-2">
      <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-yellow-400 bg-clip-text text-transparent">
        {number}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function LaunchCard({ 
  launch, 
  isUpcoming = false, 
  onBuyTickets 
}: { 
  launch: EnhancedLaunchData; 
  isUpcoming?: boolean;
  onBuyTickets?: (launch: EnhancedLaunchData) => void;
}) {
  const [, setLocation] = useLocation();
  const [imageError, setImageError] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState(launch.image);

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
      toast({
      title: "Copied!",
      description: "Contract address copied to clipboard.",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10 cursor-pointer"
      onClick={() => setLocation(`/${launch.launchType === 'raffle' ? 'raffle' : 'launch'}/${launch.id}`)}
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
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-base truncate">{launch.name}</h3>
              {launch.featured && (
                <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Star className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            
            {/* Tags positioned below the name to avoid overlap */}
            <div className="flex items-center space-x-2 flex-wrap">
              {/* Enhanced Launch Type Badge */}
              <Badge variant="outline" className={`${
                launch.launchType === 'instant'
                  ? 'border-green-500/30 text-green-400 bg-green-500/10' 
                  : launch.launchType === 'raffle'
                  ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                  : launch.launchType === 'ido'
                  ? 'border-purple-500/30 text-purple-400 bg-purple-500/10'
                  : 'border-blue-500/30 text-blue-400 bg-blue-500/10'
              }`}>
                {launch.launchType === 'instant' ? '⚡ Instant' : 
                 launch.launchType === 'raffle' ? '🎫 Raffle' : 
                 launch.launchType === 'ido' ? '🚀 IDO' : 
                 '📈 Launch'}
              </Badge>
              
              {/* Liquidity Pool Status */}
              {launch.liquidityPoolStatus && (
                <Badge variant="outline" className={`${
                  launch.liquidityPoolStatus === 'active' 
                    ? 'border-green-500/30 text-green-400' 
                    : launch.liquidityPoolStatus === 'pending'
                    ? 'border-yellow-500/30 text-yellow-400'
                    : 'border-red-500/30 text-red-400'
                }`}>
                  {launch.liquidityPoolStatus === 'active' ? '💧 Active' :
                   launch.liquidityPoolStatus === 'pending' ? '⏳ Pending' :
                   '❌ Inactive'}
                </Badge>
              )}
              
              {/* Status Badge */}
              <Badge variant="outline" className={`${
                launch.status === 'live' ? 'border-green-500/30 text-green-400' :
                launch.status === 'upcoming' ? 'border-blue-500/30 text-blue-400' :
                'border-gray-500/30 text-gray-400'
              }`}>
                {launch.status === 'live' ? '🟢 Live' :
                 launch.status === 'upcoming' ? '⏰ Upcoming' :
                 '🔚 Ended'}
              </Badge>
            </div>
          </div>
          <p className="text-gray-400 text-sm mt-2">{launch.symbol}</p>
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

      {/* Enhanced Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-gray-400 text-xs">24h Volume</div>
          <div className="text-white font-semibold text-sm">
            ${formatMarketCap(launch.tradingVolume || launch.volume24h || 0)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-xs">Holders</div>
          <div className="text-white font-semibold text-sm">
            {launch.holdersCount || launch.participants || 0}
          </div>
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
              <span className="text-xs text-muted-foreground">Community Rating</span>
              <VotingComponent
                launchId={launch.id}
                currentVotes={{
                  upvotes: Math.floor(Math.random() * 50) + 10, // Mock data
                  downvotes: Math.floor(Math.random() * 10) + 1
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
          className={`flex-1 font-medium py-3 px-4 rounded-lg text-sm transition-all duration-300 ${
            launch.launchType === 'raffle' 
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold shadow-lg hover:shadow-xl border-2 border-yellow-400 hover:border-yellow-300' 
              : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white border-2 border-blue-500 hover:border-blue-400'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setLocation(`/${launch.launchType === 'raffle' ? 'raffle' : 'launch'}/${launch.id}`);
          }}
        >
          {launch.launchType === 'raffle' 
            ? (launch.status === 'upcoming' ? '⏰ Coming Soon' :
               launch.status === 'live' ? '🎫 Join Raffle' :
               launch.status === 'ended' ? '📈 Trade Now' : '🎫 Join Raffle')
            : 'Trade'}
        </button>
        <button 
          className="p-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-all duration-300 border border-border hover:border-primary/50"
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(launch.baseTokenMint);
          }}
        >
          <ExternalLink className="w-4 h-4" />
        </button>
          </div>
    </motion.div>
  );
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  gradient 
}: { 
  icon: any; 
  title: string; 
  description: string; 
  gradient: string; 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="group"
    >
      <Card className="h-full hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/50">
        <CardContent className="p-6 space-y-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-muted-foreground leading-relaxed">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StepCard({ 
  step, 
  title, 
  description, 
  icon: Icon 
}: { 
  step: string; 
  title: string; 
  description: string; 
  icon: any; 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="text-center space-y-4"
    >
      <div className="relative">
        <div className="w-16 h-16 mx-auto bg-gradient-to-r from-primary to-yellow-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
          {step}
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-background border-2 border-primary rounded-full flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </motion.div>
  );
}
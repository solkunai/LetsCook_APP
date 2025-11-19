import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  DollarSign, 
  ArrowUpRight,
  Filter,
  Search,
  Star,
  Zap,
  Target,
  Calendar,
  Minus
} from 'lucide-react';
import { useLocation } from 'wouter';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { launchService } from '@/lib/launchService';
import { LaunchData } from '@/lib/launchDataService';

const TrendingRafflesPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const [raffles, setRaffles] = useState<LaunchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'live' | 'ended'>('all');

  // Helper function to get rank badge color
  const getRankBadgeColor = (rank: number): string => {
    if (rank === 1) return 'bg-yellow-500 text-black';
    if (rank === 2) return 'bg-gray-400 text-black';
    if (rank === 3) return 'bg-orange-600 text-white';
    return 'bg-slate-600 text-white';
  };

  // Helper function to get trend color
  const getTrendColor = (change: number): string => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-slate-400';
  };

  // Helper function to get trend icon
  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4" />;
    if (change < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  useEffect(() => {
    fetchRaffles();
  }, []);

  const fetchRaffles = async () => {
    try {
      setLoading(true);
      const allLaunches = await launchService.fetchAllLaunches();
      // Filter to only show raffles (no graduation filter - show all raffles)
      const raffleLaunches = allLaunches.filter(launch => launch.launchType === 'raffle');
      setRaffles(raffleLaunches);
    } catch (error) {
      console.error('Error fetching raffles:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRaffles = raffles.filter(raffle => {
    const matchesSearch = raffle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         raffle.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterType === 'all' || raffle.status === filterType;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-black" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Trending Raffles</h1>
          <p className="text-slate-400 text-lg">
            Discover the most popular raffles by volume, participants, and hype
          </p>
        </motion.div>

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Search raffles..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <Select
                  value={filterType}
                  onValueChange={(value) => setFilterType(value as any)}
                >
                  <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="ended">Ended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Trending Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-slate-800/50 border-slate-700">
              <TabsTrigger value="all" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                All Raffles
              </TabsTrigger>
              <TabsTrigger value="trending" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                <TrendingUp className="w-4 h-4 mr-2" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="volume" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                <DollarSign className="w-4 h-4 mr-2" />
                High Volume
              </TabsTrigger>
              <TabsTrigger value="ending" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                <Clock className="w-4 h-4 mr-2" />
                Ending Soon
              </TabsTrigger>
              <TabsTrigger value="new" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                <Star className="w-4 h-4 mr-2" />
                New
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <TrendingRafflesList raffles={filteredRaffles} loading={loading} />
            </TabsContent>
            <TabsContent value="trending" className="mt-6">
              <TrendingRafflesList 
                raffles={filteredRaffles.filter(r => r.hypeScore > 50)} 
                loading={loading} 
              />
            </TabsContent>
            <TabsContent value="volume" className="mt-6">
              <TrendingRafflesList 
                raffles={filteredRaffles.filter(r => r.volume24h > 10)} 
                loading={loading} 
              />
            </TabsContent>
            <TabsContent value="ending" className="mt-6">
              <TrendingRafflesList 
                raffles={filteredRaffles.filter(r => r.status === 'live' && r.soldTickets && r.maxTickets && (r.soldTickets / r.maxTickets) > 0.8)} 
                loading={loading} 
              />
            </TabsContent>
            <TabsContent value="new" className="mt-6">
              <TrendingRafflesList 
                raffles={filteredRaffles.filter(r => r.status === 'upcoming' || r.status === 'live')} 
                loading={loading} 
              />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

const TrendingRafflesList: React.FC<{ raffles: LaunchData[]; loading: boolean }> = ({ 
  raffles, 
  loading 
}) => {
  const [, setLocation] = useLocation();

  // Helper function to get rank badge color
  const getRankBadgeColor = (rank: number): string => {
    if (rank === 1) return 'bg-yellow-500 text-black';
    if (rank === 2) return 'bg-gray-400 text-black';
    if (rank === 3) return 'bg-orange-600 text-white';
    return 'bg-slate-600 text-white';
  };

  // Helper function to get trend color
  const getTrendColor = (change: number): string => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-slate-400';
  };

  // Helper function to get trend icon
  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4" />;
    if (change < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="grid gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-1/4 mb-4"></div>
                <div className="h-6 bg-slate-700 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (raffles.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardContent className="p-12 text-center">
          <Target className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Raffles Found</h3>
          <p className="text-slate-400 mb-6">
            Try adjusting your filters or check back later for new raffles.
          </p>
          <Button 
            onClick={() => setLocation('/create-launch')}
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            Create a Raffle
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {raffles.map((raffle, index) => (
        <motion.div
          key={raffle.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card 
            className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:border-yellow-500/50 transition-all duration-300 cursor-pointer group"
            onClick={() => setLocation(`/raffle/${raffle.id}`)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Token Image */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                    {raffle.image ? (
                      <img 
                        src={raffle.image} 
                        alt={raffle.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {raffle.symbol.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Raffle Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-semibold text-white group-hover:text-yellow-400 transition-colors">
                        {raffle.name}
                      </h3>
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        {raffle.symbol}
                      </Badge>
                      <Badge className={`${
                        raffle.status === 'live' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                        raffle.status === 'upcoming' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                        'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      }`}>
                        {raffle.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-6 text-sm text-slate-400">
                      <div className="flex items-center space-x-1">
                        <Ticket className="w-4 h-4" />
                        <span>Tickets: {raffle.soldTickets || 0}{raffle.maxTickets > 0 ? ` / ${raffle.maxTickets}` : ' (unlimited)'}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <DollarSign className="w-4 h-4" />
                        <span>Price: {raffle.ticketPrice?.toFixed(4) || '0.0000'} SOL</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Zap className="w-4 h-4" />
                        <span>Hype: {raffle.hypeScore}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price and Stats */}
                <div className="text-right">
                  <div className="text-lg font-semibold text-white">
                    {raffle.ticketPrice?.toFixed(4) || '0.0000'} SOL
                  </div>
                  <div className="text-sm text-slate-400">
                    Progress: {raffle.maxTickets > 0 ? Math.round(((raffle.soldTickets || 0) / raffle.maxTickets) * 100) : 0}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default TrendingRafflesPage;

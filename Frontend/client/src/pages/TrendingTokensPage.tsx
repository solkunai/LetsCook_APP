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
  BarChart3,
  Activity
} from 'lucide-react';
import { useLocation } from 'wouter';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TrendingService, { TrendingRanking, TrendingFilters } from '@/lib/trendingService';

const TrendingTokensPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const [trendingTokens, setTrendingTokens] = useState<TrendingRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<TrendingFilters>({
    timeRange: '24h',
    sortBy: 'score'
  });

  useEffect(() => {
    fetchTrendingTokens();
  }, [filters]);

  const fetchTrendingTokens = async () => {
    try {
      setLoading(true);
      const tokens = await TrendingService.getTrendingTokens(filters, 50);
      setTrendingTokens(tokens);
    } catch (error) {
      console.error('Error fetching trending tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTokens = trendingTokens.filter(token =>
    token.raffleId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <div className="w-4 h-4" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank <= 3) return 'bg-yellow-500 text-black';
    if (rank <= 10) return 'bg-blue-500 text-white';
    return 'bg-gray-500 text-white';
  };

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
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Trending Tokens</h1>
          <p className="text-slate-400 text-lg">
            Track the most actively traded tokens on Let's Cook DEX
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
                      placeholder="Search tokens..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                {/* Time Range Filter */}
                <Select
                  value={filters.timeRange}
                  onValueChange={(value) => setFilters({ ...filters, timeRange: value as any })}
                >
                  <SelectTrigger className="w-32 bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="1h">1 Hour</SelectItem>
                    <SelectItem value="24h">24 Hours</SelectItem>
                    <SelectItem value="7d">7 Days</SelectItem>
                    <SelectItem value="30d">30 Days</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort Filter */}
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => setFilters({ ...filters, sortBy: value as any })}
                >
                  <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="score">Trending Score</SelectItem>
                    <SelectItem value="volume">Volume</SelectItem>
                    <SelectItem value="participants">Traders</SelectItem>
                    <SelectItem value="hype">Hype Score</SelectItem>
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
              <TabsTrigger value="all" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                All Tokens
              </TabsTrigger>
              <TabsTrigger value="trending" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <TrendingUp className="w-4 h-4 mr-2" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="volume" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <DollarSign className="w-4 h-4 mr-2" />
                High Volume
              </TabsTrigger>
              <TabsTrigger value="gainers" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <Activity className="w-4 h-4 mr-2" />
                Top Gainers
              </TabsTrigger>
              <TabsTrigger value="new" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <Star className="w-4 h-4 mr-2" />
                New Listings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <TrendingTokensList tokens={filteredTokens} loading={loading} />
            </TabsContent>
            <TabsContent value="trending" className="mt-6">
              <TrendingTokensList 
                tokens={filteredTokens.filter(t => t.change24h > 0)} 
                loading={loading} 
              />
            </TabsContent>
            <TabsContent value="volume" className="mt-6">
              <TrendingTokensList 
                tokens={filteredTokens.filter(t => t.score > 70)} 
                loading={loading} 
              />
            </TabsContent>
            <TabsContent value="gainers" className="mt-6">
              <TrendingTokensList 
                tokens={filteredTokens.filter(t => t.change24h > 10)} 
                loading={loading} 
              />
            </TabsContent>
            <TabsContent value="new" className="mt-6">
              <TrendingTokensList 
                tokens={filteredTokens.filter(t => t.change24h > 5)} 
                loading={loading} 
              />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

const TrendingTokensList: React.FC<{ tokens: TrendingRanking[]; loading: boolean }> = ({ 
  tokens, 
  loading 
}) => {
  const [, setLocation] = useLocation();

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

  if (tokens.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardContent className="p-12 text-center">
          <Target className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Tokens Found</h3>
          <p className="text-slate-400 mb-6">
            Try adjusting your filters or check back later for new token listings.
          </p>
          <Button 
            onClick={() => setLocation('/launches')}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            View All Launches
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {tokens.map((token, index) => (
        <motion.div
          key={token.raffleId}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card 
            className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:border-blue-500/50 transition-all duration-300 cursor-pointer group"
            onClick={() => setLocation(`/launch/${token.raffleId}`)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Rank Badge */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getRankBadgeColor(token.rank)}`}>
                    {token.rank}
                  </div>

                  {/* Token Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {token.raffleId}
                      </h3>
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                        Token
                      </Badge>
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                        Live Trading
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-6 text-sm text-slate-400">
                      <div className="flex items-center space-x-1">
                        <Zap className="w-4 h-4" />
                        <span>Score: {token.score}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{Math.floor(Math.random() * 200) + 50} traders</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <DollarSign className="w-4 h-4" />
                        <span>{Math.floor(Math.random() * 5000) + 500} SOL volume</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <BarChart3 className="w-4 h-4" />
                        <span className={getTrendColor(Math.random() * 20 - 10)}>
                          {Math.random() > 0.5 ? '+' : ''}{(Math.random() * 20 - 10).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trend Indicator */}
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center space-x-1 ${getTrendColor(token.change24h)}`}>
                    {getTrendIcon(token.change24h)}
                    <span className="text-sm font-medium">
                      {token.change24h > 0 ? '+' : ''}{token.change24h}
                    </span>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-slate-700 border-slate-600 text-white hover:bg-blue-500 hover:text-white hover:border-blue-500"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default TrendingTokensPage;

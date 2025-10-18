import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Zap,
  Target,
  Award,
  Trophy,
  Star,
  Activity,
  PieChart,
  LineChart,
  Calendar,
  Clock,
  Eye,
  Download
} from 'lucide-react';

interface UserStats {
  totalVolume: number;
  totalTrades: number;
  totalLaunches: number;
  totalEarnings: number;
  winRate: number;
  averageHoldTime: number;
  favoriteCategory: string;
  rank: number;
  saucePoints: number;
  achievements: number;
}

interface TradingData {
  date: string;
  volume: number;
  trades: number;
  profit: number;
}

interface LaunchData {
  id: string;
  name: string;
  symbol: string;
  launchDate: Date;
  currentPrice: number;
  launchPrice: number;
  volume: number;
  status: 'active' | 'completed' | 'failed';
}

const mockUserStats: UserStats = {
  totalVolume: 125000,
  totalTrades: 456,
  totalLaunches: 12,
  totalEarnings: 15600,
  winRate: 78.5,
  averageHoldTime: 14,
  favoriteCategory: 'DeFi',
  rank: 42,
  saucePoints: 2840,
  achievements: 18,
};

const mockTradingData: TradingData[] = [
  { date: '2024-01-01', volume: 5000, trades: 12, profit: 800 },
  { date: '2024-01-02', volume: 7500, trades: 18, profit: 1200 },
  { date: '2024-01-03', volume: 3200, trades: 8, profit: -200 },
  { date: '2024-01-04', volume: 9800, trades: 22, profit: 1800 },
  { date: '2024-01-05', volume: 12000, trades: 28, profit: 2200 },
  { date: '2024-01-06', volume: 8500, trades: 19, profit: 1400 },
  { date: '2024-01-07', volume: 15000, trades: 35, profit: 2800 },
];

const mockLaunchData: LaunchData[] = [
  {
    id: 'launch_1',
    name: 'ChefCoin',
    symbol: 'CHEF',
    launchDate: new Date('2024-01-15'),
    currentPrice: 0.025,
    launchPrice: 0.01,
    volume: 45000,
    status: 'active'
  },
  {
    id: 'launch_2',
    name: 'GameFi Protocol',
    symbol: 'GAME',
    launchDate: new Date('2024-01-20'),
    currentPrice: 0.18,
    launchPrice: 0.15,
    volume: 32000,
    status: 'active'
  },
  {
    id: 'launch_3',
    name: 'DeFi Yield',
    symbol: 'YIELD',
    launchDate: new Date('2024-01-10'),
    currentPrice: 0.012,
    launchPrice: 0.02,
    volume: 18000,
    status: 'completed'
  }
];

const categoryColors = {
  'DeFi': 'bg-green-100 text-green-800',
  'Meme': 'bg-pink-100 text-pink-800',
  'Gaming': 'bg-purple-100 text-purple-800',
  'NFT': 'bg-orange-100 text-orange-800',
  'Utility': 'bg-blue-100 text-blue-800',
};

const statusColors = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
};

export default function UserStatsPage() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');

  const calculateROI = (currentPrice: number, launchPrice: number) => {
    return ((currentPrice - launchPrice) / launchPrice) * 100;
  };

  const totalProfit = mockLaunchData.reduce((sum, launch) => {
    const roi = calculateROI(launch.currentPrice, launch.launchPrice);
    return sum + (roi > 0 ? roi : 0);
  }, 0);

  const averageROI = totalProfit / mockLaunchData.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            User Analytics
          </h1>
          <p className="text-gray-600 text-lg">
            Track your performance and trading insights
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm">Total Volume</p>
                  <p className="text-2xl font-bold">${mockUserStats.totalVolume.toLocaleString()}</p>
                </div>
                <DollarSign className="w-8 h-8 text-indigo-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Total Earnings</p>
                  <p className="text-2xl font-bold">${mockUserStats.totalEarnings.toLocaleString()}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Win Rate</p>
                  <p className="text-2xl font-bold">{mockUserStats.winRate}%</p>
                </div>
                <Target className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Rank</p>
                  <p className="text-2xl font-bold">#{mockUserStats.rank}</p>
                </div>
                <Trophy className="w-8 h-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-5 bg-white shadow-lg">
            <TabsTrigger 
              value="overview"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="trading"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <LineChart className="w-4 h-4" />
              Trading
            </TabsTrigger>
            <TabsTrigger 
              value="launches"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <Zap className="w-4 h-4" />
              Launches
            </TabsTrigger>
            <TabsTrigger 
              value="achievements"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <Award className="w-4 h-4" />
              Achievements
            </TabsTrigger>
            <TabsTrigger 
              value="export"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <Download className="w-4 h-4" />
              Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Portfolio Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm">DeFi Tokens</span>
                      </div>
                      <span className="font-medium">45%</span>
                    </div>
                    <Progress value={45} className="h-2" />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
                        <span className="text-sm">Meme Tokens</span>
                      </div>
                      <span className="font-medium">30%</span>
                    </div>
                    <Progress value={30} className="h-2" />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <span className="text-sm">Gaming Tokens</span>
                      </div>
                      <span className="font-medium">15%</span>
                    </div>
                    <Progress value={15} className="h-2" />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-sm">NFT Tokens</span>
                      </div>
                      <span className="font-medium">10%</span>
                    </div>
                    <Progress value={10} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Average ROI</span>
                      <span className="font-bold text-green-600">+{averageROI.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Trades</span>
                      <span className="font-bold">{mockUserStats.totalTrades}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Average Hold Time</span>
                      <span className="font-bold">{mockUserStats.averageHoldTime} days</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Sauce Points</span>
                      <span className="font-bold text-purple-600">{mockUserStats.saucePoints}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Achievements</span>
                      <span className="font-bold">{mockUserStats.achievements}/25</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trading" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LineChart className="w-5 h-5" />
                    Trading Performance
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">7D</Button>
                    <Button variant="outline" size="sm">30D</Button>
                    <Button variant="outline" size="sm">90D</Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockTradingData.map((day, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-medium text-gray-600">
                          {new Date(day.date).toLocaleDateString()}
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">Volume: </span>
                          <span className="font-medium">${day.volume.toLocaleString()}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">Trades: </span>
                          <span className="font-medium">{day.trades}</span>
                        </div>
                      </div>
                      <div className={`text-sm font-bold ${
                        day.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {day.profit >= 0 ? '+' : ''}${day.profit.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="launches" className="mt-6">
            <div className="space-y-6">
              {mockLaunchData.map((launch) => {
                const roi = calculateROI(launch.currentPrice, launch.launchPrice);
                return (
                  <Card key={launch.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">{launch.name}</CardTitle>
                          <CardDescription>{launch.symbol}</CardDescription>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${
                            roi >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                          </div>
                          <p className="text-sm text-gray-600">ROI</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Launch Price</p>
                          <p className="font-medium">${launch.launchPrice}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Current Price</p>
                          <p className="font-medium">${launch.currentPrice}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Volume</p>
                          <p className="font-medium">${launch.volume.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Status</p>
                          <Badge className={statusColors[launch.status]}>
                            {launch.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="achievements" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { name: 'First Trade', description: 'Complete your first trade', unlocked: true, points: 10 },
                { name: 'Volume Trader', description: 'Trade $10,000 worth', unlocked: true, points: 50 },
                { name: 'Launch Master', description: 'Create 5 successful launches', unlocked: false, points: 100 },
                { name: 'DeFi Expert', description: 'Trade 50 DeFi tokens', unlocked: true, points: 75 },
                { name: 'Meme King', description: 'Trade 100 meme tokens', unlocked: false, points: 200 },
                { name: 'Achievement Hunter', description: 'Unlock 25 achievements', unlocked: false, points: 500 },
              ].map((achievement, index) => (
                <Card key={index} className={`${
                  achievement.unlocked 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' 
                    : 'bg-white border-gray-200'
                }`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        achievement.unlocked 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{achievement.name}</CardTitle>
                        <CardDescription>{achievement.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="font-semibold">{achievement.points} points</span>
                      </div>
                      {achievement.unlocked && (
                        <Badge className="bg-green-100 text-green-800">Unlocked</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="export" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Export Data
                </CardTitle>
                <CardDescription>
                  Download your trading data and analytics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Export Trading History (CSV)
                    </Button>
                    <Button className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Export Launch Data (JSON)
                    </Button>
                    <Button className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Export Analytics Report (PDF)
                    </Button>
                    <Button className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Export All Data (ZIP)
                    </Button>
                  </div>
                  
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Export Options</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p>• CSV files include all trading transactions with timestamps</p>
                      <p>• JSON files contain structured launch and token data</p>
                      <p>• PDF reports include charts and performance metrics</p>
                      <p>• ZIP archives contain all data in multiple formats</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

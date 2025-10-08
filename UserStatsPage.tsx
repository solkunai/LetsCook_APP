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

export default function UserStatsPage() {
  const [selectedTab, setSelectedTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            User Analytics
          </h1>
          <p className="text-gray-600 text-lg">
            Track your performance and trading insights
          </p>
        </div>

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

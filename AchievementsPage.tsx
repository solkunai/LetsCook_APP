import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  Star, 
  Zap, 
  Target, 
  Users, 
  TrendingUp, 
  Gift,
  Award,
  Crown,
  Flame,
  CheckCircle,
  Clock,
  Lock
} from 'lucide-react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'trading' | 'launch' | 'social' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  reward?: {
    type: 'sauce_points' | 'nft' | 'token';
    amount?: number;
    description: string;
  };
  unlockedAt?: Date;
}

const mockAchievements: Achievement[] = [
  {
    id: 'first_trade',
    title: 'First Trade',
    description: 'Complete your first token swap',
    icon: <Zap className="w-6 h-6" />,
    category: 'trading',
    rarity: 'common',
    points: 10,
    unlocked: true,
    progress: 1,
    maxProgress: 1,
    reward: { type: 'sauce_points', amount: 10, description: '10 Sauce Points' },
    unlockedAt: new Date('2024-01-15')
  },
  {
    id: 'volume_trader',
    title: 'Volume Trader',
    description: 'Trade $10,000 worth of tokens',
    icon: <TrendingUp className="w-6 h-6" />,
    category: 'trading',
    rarity: 'rare',
    points: 50,
    unlocked: false,
    progress: 3500,
    maxProgress: 10000,
    reward: { type: 'sauce_points', amount: 50, description: '50 Sauce Points' }
  }
];

const rarityColors = {
  common: 'bg-gray-100 text-gray-800',
  rare: 'bg-blue-100 text-blue-800',
  epic: 'bg-purple-100 text-purple-800',
  legendary: 'bg-yellow-100 text-yellow-800'
};

export default function AchievementsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const categories = [
    { id: 'all', label: 'All', icon: <Award className="w-4 h-4" /> },
    { id: 'trading', label: 'Trading', icon: <Zap className="w-4 h-4" /> },
    { id: 'launch', label: 'Launch', icon: <Star className="w-4 h-4" /> },
    { id: 'social', label: 'Social', icon: <Users className="w-4 h-4" /> },
    { id: 'special', label: 'Special', icon: <Crown className="w-4 h-4" /> }
  ];

  const filteredAchievements = selectedCategory === 'all' 
    ? mockAchievements 
    : mockAchievements.filter(achievement => achievement.category === selectedCategory);

  const unlockedAchievements = mockAchievements.filter(a => a.unlocked);
  const totalPoints = unlockedAchievements.reduce((sum, a) => sum + a.points, 0);
  const completionRate = (unlockedAchievements.length / mockAchievements.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Achievements
          </h1>
          <p className="text-gray-600 text-lg">
            Unlock rewards and showcase your platform mastery
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Total Points</p>
                  <p className="text-2xl font-bold">{totalPoints}</p>
                </div>
                <Trophy className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Unlocked</p>
                  <p className="text-2xl font-bold">{unlockedAchievements.length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Completion</p>
                  <p className="text-2xl font-bold">{Math.round(completionRate)}%</p>
                </div>
                <Target className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Rank</p>
                  <p className="text-2xl font-bold">#42</p>
                </div>
                <Crown className="w-8 h-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-8">
          <TabsList className="grid w-full grid-cols-5 bg-white shadow-lg">
            {categories.map((category) => (
              <TabsTrigger 
                key={category.id} 
                value={category.id}
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
              >
                {category.icon}
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAchievements.map((achievement) => (
                <Card 
                  key={achievement.id} 
                  className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                    achievement.unlocked 
                      ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="absolute top-4 right-4">
                    <Badge className={rarityColors[achievement.rarity]}>
                      {achievement.rarity}
                    </Badge>
                  </div>

                  {!achievement.unlocked && (
                    <div className="absolute top-4 left-4">
                      <Lock className="w-5 h-5 text-gray-400" />
                    </div>
                  )}

                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${
                        achievement.unlocked 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {achievement.icon}
                      </div>
                      <div className="flex-1">
                        <CardTitle className={`text-lg ${
                          achievement.unlocked ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {achievement.title}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <CardDescription className="mb-4 text-gray-600">
                      {achievement.description}
                    </CardDescription>

                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Progress</span>
                        <span>{achievement.progress}/{achievement.maxProgress}</span>
                      </div>
                      <Progress 
                        value={(achievement.progress / achievement.maxProgress) * 100} 
                        className="h-2"
                      />
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="font-semibold text-gray-700">
                          {achievement.points} points
                        </span>
                      </div>
                      {achievement.unlocked && achievement.unlockedAt && (
                        <div className="flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>Unlocked</span>
                        </div>
                      )}
                    </div>

                    {achievement.reward && (
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Gift className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800">
                            Reward: {achievement.reward.description}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Clock, 
  Star,
  Zap,
  Target,
  Award,
  ThumbsUp,
  ThumbsDown,
  Eye,
  MessageCircle,
  Share2
} from 'lucide-react';

interface LaunchVote {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  creator: string;
  launchDate: Date;
  hypeScore: number;
  totalVotes: number;
  upvotes: number;
  downvotes: number;
  userVote?: 'up' | 'down' | null;
  category: 'meme' | 'utility' | 'defi' | 'gaming' | 'nft';
  tags: string[];
  status: 'upcoming' | 'live' | 'ended';
}

const mockLaunches: LaunchVote[] = [
  {
    id: 'launch_1',
    name: 'ChefCoin',
    symbol: 'CHEF',
    description: 'The ultimate meme coin for cooking enthusiasts. Join the culinary revolution!',
    image: '/api/placeholder/300/200',
    creator: 'ChefMaster',
    launchDate: new Date('2024-02-15'),
    hypeScore: 85,
    totalVotes: 1247,
    upvotes: 1089,
    downvotes: 158,
    userVote: 'up',
    category: 'meme',
    tags: ['cooking', 'meme', 'community'],
    status: 'live'
  },
  {
    id: 'launch_2',
    name: 'GameFi Protocol',
    symbol: 'GAME',
    description: 'Revolutionary gaming protocol with play-to-earn mechanics and NFT integration.',
    image: '/api/placeholder/300/200',
    creator: 'GameDevPro',
    launchDate: new Date('2024-02-20'),
    hypeScore: 92,
    totalVotes: 2156,
    upvotes: 1987,
    downvotes: 169,
    userVote: null,
    category: 'gaming',
    tags: ['gaming', 'defi', 'nft', 'p2e'],
    status: 'upcoming'
  }
];

const categoryColors = {
  meme: 'bg-pink-100 text-pink-800',
  utility: 'bg-blue-100 text-blue-800',
  defi: 'bg-green-100 text-green-800',
  gaming: 'bg-purple-100 text-purple-800',
  nft: 'bg-orange-100 text-orange-800'
};

const statusColors = {
  upcoming: 'bg-yellow-100 text-yellow-800',
  live: 'bg-green-100 text-green-800',
  ended: 'bg-gray-100 text-gray-800'
};

export default function HypeVotingPage() {
  const [selectedTab, setSelectedTab] = useState('trending');
  const [votedLaunches, setVotedLaunches] = useState<Set<string>>(new Set(['launch_1']));

  const handleVote = (launchId: string, vote: 'up' | 'down') => {
    console.log(`Voting ${vote} for launch ${launchId}`);
    setVotedLaunches(prev => new Set([...prev, launchId]));
  };

  const sortedLaunches = [...mockLaunches].sort((a, b) => {
    switch (selectedTab) {
      case 'trending':
        return b.hypeScore - a.hypeScore;
      case 'newest':
        return b.launchDate.getTime() - a.launchDate.getTime();
      case 'most_voted':
        return b.totalVotes - a.totalVotes;
      default:
        return 0;
    }
  });

  const getHypeColor = (score: number) => {
    if (score >= 90) return 'text-red-500';
    if (score >= 80) return 'text-orange-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-gray-500';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-4">
            Hype Voting
          </h1>
          <p className="text-gray-600 text-lg">
            Vote on upcoming launches and discover the next big thing
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Total Votes</p>
                  <p className="text-2xl font-bold">5,862</p>
                </div>
                <ThumbsUp className="w-8 h-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-500 to-pink-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm">Active Launches</p>
                  <p className="text-2xl font-bold">{mockLaunches.length}</p>
                </div>
                <Zap className="w-8 h-8 text-red-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-pink-500 to-purple-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-pink-100 text-sm">Your Votes</p>
                  <p className="text-2xl font-bold">{votedLaunches.size}</p>
                </div>
                <Target className="w-8 h-8 text-pink-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Accuracy</p>
                  <p className="text-2xl font-bold">87%</p>
                </div>
                <Award className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-lg">
            <TabsTrigger 
              value="trending"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white"
            >
              <Flame className="w-4 h-4" />
              Trending
            </TabsTrigger>
            <TabsTrigger 
              value="newest"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white"
            >
              <Clock className="w-4 h-4" />
              Newest
            </TabsTrigger>
            <TabsTrigger 
              value="most_voted"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white"
            >
              <Users className="w-4 h-4" />
              Most Voted
            </TabsTrigger>
            <TabsTrigger 
              value="my_votes"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white"
            >
              <Star className="w-4 h-4" />
              My Votes
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-6">
            <div className="space-y-6">
              {sortedLaunches.map((launch) => (
                <Card key={launch.id} className="overflow-hidden hover:shadow-xl transition-all duration-300">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-1/3">
                      <img 
                        src={launch.image} 
                        alt={launch.name}
                        className="w-full h-48 md:h-full object-cover"
                      />
                    </div>

                    <div className="md:w-2/3 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900 mb-2">
                            {launch.name}
                          </h3>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={categoryColors[launch.category]}>
                              {launch.category}
                            </Badge>
                            <Badge className={statusColors[launch.status]}>
                              {launch.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-3xl font-bold ${getHypeColor(launch.hypeScore)}`}>
                            {launch.hypeScore}
                          </div>
                          <p className="text-sm text-gray-600">Hype Score</p>
                        </div>
                      </div>

                      <p className="text-gray-600 mb-4">{launch.description}</p>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {launch.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-900">{launch.totalVotes}</p>
                          <p className="text-sm text-gray-600">Total Votes</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">{launch.upvotes}</p>
                          <p className="text-sm text-gray-600">Upvotes</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-600">{launch.downvotes}</p>
                          <p className="text-sm text-gray-600">Downvotes</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">
                            {launch.launchDate.toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-600">Launch Date</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-4">
                        <Button
                          onClick={() => handleVote(launch.id, 'up')}
                          className={`flex items-center gap-2 ${
                            launch.userVote === 'up' 
                              ? 'bg-green-500 hover:bg-green-600' 
                              : 'bg-gray-100 hover:bg-green-100 text-gray-700 hover:text-green-700'
                          }`}
                          disabled={votedLaunches.has(launch.id)}
                        >
                          <ThumbsUp className="w-4 h-4" />
                          Vote Up
                        </Button>
                        <Button
                          onClick={() => handleVote(launch.id, 'down')}
                          className={`flex items-center gap-2 ${
                            launch.userVote === 'down' 
                              ? 'bg-red-500 hover:bg-red-600' 
                              : 'bg-gray-100 hover:bg-red-100 text-gray-700 hover:text-red-700'
                          }`}
                          disabled={votedLaunches.has(launch.id)}
                        >
                          <ThumbsDown className="w-4 h-4" />
                          Vote Down
                        </Button>
                        <Button variant="outline" className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

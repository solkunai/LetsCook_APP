import React, { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Users, 
  DollarSign,
  PieChart,
  BarChart3,
  Wallet,
  RefreshCw,
  Star,
  Share2,
  ExternalLink
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useToast } from '@/hooks/use-toast';
import { launchDataService } from '@/lib/launchDataService';
import { marketDataService } from '@/lib/marketDataService';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, Pie, Tooltip, Legend } from 'recharts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer as LineResponsiveContainer } from 'recharts';
import Header from '@/components/Header';

interface TokenData {
  id: string;
  name: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  totalSupply: number;
  circulatingSupply: number;
  holders: number;
  liquidity: number;
  distribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  priceHistory: Array<{
    time: string;
    price: number;
  }>;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
}

export default function TokenDetailPage() {
  const { tokenId } = useParams();
  const { connected, publicKey, signTransaction } = useWallet();
  const { toast } = useToast();
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [isTrading, setIsTrading] = useState(false);

  // Fetch real token data from blockchain
  useEffect(() => {
    const fetchTokenData = async () => {
      if (!tokenId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Get launch data by token mint
        const launch = await launchDataService.getLaunchByTokenMint(tokenId);
        
        if (!launch) {
          setTokenData(null);
          setIsLoading(false);
          return;
        }

        // Get market data
        const marketData = await marketDataService.getMarketData(tokenId, launch.totalSupply);
        
        // Get price history
        const priceHistory = await marketDataService.getPriceHistory(tokenId, '24h');
        
        const tokenData: TokenData = {
          id: launch.id,
          name: launch.name,
          symbol: launch.symbol,
          price: marketData.price,
          priceChange24h: marketData.priceChange24h,
          volume24h: marketData.volume24h,
          marketCap: marketData.marketCap,
          totalSupply: launch.totalSupply,
          circulatingSupply: launch.totalSupply - (marketData.liquidity / 2 / marketData.price || 0),
          holders: 0, // Removed as per user request
          liquidity: marketData.liquidity,
          distribution: [], // Would need to calculate from launch data
          priceHistory: priceHistory.map((point) => ({
            time: new Date(point.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            price: point.price
          })),
          description: launch.description || '',
          website: launch.website || '',
          twitter: launch.twitter || '',
          telegram: launch.telegram || '',
          discord: launch.discord || ''
        };
        
        setTokenData(tokenData);
      } catch (error) {
        console.error('Error fetching token data:', error);
        toast({
          title: "Error",
          description: "Failed to load token data",
          variant: "destructive"
        });
        setTokenData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokenData();
  }, [tokenId, toast]);

  const handleBuy = async () => {
    if (!connected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to trade.",
        variant: "destructive",
      });
      return;
    }

    if (!publicKey || !tokenData) return;
    
    setIsTrading(true);
    try {
      // Use real trading service
      const { tradingService } = await import('@/lib/tradingService');
      
      if (!signTransaction) {
        throw new Error('Wallet signTransaction not available');
      }
      
      const result = await tradingService.buyTokensAMM(
        tokenId,
        publicKey.toBase58(),
        parseFloat(buyAmount),
        signTransaction,
        'cook'
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Buy failed');
      }
      
      toast({
        title: "Buy Order Executed",
        description: `Successfully bought ${buyAmount} ${tokenData.symbol} tokens.`,
      });
      setBuyAmount('');
    } catch (error) {
      toast({
        title: "Buy Failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsTrading(false);
    }
  };

  const handleSell = async () => {
    if (!connected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to trade.",
        variant: "destructive",
      });
      return;
    }

    if (!publicKey || !tokenData) return;
    
    setIsTrading(true);
    try {
      // Use real trading service
      const { tradingService } = await import('@/lib/tradingService');
      
      if (!signTransaction) {
        throw new Error('Wallet signTransaction not available');
      }
      
      const result = await tradingService.sellTokensAMM(
        tokenId,
        publicKey.toBase58(),
        parseFloat(sellAmount),
        signTransaction,
        'cook'
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Sell failed');
      }
      
      toast({
        title: "Sell Order Executed",
        description: `Successfully sold ${sellAmount} ${tokenData.symbol} tokens.`,
      });
      setSellAmount('');
    } catch (error) {
      toast({
        title: "Sell Failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsTrading(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!connected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to add liquidity.",
        variant: "destructive",
      });
      return;
    }

    // Real liquidity logic would go here
    toast({
      title: "Add Liquidity",
      description: "Liquidity addition feature coming soon!",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading token data...</p>
        </div>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p>Token not found</p>
          <Button onClick={() => window.history.back()} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        title={tokenData.name}
        subtitle={tokenData.symbol}
        showNavigation={true}
      />

      <div className="container mx-auto p-6 pt-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Price Chart
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <LineResponsiveContainer width="100%" height="100%">
                    <LineChart data={tokenData.priceHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </LineResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Token Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Token Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={tokenData.distribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {tokenData.distribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle>About {tokenData.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{tokenData.description}</p>
                <div className="flex flex-wrap gap-2">
                  {tokenData.website && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={tokenData.website} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Website
                      </a>
                    </Button>
                  )}
                  {tokenData.twitter && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://twitter.com/${tokenData.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Twitter
                      </a>
                    </Button>
                  )}
                  {tokenData.telegram && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={tokenData.telegram} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Telegram
                      </a>
                    </Button>
                  )}
                  {tokenData.discord && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={tokenData.discord} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Discord
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Price Info */}
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold">
                    ${tokenData.price.toFixed(6)}
                  </div>
                  <div className={`flex items-center justify-center gap-1 ${
                    tokenData.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {tokenData.priceChange24h >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {tokenData.priceChange24h >= 0 ? '+' : ''}{tokenData.priceChange24h}%
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trading */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Trade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="buy" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="buy">Buy</TabsTrigger>
                    <TabsTrigger value="sell">Sell</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="buy" className="space-y-4">
                    <div>
                      <Label htmlFor="buyAmount">Amount (SOL)</Label>
                      <Input
                        id="buyAmount"
                        type="number"
                        placeholder="0.0"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      You'll receive: {buyAmount ? (parseFloat(buyAmount) / tokenData.price).toFixed(2) : '0'} {tokenData.symbol}
                    </div>
                    <Button 
                      onClick={handleBuy} 
                      disabled={!connected || !buyAmount || isTrading}
                      className="w-full"
                    >
                      {isTrading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <TrendingUp className="w-4 h-4 mr-2" />
                      )}
                      {isTrading ? 'Buying...' : 'Buy'}
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="sell" className="space-y-4">
                    <div>
                      <Label htmlFor="sellAmount">Amount ({tokenData.symbol})</Label>
                      <Input
                        id="sellAmount"
                        type="number"
                        placeholder="0.0"
                        value={sellAmount}
                        onChange={(e) => setSellAmount(e.target.value)}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      You'll receive: {sellAmount ? (parseFloat(sellAmount) * tokenData.price).toFixed(6) : '0'} SOL
                    </div>
                    <Button 
                      onClick={handleSell} 
                      disabled={!connected || !sellAmount || isTrading}
                      variant="destructive"
                      className="w-full"
                    >
                      {isTrading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <TrendingDown className="w-4 h-4 mr-2" />
                      )}
                      {isTrading ? 'Selling...' : 'Sell'}
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Market Cap</span>
                  <span className="font-medium">${tokenData.marketCap.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Volume 24h</span>
                  <span className="font-medium">${tokenData.volume24h.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Supply</span>
                  <span className="font-medium">{tokenData.totalSupply.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Circulating</span>
                  <span className="font-medium">{tokenData.circulatingSupply.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Holders</span>
                  <span className="font-medium">{tokenData.holders.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Liquidity</span>
                  <span className="font-medium">${tokenData.liquidity.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Add Liquidity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Liquidity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleAddLiquidity}
                  disabled={!connected}
                  className="w-full"
                  variant="outline"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Add Liquidity
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
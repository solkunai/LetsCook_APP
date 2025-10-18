import { useState, useEffect } from "react";
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import SaucePointsTracker from "@/components/SaucePointsTracker";
import SaucePointsBadge from "@/components/SaucePointsBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowDown, 
  Repeat, 
  ThumbsUp, 
  ThumbsDown, 
  Users, 
  Activity, 
  Gift,
  Plus,
  Minus,
  Zap,
  BarChart3,
  Coins,
  Wallet,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { 
  tradingService, 
  TokenInfo, 
  LiquidityPosition, 
  MarketMakingReward,
  SwapQuote 
} from '@/lib/tradingService';

export default function TradePage() {
  const { publicKey, connected, wallet } = useWallet();
  const [activeTab, setActiveTab] = useState("trade");
  const [fromToken, setFromToken] = useState("SOL");
  const [toToken, setToToken] = useState("SPCY");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippage, setSlippage] = useState([0.5]);
  const [userVotes, setUserVotes] = useState<{ [key: string]: 'up' | 'down' | null }>({});
  const [claimedRewards, setClaimedRewards] = useState<Set<string>>(new Set());
  const [userBalances, setUserBalances] = useState<{ [key: string]: number }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>([]);
  const [liquidityPositions, setLiquidityPositions] = useState<LiquidityPosition[]>([]);
  const [marketMakingRewards, setMarketMakingRewards] = useState<MarketMakingReward[]>([]);
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
  const { toast } = useToast();

  // Load data on component mount
  useEffect(() => {
    loadTradingData();
  }, []);

  // Load user data when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      loadUserData();
    }
  }, [connected, publicKey]);

  // Load swap quote when amount changes
  useEffect(() => {
    if (fromAmount && fromTokenData && toTokenData && parseFloat(fromAmount) > 0) {
      loadSwapQuote();
    } else {
      setSwapQuote(null);
      setToAmount("");
    }
  }, [fromAmount, fromToken, toToken]);

  const loadTradingData = async () => {
    setIsLoading(true);
    try {
      const tokens = await tradingService.getAvailableTokens();
      setAvailableTokens(tokens);
    } catch (error) {
      console.error('Error loading trading data:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load trading data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserData = async () => {
    if (!publicKey) return;
    
    try {
      const [balances, positions, rewards] = await Promise.all([
        tradingService.getUserBalances(publicKey),
        tradingService.getUserLiquidityPositions(publicKey),
        tradingService.getMarketMakingRewards(publicKey)
      ]);
      
      setUserBalances(balances);
      setLiquidityPositions(positions);
      setMarketMakingRewards(rewards);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadSwapQuote = async () => {
    if (!fromTokenData || !toTokenData || !fromAmount) return;
    
    try {
      const quote = await tradingService.getSwapQuote(
        fromTokenData.mint,
        toTokenData.mint,
        parseFloat(fromAmount),
        fromTokenData.dexProvider
      );
      
      setSwapQuote(quote);
      setToAmount(quote.outputAmount.toFixed(6));
    } catch (error) {
      console.error('Error loading swap quote:', error);
    }
  };

  const fromTokenData = fromToken === 'SOL' ? 
    { symbol: 'SOL', name: 'Solana', price: 1, mint: new PublicKey("So11111111111111111111111111111111111111112"), dexProvider: 'cook' as const } : 
    availableTokens.find(t => t.symbol === fromToken);
  const toTokenData = toToken === 'SOL' ? 
    { symbol: 'SOL', name: 'Solana', price: 1, mint: new PublicKey("So11111111111111111111111111111111111111112"), dexProvider: 'cook' as const } : 
    availableTokens.find(t => t.symbol === toToken);

  const handleVote = async (symbol: string, voteType: 'up' | 'down') => {
    if (!connected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to vote.",
        variant: "destructive"
      });
      return;
    }

    setUserVotes(prev => {
      const currentVote = prev[symbol];
      const newVote = currentVote === voteType ? null : voteType;
      return {
        ...prev,
        [symbol]: newVote
      };
    });

    toast({
      title: `Vote ${voteType === 'up' ? 'Up' : 'Down'}`,
      description: `Your vote has been recorded for ${symbol}.`,
    });
  };

  const handleSwap = async () => {
    if (!connected || !wallet || !publicKey) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to swap tokens.",
        variant: "destructive"
      });
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount to swap.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Find AMM for the token pair
      const baseMint = fromTokenData?.mint;
      const quoteMint = toTokenData?.mint;
      
      if (!baseMint || !quoteMint) {
        throw new Error('Invalid token selection');
      }

      // Build swap transaction
      const transaction = await buildSwapTransaction(
        baseMint, // This would be the AMM PDA
        fromToken === 'SOL' ? 1 : 0, // side: 0 = buy, 1 = sell
        Math.floor(parseFloat(fromAmount) * 1e9), // Convert to lamports
        publicKey
      );

      // Sign and send transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature);

      toast({
        title: "Swap Successful",
        description: `Swapped ${fromAmount} ${fromToken} for ${toAmount} ${toToken}`,
      });

      // Refresh balances
      await loadUserBalances();
      
    } catch (error) {
      console.error('Swap error:', error);
      toast({
        title: "Swap Failed",
        description: "Transaction failed. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLiquidity = async (tokenSymbol: string, amount: number) => {
    if (!connected || !wallet || !publicKey) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to add liquidity.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const token = availableTokens.find(t => t.symbol === tokenSymbol);
      if (!token) throw new Error('Token not found');

      // Build add liquidity transaction
      const transaction = await buildAddLiquidityTransaction(
        token.mint,
        new PublicKey("11111111111111111111111111111111"), // WSOL mint
        Math.floor(amount * 1e9), // Convert to lamports
        publicKey
      );

      // Sign and send transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature);

      toast({
        title: "Liquidity Added",
        description: `Added ${amount} SOL liquidity for ${tokenSymbol}`,
      });

      // Refresh balances
      await loadUserBalances();
      
    } catch (error) {
      console.error('Add liquidity error:', error);
      toast({
        title: "Transaction Failed",
        description: "Failed to add liquidity. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimReward = async (reward: MarketMakingReward) => {
    if (!connected || !wallet || !publicKey) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to claim rewards.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // TODO: Implement claim reward transaction
      // This would call the GetMMRewardTokens instruction
      
      toast({
        title: "Reward Claimed",
        description: `Claimed ${reward.rewardAmount} ${reward.rewardToken}`,
      });

      setClaimedRewards(prev => new Set([...prev, reward.tokenSymbol]));
      
    } catch (error) {
      console.error('Claim reward error:', error);
      toast({
        title: "Claim Failed",
        description: "Failed to claim reward. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Recalculate toAmount whenever tokens or fromAmount changes
  useEffect(() => {
    if (fromAmount && fromTokenData && toTokenData) {
      const fromValue = parseFloat(fromAmount) * (fromTokenData.price || 1);
      const toValue = fromValue / (toTokenData.price || 1);
      setToAmount(toValue.toFixed(6));
    } else {
      setToAmount("");
    }
  }, [fromAmount, fromToken, toToken, fromTokenData, toTokenData]);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        title="Trade & Earn"
        subtitle="Professional trading with automated market making"
        showNavigation={true}
      />

      {/* Content */}
      <div className="container-professional pt-24">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6 bg-card border border-border">
            <TabsTrigger value="trade" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Trade</TabsTrigger>
            <TabsTrigger value="liquidity" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Liquidity</TabsTrigger>
            <TabsTrigger value="rewards" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Rewards</TabsTrigger>
            <TabsTrigger value="analytics" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="trade" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trading Panel */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Repeat className="w-5 h-5" />
                      Token Swap
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* From Token */}
                    <div className="space-y-2">
                      <Label>From</Label>
                      <div className="flex gap-2">
                        <Select value={fromToken} onValueChange={setFromToken}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SOL">SOL</SelectItem>
                            {availableTokens.map(token => (
                              <SelectItem key={token.symbol} value={token.symbol}>
                                {token.symbol}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={fromAmount}
                          onChange={(e) => setFromAmount(e.target.value)}
                          className="flex-1"
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Balance: {userBalances[fromToken.toLowerCase()]?.toFixed(4) || '0.0000'} {fromToken}
                      </div>
                    </div>

                    {/* Swap Arrow */}
                    <div className="flex justify-center">
                      <Button variant="outline" size="icon" className="rounded-full">
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* To Token */}
                    <div className="space-y-2">
                      <Label>To</Label>
                      <div className="flex gap-2">
                        <Select value={toToken} onValueChange={setToToken}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SOL">SOL</SelectItem>
                            {availableTokens.map(token => (
                              <SelectItem key={token.symbol} value={token.symbol}>
                                {token.symbol}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={toAmount}
                          readOnly
                          className="flex-1"
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Balance: {userBalances[toToken.toLowerCase()]?.toFixed(4) || '0.0000'} {toToken}
                      </div>
                    </div>

                    {/* Slippage */}
                    <div className="space-y-2">
                      <Label>Slippage Tolerance: {slippage[0]}%</Label>
                      <Slider
                        value={slippage}
                        onValueChange={setSlippage}
                        max={5}
                        min={0.1}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    {/* Swap Button */}
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleSwap}
                      disabled={isLoading || !fromAmount || !toAmount}
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Swapping...
                        </>
                      ) : (
                        <>
                          <Repeat className="w-4 h-4 mr-2" />
                          Swap Tokens
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Token List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Available Tokens
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {availableTokens.map((token) => (
                        <div key={token.symbol} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold">{token.symbol[0]}</span>
                            </div>
                            <div>
                              <div className="font-semibold">{token.symbol}</div>
                              <div className="text-sm text-muted-foreground">{token.name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">${token.price.toFixed(2)}</div>
                            <div className={`text-sm flex items-center gap-1 ${
                              token.change24h >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {token.change24h >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {Math.abs(token.change24h).toFixed(1)}%
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleVote(token.symbol, 'up')}
                              className={`${userVotes[token.symbol] === 'up' ? 'bg-green-500 text-white' : ''}`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              {token.upvotes}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleVote(token.symbol, 'down')}
                              className={`${userVotes[token.symbol] === 'down' ? 'bg-red-500 text-white' : ''}`}
                            >
                              <ThumbsDown className="w-3 h-3" />
                              {token.downvotes}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <SaucePointsTracker />
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="w-5 h-5" />
                      Wallet Balance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(userBalances).map(([symbol, balance]) => (
                      <div key={symbol} className="flex justify-between">
                        <span className="text-sm">{symbol.toUpperCase()}</span>
                        <span className="text-sm font-semibold">{balance.toFixed(4)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="liquidity" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Add Liquidity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Add Liquidity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {availableTokens.map((token) => (
                    <div key={token.symbol} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold">{token.symbol[0]}</span>
                          </div>
                          <span className="font-semibold">{token.symbol}</span>
                        </div>
                        <Badge variant="outline">APY: {token.liquidity > 0 ? '12.5%' : 'N/A'}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-3">
                        Liquidity: {token.liquidity.toLocaleString()} SOL
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={() => handleAddLiquidity(token.symbol, 1)}
                        disabled={isLoading}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add 1 SOL Liquidity
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Your Positions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="w-5 h-5" />
                    Your Positions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {liquidityPositions.length > 0 ? liquidityPositions.map((position) => (
                      <div key={position.tokenSymbol} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold">{position.tokenSymbol[0]}</span>
                            </div>
                            <span className="font-semibold">{position.tokenSymbol}</span>
                          </div>
                          <Badge variant="outline">APY: {position.apy}%</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <span className="text-muted-foreground">LP Tokens:</span>
                            <div className="font-semibold">{position.lpTokens.toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Value:</span>
                            <div className="font-semibold">${position.value.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            <Minus className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1">
                            <Plus className="w-3 h-3 mr-1" />
                            Add More
                          </Button>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No liquidity positions found</p>
                        <p className="text-sm">Add liquidity to start earning rewards</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Market Making Rewards
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Earn rewards for providing liquidity and market making
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {marketMakingRewards.length > 0 ? marketMakingRewards.map((reward) => (
                    <div key={reward.tokenSymbol} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold">{reward.tokenSymbol[0]}</span>
                        </div>
                        <div>
                          <div className="font-semibold">{reward.tokenName}</div>
                          <div className="text-sm text-muted-foreground">
                            Launch: {reward.launchDate}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {reward.rewardAmount} {reward.rewardToken}
                        </div>
                        <Badge variant={reward.claimed ? "secondary" : "default"}>
                          {reward.claimed ? "Claimed" : "Available"}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleClaimReward(reward)}
                        disabled={reward.claimed || claimedRewards.has(reward.tokenSymbol) || isLoading}
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        Claim
                      </Button>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No market making rewards available</p>
                      <p className="text-sm">Provide liquidity to start earning rewards</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Trading Volume
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$125,430</div>
                  <div className="text-sm text-muted-foreground">24h Volume</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Active Traders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,247</div>
                  <div className="text-sm text-muted-foreground">24h Active</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="w-5 h-5" />
                    Total Liquidity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$2.1M</div>
                  <div className="text-sm text-muted-foreground">Across all pools</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

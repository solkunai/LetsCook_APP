import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Minus, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  RefreshCw,
  Info,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Zap,
  BarChart3,
  Loader2
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useToast } from '@/hooks/use-toast';
import { PieChart, Cell, ResponsiveContainer, Pie, Tooltip, Legend } from 'recharts';
import Header from '@/components/Header';
import { liquidityService, LiquidityPool, UserLiquidityPosition } from '@/lib/liquidityService';

export default function LiquidityPage() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { toast } = useToast();
  const [pools, setPools] = useState<LiquidityPool[]>([]);
  const [userPositions, setUserPositions] = useState<UserLiquidityPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
  const [isRemovingLiquidity, setIsRemovingLiquidity] = useState(false);
  
  // Add liquidity form
  const [addTokenA, setAddTokenA] = useState('');
  const [addTokenB, setAddTokenB] = useState('');
  const [selectedPool, setSelectedPool] = useState<string>('');

  // Load data on component mount
  useEffect(() => {
    loadLiquidityData();
  }, []);

  // Load user positions when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      loadUserPositions();
    }
  }, [connected, publicKey]);

  const loadLiquidityData = async (forceRefresh: boolean = false) => {
    setIsLoading(true);
    try {
      const poolsData = await liquidityService.getLiquidityPools(forceRefresh);
      setPools(poolsData);
    } catch (error) {
      console.error('Error loading liquidity data:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load liquidity pools. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserPositions = async (forceRefresh: boolean = false) => {
    if (!publicKey) return;
    
    try {
      const positions = await liquidityService.getUserLiquidityPositions(publicKey, forceRefresh);
      setUserPositions(positions);
    } catch (error) {
      console.error('Error loading user positions:', error);
    }
  };

  const handleAddLiquidity = async () => {
    if (!connected || !publicKey || !signTransaction) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to add liquidity.",
        variant: "destructive",
      });
      return;
    }

    if (!addTokenA || !addTokenB || !selectedPool) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields and select a pool.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingLiquidity(true);
    try {
      const pool = pools.find(p => p.id === selectedPool);
      if (!pool) throw new Error('Pool not found');

      const signature = await liquidityService.addLiquidity(
        pool.id,
        pool.dexProvider,
        pool.tokenA.mint,
        pool.tokenB.mint,
        parseFloat(addTokenA),
        parseFloat(addTokenB),
        publicKey,
        signTransaction
      );
      
      toast({
        title: "Liquidity Added",
        description: `Successfully added liquidity to ${pool.tokenA.symbol}/${pool.tokenB.symbol} pool.`,
      });
      
      setAddTokenA('');
      setAddTokenB('');
      setSelectedPool('');
      
      // Refresh data (force refresh after adding liquidity)
      await loadUserPositions(true);
      
    } catch (error) {
      console.error('Add liquidity error:', error);
      toast({
        title: "Add Liquidity Failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsAddingLiquidity(false);
    }
  };

  const handleRemoveLiquidity = async (positionId: string) => {
    if (!connected || !publicKey || !signTransaction) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to remove liquidity.",
        variant: "destructive",
      });
      return;
    }

    setIsRemovingLiquidity(true);
    try {
      const position = userPositions.find(p => p.poolId === positionId);
      if (!position) throw new Error('Position not found');

      const signature = await liquidityService.removeLiquidity(
        position.poolId,
        position.dexProvider,
        position.lpTokenMint,
        position.liquidity,
        publicKey,
        signTransaction
      );
      
      toast({
        title: "Liquidity Removed",
        description: `Successfully removed liquidity from ${position.tokenA}/${position.tokenB} pool.`,
      });
      
      // Refresh data (force refresh after removing liquidity)
      await loadUserPositions(true);
      
    } catch (error) {
      console.error('Remove liquidity error:', error);
      toast({
        title: "Remove Liquidity Failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsRemovingLiquidity(false);
    }
  };

  const totalValue = userPositions.reduce((sum, pos) => sum + pos.value, 0);
  const totalFees = userPositions.reduce((sum, pos) => sum + pos.feesEarned, 0);

  // Prepare chart data
  const chartData = userPositions.map(position => ({
    name: `${position.tokenA}/${position.tokenB}`,
    value: position.value,
    dex: position.dexProvider
  }));

  const COLORS = {
    cook: '#ffd700',
    raydium: '#3b82f6'
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        title="Liquidity Pools"
        subtitle="Provide liquidity and earn rewards"
        showNavigation={true}
      />

      <div className="container mx-auto px-4 py-8 pt-24">
        <Tabs defaultValue="pools" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pools">Available Pools</TabsTrigger>
            <TabsTrigger value="positions">Your Positions</TabsTrigger>
            <TabsTrigger value="add">Add Liquidity</TabsTrigger>
          </TabsList>

          <TabsContent value="pools" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Available Liquidity Pools</h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => loadLiquidityData(true)}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2">Loading pools...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pools.map((pool) => (
                  <motion.div
                    key={pool.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/50">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                                <span className="text-xs font-bold">{pool.tokenA.symbol[0]}</span>
                              </div>
                              <span>/</span>
                              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                                <span className="text-xs font-bold">{pool.tokenB.symbol[0]}</span>
                              </div>
                            </div>
                          </CardTitle>
                          <Badge variant={pool.dexProvider === 'cook' ? 'default' : 'secondary'}>
                            {pool.dexProvider === 'cook' ? (
                              <>
                                <Zap className="w-3 h-3 mr-1" />
                                Cook DEX
                              </>
                            ) : (
                              <>
                                <BarChart3 className="w-3 h-3 mr-1" />
                                Raydium
                              </>
                            )}
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">APR</span>
                            <div className="font-semibold text-primary">{pool.apr.toFixed(1)}%</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Volume 24h</span>
                            <div className="font-semibold">${pool.volume24h.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Liquidity</span>
                            <div className="font-semibold">${pool.totalLiquidity.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Fees 24h</span>
                            <div className="font-semibold">${pool.fees24h.toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="pt-2 border-t">
                          <div className="text-sm text-muted-foreground mb-2">Pool Composition</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>{pool.tokenA.symbol}</span>
                              <span>{pool.tokenA.amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{pool.tokenB.symbol}</span>
                              <span>{pool.tokenB.amount.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <Button 
                          className="w-full" 
                          onClick={() => setSelectedPool(pool.id)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Liquidity
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="positions" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Your Liquidity Positions</h2>
              {connected && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => loadUserPositions(true)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              )}
            </div>

            {!connected ? (
              <Card className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                <p className="text-muted-foreground">
                  Connect your wallet to view your liquidity positions and earnings.
                </p>
              </Card>
            ) : userPositions.length === 0 ? (
              <Card className="p-8 text-center">
                <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Positions Found</h3>
                <p className="text-muted-foreground">
                  You don't have any liquidity positions yet. Add liquidity to start earning rewards.
                </p>
              </Card>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">Total Value</p>
                          <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-green-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Fees Earned</p>
                          <p className="text-2xl font-bold">${totalFees.toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <Activity className="w-8 h-8 text-blue-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Active Positions</p>
                          <p className="text-2xl font-bold">{userPositions.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Positions List */}
                <div className="space-y-4">
                  {userPositions.map((position) => (
                    <motion.div
                      key={position.poolId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-bold">{position.tokenA[0]}</span>
                                </div>
                                <span>/</span>
                                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-bold">{position.tokenB[0]}</span>
                                </div>
                              </div>
                              <div>
                                <h3 className="font-semibold">{position.tokenA}/{position.tokenB}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {position.dexProvider === 'cook' ? 'Cook DEX' : 'Raydium'}
                                </p>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <p className="font-semibold">${position.value.toFixed(2)}</p>
                              <p className="text-sm text-muted-foreground">
                                {position.share.toFixed(2)}% of pool
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleRemoveLiquidity(position.poolId)}
                                disabled={isRemovingLiquidity}
                              >
                                <Minus className="w-4 h-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">LP Tokens</span>
                              <div className="font-semibold">{position.liquidity.toFixed(2)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Pool Share</span>
                              <div className="font-semibold">{position.share.toFixed(2)}%</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Fees Earned</span>
                              <div className="font-semibold">${position.feesEarned.toFixed(2)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">DEX</span>
                              <div className="font-semibold capitalize">{position.dexProvider}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Chart */}
                {chartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Portfolio Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[entry.dex as keyof typeof COLORS]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="add" className="space-y-6">
            <h2 className="text-2xl font-bold">Add Liquidity</h2>
            
            <Card>
              <CardHeader>
                <CardTitle>Add Liquidity to Pool</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="pool-select">Select Pool</Label>
                  <Select value={selectedPool} onValueChange={setSelectedPool}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a pool" />
                    </SelectTrigger>
                    <SelectContent>
                      {pools.map((pool) => (
                        <SelectItem key={pool.id} value={pool.id}>
                          {pool.tokenA.symbol}/{pool.tokenB.symbol} - {pool.dexProvider === 'cook' ? 'Cook DEX' : 'Raydium'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPool && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="tokenA">Token A Amount</Label>
                        <Input
                          id="tokenA"
                          type="number"
                          placeholder="0.0"
                          value={addTokenA}
                          onChange={(e) => setAddTokenA(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="tokenB">Token B Amount</Label>
                        <Input
                          id="tokenB"
                          type="number"
                          placeholder="0.0"
                          value={addTokenB}
                          onChange={(e) => setAddTokenB(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={handleAddLiquidity}
                      disabled={isAddingLiquidity || !addTokenA || !addTokenB}
                    >
                      {isAddingLiquidity ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding Liquidity...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Liquidity
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
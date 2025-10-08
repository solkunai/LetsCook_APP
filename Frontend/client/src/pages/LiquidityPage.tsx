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
  ExternalLink
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useToast } from '@/hooks/use-toast';
import { PieChart, Cell, ResponsiveContainer, Pie, Tooltip, Legend } from 'recharts';
import Header from '@/components/Header';

interface LiquidityPool {
  id: string;
  tokenA: {
    symbol: string;
    amount: number;
    price: number;
  };
  tokenB: {
    symbol: string;
    amount: number;
    price: number;
  };
  totalLiquidity: number;
  apr: number;
  volume24h: number;
  fees24h: number;
  share: number;
}

interface UserLiquidityPosition {
  poolId: string;
  tokenA: string;
  tokenB: string;
  liquidity: number;
  share: number;
  value: number;
  feesEarned: number;
}

export default function LiquidityPage() {
  const { connected, publicKey } = useWallet();
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

  // Mock data
  useEffect(() => {
    const mockPools: LiquidityPool[] = [
      {
        id: '1',
        tokenA: { symbol: 'CHEF', amount: 1000000, price: 0.000123 },
        tokenB: { symbol: 'SOL', amount: 123, price: 100 },
        totalLiquidity: 24600,
        apr: 15.5,
        volume24h: 125000,
        fees24h: 1250,
        share: 0
      },
      {
        id: '2',
        tokenA: { symbol: 'COOK', amount: 500000, price: 0.000456 },
        tokenB: { symbol: 'SOL', amount: 228, price: 100 },
        totalLiquidity: 45600,
        apr: 22.3,
        volume24h: 89000,
        fees24h: 890,
        share: 0
      },
      {
        id: '3',
        tokenA: { symbol: 'SPICE', amount: 2000000, price: 0.000078 },
        tokenB: { symbol: 'SOL', amount: 156, price: 100 },
        totalLiquidity: 31200,
        apr: 18.7,
        volume24h: 67000,
        fees24h: 670,
        share: 0
      }
    ];

    const mockPositions: UserLiquidityPosition[] = [
      {
        poolId: '1',
        tokenA: 'CHEF',
        tokenB: 'SOL',
        liquidity: 1000,
        share: 4.1,
        value: 1008.2,
        feesEarned: 15.5
      }
    ];

    setTimeout(() => {
      setPools(mockPools);
      setUserPositions(mockPositions);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleAddLiquidity = async () => {
    if (!connected) {
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
      // Real liquidity addition logic would go here
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Liquidity Added",
        description: "Successfully added liquidity to the pool.",
      });
      
      setAddTokenA('');
      setAddTokenB('');
      setSelectedPool('');
    } catch (error) {
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
    if (!connected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to remove liquidity.",
        variant: "destructive",
      });
      return;
    }

    setIsRemovingLiquidity(true);
    try {
      // Real liquidity removal logic would go here
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Liquidity Removed",
        description: "Successfully removed liquidity from the pool.",
      });
    } catch (error) {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading liquidity data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        title="Liquidity Pools" 
        subtitle="Provide liquidity and earn fees"
        showNavigation={true}
      />

      <div className="container mx-auto p-6 pt-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* User Positions */}
            {userPositions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      Your Positions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {userPositions.map((position, index) => (
                        <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-4">
                            <div className="flex -space-x-2">
                              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center border-2 border-background">
                                <span className="text-xs font-bold text-primary">
                                  {position.tokenA.charAt(0)}
                                </span>
                              </div>
                              <div className="w-8 h-8 bg-secondary/20 rounded-full flex items-center justify-center border-2 border-background">
                                <span className="text-xs font-bold text-secondary">
                                  {position.tokenB.charAt(0)}
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="font-medium">
                                {position.tokenA}/{position.tokenB}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {position.share}% of pool
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${position.value.toFixed(2)}</div>
                            <div className="text-sm text-green-500">
                              +${position.feesEarned.toFixed(2)} fees
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveLiquidity(position.poolId)}
                            disabled={isRemovingLiquidity}
                          >
                            <Minus className="w-4 h-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Available Pools */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Available Pools
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pools.map((pool) => (
                      <div key={pool.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                          <div className="flex -space-x-2">
                            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center border-2 border-background">
                              <span className="text-sm font-bold text-primary">
                                {pool.tokenA.symbol.charAt(0)}
                              </span>
                            </div>
                            <div className="w-10 h-10 bg-secondary/20 rounded-full flex items-center justify-center border-2 border-background">
                              <span className="text-sm font-bold text-secondary">
                                {pool.tokenB.symbol.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-lg">
                              {pool.tokenA.symbol}/{pool.tokenB.symbol}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Total Liquidity: ${pool.totalLiquidity.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-green-600">
                              {pool.apr}% APR
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            24h Volume: ${pool.volume24h.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            24h Fees: ${pool.fees24h.toLocaleString()}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPool(pool.id)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Portfolio Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Portfolio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">Total Value</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-500">
                      +${totalFees.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">Fees Earned</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{userPositions.length}</div>
                    <div className="text-sm text-muted-foreground">Active Positions</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Add Liquidity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Add Liquidity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="pool">Select Pool</Label>
                    <Select value={selectedPool} onValueChange={setSelectedPool}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a pool" />
                      </SelectTrigger>
                      <SelectContent>
                        {pools.map((pool) => (
                          <SelectItem key={pool.id} value={pool.id}>
                            {pool.tokenA.symbol}/{pool.tokenB.symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedPool && (
                    <>
                      <div>
                        <Label htmlFor="tokenA">Amount ({pools.find(p => p.id === selectedPool)?.tokenA.symbol})</Label>
                        <Input
                          id="tokenA"
                          type="number"
                          placeholder="0.0"
                          value={addTokenA}
                          onChange={(e) => setAddTokenA(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="tokenB">Amount ({pools.find(p => p.id === selectedPool)?.tokenB.symbol})</Label>
                        <Input
                          id="tokenB"
                          type="number"
                          placeholder="0.0"
                          value={addTokenB}
                          onChange={(e) => setAddTokenB(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <Button
                    onClick={handleAddLiquidity}
                    disabled={!connected || !addTokenA || !addTokenB || !selectedPool || isAddingLiquidity}
                    className="w-full"
                  >
                    {isAddingLiquidity ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    {isAddingLiquidity ? 'Adding...' : 'Add Liquidity'}
                  </Button>

                  {!connected && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm text-yellow-800 dark:text-yellow-200">
                        Connect your wallet to add liquidity
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    How It Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Provide equal value of both tokens</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Earn fees from trading activity</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Remove liquidity anytime</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Impermanent loss risk applies</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
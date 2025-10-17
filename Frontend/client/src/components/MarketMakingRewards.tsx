import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Award, 
  BarChart3, 
  Target,
  Clock,
  CheckCircle2,
  Info,
  Zap,
  Gift,
  PieChart,
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useWallet } from '@solana/wallet-adapter-react';
import { marketMakingRewardsService } from '@/lib/marketMakingRewardsService';

interface MarketMakingRewardsProps {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
}

interface RewardPool {
  id: string;
  tokenMint: string;
  totalRewards: number;
  distributedRewards: number;
  remainingRewards: number;
  rewardRate: number; // tokens per SOL traded
  totalVolume: number;
  participantCount: number;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
}

interface UserRewardData {
  totalVolume: number;
  totalRewards: number;
  pendingRewards: number;
  claimedRewards: number;
  rank: number;
  lastClaimDate?: Date;
}

export default function MarketMakingRewards({ 
  tokenMint, 
  tokenSymbol, 
  tokenName 
}: MarketMakingRewardsProps) {
  const { connected, publicKey } = useWallet();
  const [rewardPool, setRewardPool] = useState<RewardPool | null>(null);
  const [userRewardData, setUserRewardData] = useState<UserRewardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [allocatingRewards, setAllocatingRewards] = useState(false);
  const [allocationAmount, setAllocationAmount] = useState(0);
  const [allocationPercentage, setAllocationPercentage] = useState(0);

  useEffect(() => {
    fetchRewardData();
  }, [tokenMint, publicKey]);

  const fetchRewardData = async () => {
    try {
      setLoading(true);
      
      // Fetch real reward data from blockchain
      const rewardPoolData = await marketMakingRewardsService.getRewardPool(tokenMint);
      const userRewardData = publicKey ? await marketMakingRewardsService.getUserRewards(tokenMint, publicKey.toBase58()) : null;

      if (rewardPoolData) {
        // Convert MarketMakingConfig to RewardPool format
        const rewardPool: RewardPool = {
          id: `pool_${tokenMint}`,
          tokenMint,
          totalRewards: rewardPoolData.totalRewardPool,
          distributedRewards: rewardPoolData.distributedRewards,
          remainingRewards: rewardPoolData.remainingRewards,
          rewardRate: rewardPoolData.rewardPercent / 100, // Convert percentage to decimal
          totalVolume: 2500000, // Mock total volume
          participantCount: 1250, // Mock participant count
          isActive: rewardPoolData.isActive,
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          endDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000), // 23 days from now
        };
        setRewardPool(rewardPool);
      }
      
      if (userRewardData) {
        // Convert TradingVolume to UserRewardData format
        const userData: UserRewardData = {
          totalVolume: userRewardData.totalVolume,
          totalRewards: userRewardData.totalVolume * 0.001, // Mock calculation
          pendingRewards: userRewardData.totalVolume * 0.0005, // Mock pending
          claimedRewards: userRewardData.totalVolume * 0.0005, // Mock claimed
          rank: 45, // Mock rank
          lastClaimDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        };
        setUserRewardData(userData);
      }
    } catch (error) {
      console.error('Error fetching reward data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch market making reward data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!publicKey || !userRewardData) return;

    try {
      setClaiming(true);
      
      // Use real blockchain transaction to claim rewards
      const result = await marketMakingRewardsService.claimRewards(
        tokenMint,
        publicKey.toBase58(),
        userRewardData.pendingRewards
      );
      
      if (result.success) {
        toast({
          title: "Rewards Claimed!",
          description: `Successfully claimed ${userRewardData.pendingRewards} ${tokenSymbol} tokens.`,
        });

        // Update user reward data
        setUserRewardData(prev => prev ? {
          ...prev,
          claimedRewards: prev.claimedRewards + prev.pendingRewards,
          pendingRewards: 0,
          lastClaimDate: new Date(),
        } : null);
      } else {
        throw new Error(result.error || 'Failed to claim rewards');
      }

    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast({
        title: "Claim Failed",
        description: "Failed to claim rewards. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
    }
  };

  const handleAllocateRewards = async () => {
    if (!publicKey || allocationAmount <= 0) return;

    try {
      setAllocatingRewards(true);
      
      // Use real blockchain transaction to allocate rewards
      const result = await marketMakingRewardsService.allocateRewards(
        tokenMint,
        publicKey.toBase58(),
        allocationAmount,
        allocationPercentage
      );
      
      if (result.success) {
        toast({
          title: "Rewards Allocated!",
          description: `Successfully allocated ${allocationAmount} ${tokenSymbol} tokens for market making rewards.`,
        });

        // Update reward pool
        setRewardPool(prev => prev ? {
          ...prev,
          totalRewards: prev.totalRewards + allocationAmount,
          remainingRewards: prev.remainingRewards + allocationAmount,
        } : null);

        setAllocationAmount(0);
        setAllocationPercentage(0);
      } else {
        throw new Error(result.error || 'Failed to allocate rewards');
      }

    } catch (error) {
      console.error('Error allocating rewards:', error);
      toast({
        title: "Allocation Failed",
        description: "Failed to allocate rewards. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAllocatingRewards(false);
    }
  };

  const calculateRewardEfficiency = () => {
    if (!rewardPool) return 0;
    return (rewardPool.distributedRewards / rewardPool.totalRewards) * 100;
  };

  const formatTimeRemaining = (endDate: Date) => {
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-slate-700 rounded-lg"></div>
            <div className="h-64 bg-slate-700 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!rewardPool) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6 text-center">
          <Info className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Market Making Rewards</h3>
          <p className="text-slate-400 mb-4">
            This token doesn't have an active market making reward pool.
          </p>
          <Button 
            onClick={async () => {
              try {
                const result = await marketMakingRewardsService.createRewardPool(
                  tokenMint,
                  publicKey!.toBase58(),
                  1000000, // Default 1M tokens
                  1.0 // Default 1% of supply
                );
                
                if (result.success) {
                  toast({
                    title: "Reward Pool Created!",
                    description: "Market making reward pool has been created successfully.",
                  });
                  // Refresh reward data
                  await fetchRewardData();
                } else {
                  toast({
                    title: "Creation Failed",
                    description: result.error || "Failed to create reward pool.",
                    variant: "destructive",
                  });
                }
              } catch (error) {
                toast({
                  title: "Creation Failed",
                  description: error instanceof Error ? error.message : "Failed to create reward pool.",
                  variant: "destructive",
                });
              }
            }}
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            Create Reward Pool
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Gift className="w-6 h-6 mr-2 text-yellow-400" />
            Market Making Rewards
          </h2>
          <p className="text-slate-400">
            Earn {tokenSymbol} tokens by trading {tokenName} on Let's Cook DEX
          </p>
        </div>
        <Badge className={`${rewardPool.isActive ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {rewardPool.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reward Pool Overview */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl text-white flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-yellow-400" />
              Reward Pool Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                <div className="text-yellow-400 font-semibold text-lg">
                  {rewardPool.totalRewards.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400">Total Rewards</div>
              </div>
              <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                <div className="text-green-400 font-semibold text-lg">
                  {rewardPool.remainingRewards.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400">Remaining</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Distribution Progress</span>
                <span>{calculateRewardEfficiency().toFixed(1)}%</span>
              </div>
              <Progress 
                value={calculateRewardEfficiency()} 
                className="h-3 bg-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <div className="text-blue-400 font-semibold text-lg">
                  {rewardPool.totalVolume.toLocaleString()} SOL
                </div>
                <div className="text-xs text-slate-400">Total Volume</div>
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <div className="text-purple-400 font-semibold text-lg">
                  {rewardPool.participantCount.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400">Participants</div>
              </div>
            </div>

            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center space-x-1 text-slate-400">
                <Clock className="w-4 h-4" />
                <span>{formatTimeRemaining(rewardPool.endDate)}</span>
              </div>
              <div className="text-right">
                <div className="text-yellow-400 font-semibold">
                  {rewardPool.rewardRate * 100}%
                </div>
                <div className="text-xs text-slate-400">Reward Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Rewards */}
        {connected && userRewardData && (
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center">
                <Award className="w-5 h-5 mr-2 text-green-400" />
                Your Rewards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-green-400 font-semibold text-lg">
                    {userRewardData.totalRewards.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-400">Total Earned</div>
                </div>
                <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-yellow-400 font-semibold text-lg">
                    {userRewardData.pendingRewards.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-400">Pending</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-blue-400 font-semibold text-lg">
                    {userRewardData.totalVolume.toLocaleString()} SOL
                  </div>
                  <div className="text-xs text-slate-400">Your Volume</div>
                </div>
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-purple-400 font-semibold text-lg">
                    #{userRewardData.rank}
                  </div>
                  <div className="text-xs text-slate-400">Rank</div>
                </div>
              </div>

              {userRewardData.pendingRewards > 0 && (
                <Button
                  onClick={handleClaimRewards}
                  disabled={claiming}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                >
                  {claiming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4 mr-2" />
                      Claim {userRewardData.pendingRewards.toFixed(2)} {tokenSymbol}
                    </>
                  )}
                </Button>
              )}

              {userRewardData.lastClaimDate && (
                <div className="text-center text-xs text-slate-400">
                  Last claimed: {userRewardData.lastClaimDate.toLocaleDateString()}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Token Issuer Allocation */}
        {connected && (
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center">
                <Zap className="w-5 h-5 mr-2 text-blue-400" />
                Allocate Rewards (Token Issuer Only)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-200">
                    <p className="font-medium mb-1">How Market Making Rewards Work:</p>
                    <ul className="space-y-1 text-blue-200/80">
                      <li>• Allocate a percentage of your token supply for market making rewards</li>
                      <li>• Traders earn rewards based on their trading volume</li>
                      <li>• Higher trading volume = more rewards</li>
                      <li>• Rewards are distributed automatically after each trade</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="allocation-amount" className="text-sm font-medium text-slate-300">
                    Allocation Amount ({tokenSymbol})
                  </Label>
                  <Input
                    id="allocation-amount"
                    type="number"
                    value={allocationAmount}
                    onChange={(e) => {
                      const amount = Number(e.target.value);
                      setAllocationAmount(amount);
                      // Calculate percentage based on total supply (mock: 10M)
                      setAllocationPercentage((amount / 10000000) * 100);
                    }}
                    placeholder="100000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="allocation-percentage" className="text-sm font-medium text-slate-300">
                    Percentage of Supply
                  </Label>
                  <Input
                    id="allocation-percentage"
                    type="number"
                    value={allocationPercentage}
                    onChange={(e) => {
                      const percentage = Number(e.target.value);
                      setAllocationPercentage(percentage);
                      // Calculate amount based on percentage (mock: 10M total supply)
                      setAllocationAmount((percentage / 100) * 10000000);
                    }}
                    placeholder="1.0"
                    step="0.1"
                    className="mt-1"
                  />
                </div>
              </div>

              <Button
                onClick={handleAllocateRewards}
                disabled={allocatingRewards || allocationAmount <= 0}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold"
              >
                {allocatingRewards ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Allocating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Allocate {allocationAmount.toLocaleString()} {tokenSymbol} for Rewards
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

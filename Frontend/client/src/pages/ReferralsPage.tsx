import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Gift, 
  TrendingUp, 
  DollarSign, 
  Copy, 
  CheckCircle,
  Award,
  Crown,
  Star,
  Zap,
  Loader2,
  ExternalLink,
  Share2
} from 'lucide-react';
import { referralService, ReferralData, ReferralReward } from '@/lib/referralService';

export default function ReferralsPage() {
  const { connected, publicKey } = useWallet();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [referralRewards, setReferralRewards] = useState<ReferralReward[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState('');

  // Load data on component mount
  useEffect(() => {
    loadReferralData();
    loadLeaderboard();
  }, []);

  // Load user data when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      loadUserReferralData();
    }
  }, [connected, publicKey]);

  const loadReferralData = async () => {
    setIsLoading(true);
    try {
      // Load general referral information
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading referral data:', error);
      setIsLoading(false);
    }
  };

  const loadUserReferralData = async () => {
    if (!publicKey) return;
    
    try {
      const [data, rewards] = await Promise.all([
        referralService.getReferralData(publicKey),
        referralService.getReferralRewards(publicKey)
      ]);
      
      setReferralData(data);
      setReferralRewards(rewards);
    } catch (error) {
      console.error('Error loading user referral data:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load referral data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const loadLeaderboard = async () => {
    try {
      const data = await referralService.getReferralLeaderboard();
      setLeaderboard(data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const copyReferralCode = async () => {
    if (!referralData) return;
    
    try {
      await navigator.clipboard.writeText(referralData.referralCode);
      setCopiedCode(true);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard.",
      });
      
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      console.error('Error copying referral code:', error);
    }
  };

  const shareReferralLink = async () => {
    if (!referralData) return;
    
    const shareUrl = `${window.location.origin}?ref=${referralData.referralCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Let\'s Cook with my referral!',
          text: 'Get started with token launches on Solana',
          url: shareUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link Copied!",
          description: "Referral link copied to clipboard.",
        });
      } catch (error) {
        console.error('Error copying link:', error);
      }
    }
  };

  const claimRewards = async () => {
    if (!publicKey) return;
    
    setIsClaiming(true);
    try {
      const pendingRewards = referralRewards.filter(r => r.status === 'pending');
      const rewardIds = pendingRewards.map(r => r.id);
      
      if (rewardIds.length === 0) {
        toast({
          title: "No Rewards to Claim",
          description: "You don't have any pending rewards.",
        });
        return;
      }

      const signature = await referralService.claimReferralRewards(publicKey, rewardIds);
      
      toast({
        title: "Rewards Claimed!",
        description: "Successfully claimed your referral rewards.",
      });
      
      // Refresh data
      await loadUserReferralData();
      
    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast({
        title: "Claim Failed",
        description: "Failed to claim rewards. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleReferralCodeSubmit = async () => {
    if (!referralCodeInput.trim()) return;
    
    try {
      const isValid = await referralService.validateReferralCode(referralCodeInput);
      
      if (isValid) {
        toast({
          title: "Valid Referral Code!",
          description: "You can now use this code when making purchases.",
        });
        setReferralCodeInput('');
      } else {
        toast({
          title: "Invalid Referral Code",
          description: "Please check the code and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error validating referral code:', error);
      toast({
        title: "Validation Failed",
        description: "Failed to validate referral code. Please try again.",
        variant: "destructive",
      });
    }
  };

  const totalPendingRewards = referralRewards
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        title="Refer & Earn"
        subtitle="Spread the degen energy 🔥"
        showNavigation={true}
      />

      <div className="container mx-auto px-4 py-8 pt-24">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {!connected ? (
              <Card className="p-8 text-center">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
                <p className="text-muted-foreground mb-6">
                  Connect your wallet to start earning referral rewards
                </p>
                <Button size="lg">
                  Connect Wallet
                </Button>
              </Card>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2">Loading referral data...</span>
              </div>
            ) : referralData ? (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <Users className="w-8 h-8 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">Referrals</p>
                          <p className="text-2xl font-bold">{referralData.referredCount}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <Star className="w-8 h-8 text-yellow-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Points Earned</p>
                          <p className="text-2xl font-bold">{referralData.pointsEarned}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-green-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Total Earnings</p>
                          <p className="text-2xl font-bold">${referralData.totalEarnings.toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <Gift className="w-8 h-8 text-blue-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Pending Rewards</p>
                          <p className="text-2xl font-bold">${totalPendingRewards.toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Referral Code Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Share2 className="w-5 h-5" />
                      Your Referral Code
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label htmlFor="referral-code">Referral Code</Label>
                        <div className="flex gap-2">
                          <Input
                            id="referral-code"
                            value={referralData.referralCode}
                            readOnly
                            className="font-mono"
                          />
                          <Button
                            variant="outline"
                            onClick={copyReferralCode}
                            disabled={copiedCode}
                          >
                            {copiedCode ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <Button onClick={shareReferralLink}>
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </Button>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-semibold mb-2">How it works:</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>• Share your referral code with friends</li>
                        <li>• Earn 5% commission on their ticket purchases</li>
                        <li>• Get bonus points for each successful referral</li>
                        <li>• Climb the leaderboard and win extra rewards</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Use Referral Code</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="input-code">Enter Referral Code</Label>
                        <div className="flex gap-2">
                          <Input
                            id="input-code"
                            placeholder="CHEF123456"
                            value={referralCodeInput}
                            onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                          />
                          <Button onClick={handleReferralCodeSubmit}>
                            Apply
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Claim Rewards</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          Pending Rewards
                        </p>
                        <p className="text-2xl font-bold text-primary">
                          ${totalPendingRewards.toFixed(2)}
                        </p>
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={claimRewards}
                        disabled={isClaiming || totalPendingRewards === 0}
                      >
                        {isClaiming ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Claiming...
                          </>
                        ) : (
                          <>
                            <Gift className="w-4 h-4 mr-2" />
                            Claim Rewards
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="friends" className="space-y-6">
            <h2 className="text-2xl font-bold">Your Referred Friends</h2>
            
            {referralData ? (
              <div className="space-y-4">
                {referralData.referredFriends.map((friend, index) => (
                  <motion.div
                    key={friend.walletAddress}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                              <span className="text-lg font-bold">
                                {friend.username[0].toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold">{friend.username}</h3>
                              <p className="text-sm text-muted-foreground">
                                Joined {new Date(friend.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <Badge variant={friend.status === 'active' ? 'default' : 'secondary'}>
                              {friend.status}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              Commission: ${friend.commissionEarned.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Points Earned</span>
                            <div className="font-semibold">{friend.pointsEarned}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Spent</span>
                            <div className="font-semibold">${friend.totalSpent.toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Commission</span>
                            <div className="font-semibold">${friend.commissionEarned.toFixed(2)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Referrals Yet</h3>
                <p className="text-muted-foreground">
                  Start sharing your referral code to earn rewards!
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="rewards" className="space-y-6">
            <h2 className="text-2xl font-bold">Referral Rewards</h2>
            
            <div className="space-y-4">
              {referralRewards.map((reward, index) => (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            reward.type === 'commission' ? 'bg-green-500/20' :
                            reward.type === 'points' ? 'bg-yellow-500/20' :
                            'bg-blue-500/20'
                          }`}>
                            {reward.type === 'commission' ? (
                              <DollarSign className="w-6 h-6 text-green-500" />
                            ) : reward.type === 'points' ? (
                              <Star className="w-6 h-6 text-yellow-500" />
                            ) : (
                              <Gift className="w-6 h-6 text-blue-500" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{reward.description}</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(reward.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {reward.amount} {reward.tokenSymbol || 'points'}
                          </p>
                          <Badge variant={reward.status === 'claimed' ? 'secondary' : 'default'}>
                            {reward.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-6">
            <h2 className="text-2xl font-bold">Referral Leaderboard</h2>
            
            <div className="space-y-4">
              {leaderboard.map((user, index) => (
                <motion.div
                  key={user.username}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            index === 0 ? 'bg-yellow-500/20' :
                            index === 1 ? 'bg-gray-400/20' :
                            index === 2 ? 'bg-orange-500/20' :
                            'bg-primary/20'
                          }`}>
                            {index < 3 ? (
                              index === 0 ? <Crown className="w-6 h-6 text-yellow-500" /> :
                              index === 1 ? <Award className="w-6 h-6 text-gray-400" /> :
                              <Award className="w-6 h-6 text-orange-500" />
                            ) : (
                              <span className="text-lg font-bold">#{user.rank}</span>
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{user.username}</h3>
                            <p className="text-sm text-muted-foreground">
                              {user.referralCount} referrals
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-lg font-bold">${user.totalEarnings.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">Total Earnings</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
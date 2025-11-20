import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Copy, 
  Users, 
  Gift, 
  TrendingUp, 
  Share2, 
  CheckCircle,
  ExternalLink,
  Star
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

interface ReferralData {
  referralCode: string;
  referredCount: number;
  pointsEarned: number;
  referredFriends: Array<{
    username: string;
    pointsEarned: number;
    date: string;
  }>;
}

interface ReferralSectionProps extends ReferralData {}

export default function ReferralSection({
  referralCode,
  referredCount,
  pointsEarned,
  referredFriends
}: ReferralSectionProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast({
        title: "Referral Code Copied!",
        description: "Share this code with your friends to earn rewards.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Please copy the code manually.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    const shareText = `Join me on Let's Cook! Use my referral code: ${referralCode} 🍳`;
    const baseUrl = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
      ? 'https://lets-cook-frontend.onrender.com'
      : window.location.origin;
    const shareUrl = `${baseUrl}?ref=${referralCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Let's Cook - Fair Token Launches",
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast({
          title: "Share Link Copied!",
          description: "Share this with your friends.",
        });
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast({
        title: "Share Link Copied!",
        description: "Share this with your friends.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Referral Code Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              Your Referral Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={referralCode || "CHEF2025"}
                readOnly
                className="font-mono text-lg font-bold"
              />
              <Button
                onClick={handleCopyReferralCode}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleShare} className="flex-1">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" className="flex-1">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">{referredCount || 0}</div>
              <div className="text-sm text-muted-foreground">Friends Referred</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6 text-center">
              <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{pointsEarned || 0}</div>
              <div className="text-sm text-muted-foreground">Points Earned</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">
                {referredCount > 0 ? Math.floor(pointsEarned / referredCount) : 0}
              </div>
              <div className="text-sm text-muted-foreground">Avg Points/Friend</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Referred Friends List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Referred Friends
            </CardTitle>
          </CardHeader>
          <CardContent>
            {referredFriends && referredFriends.length > 0 ? (
              <div className="space-y-3">
                {referredFriends.map((friend, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {friend.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">{friend.username}</div>
                        <div className="text-sm text-muted-foreground">
                          Joined {friend.date}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      +{friend.pointsEarned} pts
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No friends referred yet</p>
                <p className="text-sm">Share your referral code to start earning!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* How It Works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>How Referrals Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-semibold mb-2">Share Your Code</h3>
                <p className="text-sm text-muted-foreground">
                  Share your unique referral code with friends
                </p>
              </div>
              
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-semibold mb-2">They Join & Trade</h3>
                <p className="text-sm text-muted-foreground">
                  Friends use your code and start trading
                </p>
              </div>
              
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-primary">3</span>
                </div>
                <h3 className="font-semibold mb-2">Earn Rewards</h3>
                <p className="text-sm text-muted-foreground">
                  Get points for every successful referral
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
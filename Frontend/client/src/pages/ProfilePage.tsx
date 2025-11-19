import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import TicketCard from "@/components/TicketCard";
import SaucePointsBadge from "@/components/SaucePointsBadge";
import { User, Wallet, Copy, CheckCircle, Gift, Share2 } from "lucide-react";
import { useWallet } from '@solana/wallet-adapter-react';
import { referralService } from '@/lib/referralService';

interface ReferralState {
  username: string;
  walletAddress: string;
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  referralEarnings: number; // display only, from referralData.totalEarnings
  saucePoints: number; // optional display, keep 0 for now
}

const mockActiveTickets = [
  {
    raffleTokenName: "Spicy Token",
    raffleTokenSymbol: "SPCY",
    quantity: 5,
    ticketPrice: "0.1",
    isWinner: false,
    claimed: false,
    purchaseDate: "2025-02-01",
  },
];

const mockPastTickets = [
  {
    raffleTokenName: "Chef Coin",
    raffleTokenSymbol: "CHEF",
    quantity: 3,
    ticketPrice: "0.2",
    isWinner: true,
    claimed: true,
    purchaseDate: "2025-01-15",
  },
  {
    raffleTokenName: "Hot Sauce",
    raffleTokenSymbol: "HOT",
    quantity: 2,
    ticketPrice: "0.15",
    isWinner: false,
    claimed: true,
    purchaseDate: "2025-01-10",
  },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("active");
  const { publicKey } = useWallet();
  const [user, setUser] = useState<ReferralState | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [isEditingReferralCode, setIsEditingReferralCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!publicKey) return;
      const data = await referralService.getReferralData(publicKey);
      const username = localStorage.getItem('username') || data.referredFriends.find(() => false)?.username || '';
      const walletAddress = publicKey.toBase58().slice(0, 4) + '...' + publicKey.toBase58().slice(-4);
      const baseUrl = (import.meta as any).env?.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
      const referralLink = `${baseUrl}?ref=${data.referralCode}`;
      setUser({
        username,
        walletAddress,
        referralCode: data.referralCode,
        referralLink,
        totalReferrals: data.referredCount,
        referralEarnings: data.totalEarnings,
        saucePoints: data.pointsEarned,
      });
      setReferralCode(data.referralCode);
    };
    load();
  }, [publicKey]);

  const validateReferralCode = (code: string): boolean => {
    // Only allow letters and numbers, up to 5 characters
    const regex = /^[A-Za-z0-9]{1,5}$/;
    return regex.test(code);
  };

  const handleReferralCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    if (value.length <= 5 && /^[A-Za-z0-9]*$/.test(value)) {
      setReferralCode(value);
    }
  };

  const saveReferralCode = () => {
    if (!validateReferralCode(referralCode)) {
      toast({
        title: "Invalid Referral Code",
        description: "Code must be 1-5 characters, letters and numbers only.",
        variant: "destructive",
      });
      return;
    }

    // Future: custom code persistence
    if (user) {
      setUser({
        ...user,
        referralCode,
        referralLink: `${((import.meta as any).env?.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : ''))}?ref=${referralCode}`,
      });
    }
    
    setIsEditingReferralCode(false);
    toast({
      title: "Referral Code Updated",
      description: "Your custom referral code has been saved!",
    });
  };

  const copyReferralLink = async () => {
    try {
      if (!user) return;
      await navigator.clipboard.writeText(user.referralLink);
      setCopiedCode(true);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard.",
      });
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy link.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Profile Header */}
      <div className="gradient-hero p-6 relative overflow-hidden border-b border-border">
        <div className="max-w-lg mx-auto relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="w-16 h-16 border-2 border-primary shadow-xl">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                {(user?.username || 'U')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-heading font-bold" data-testid="text-username">
                {user?.username || 'Anonymous Chef'}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <Wallet className="w-4 h-4" />
                <span data-testid="text-wallet-address">{user?.walletAddress || ''}</span>
              </div>
            </div>
          </div>
          
          <Card className="bg-card/80 backdrop-blur-sm p-4 border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Degen Level</span>
              <SaucePointsBadge points={user?.saucePoints || 0} />
            </div>
          </Card>

          {/* Referral Code Section */}
          <Card className="bg-card/80 backdrop-blur-sm p-4 border-primary/20 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  Referral Code
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingReferralCode(!isEditingReferralCode)}
                  className="text-xs"
                >
                  {isEditingReferralCode ? "Cancel" : "Edit"}
                </Button>
              </div>
              
              {isEditingReferralCode ? (
                <div className="space-y-2">
                  <Label htmlFor="referral-code" className="text-xs text-muted-foreground">
                    Custom Code (1-5 letters/numbers)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="referral-code"
                      value={referralCode}
                      onChange={handleReferralCodeChange}
                      placeholder="CHEF1"
                      className="text-sm"
                      maxLength={5}
                    />
                    <Button
                      size="sm"
                      onClick={saveReferralCode}
                      disabled={!validateReferralCode(referralCode)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="bg-primary/10 text-primary px-2 py-1 rounded text-sm font-mono">
                      {user?.referralCode || ''}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyReferralLink}
                      className="p-1 h-auto"
                    >
                      {copiedCode ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span>{user?.totalReferrals ?? 0} referrals</span>
                      <span>{(user?.referralEarnings ?? 0).toFixed(2)} SOL earned</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Tickets Section */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active" data-testid="tab-active-tickets">Active Tickets</TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past-tickets">Past Tickets</TabsTrigger>
            <TabsTrigger value="referrals" data-testid="tab-referrals">Referrals</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4 mt-4">
            {mockActiveTickets.length > 0 ? (
              mockActiveTickets.map((ticket, index) => (
                <TicketCard
                  key={index}
                  {...ticket}
                  onClaim={() => console.log("Claim ticket")}
                />
              ))
            ) : (
              <Card className="p-8 text-center">
                <User className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No active tickets</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Buy tickets to join raffles! 🎫
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4 mt-4">
            {mockPastTickets.map((ticket, index) => (
              <TicketCard
                key={index}
                {...ticket}
                onClaim={() => console.log("Claim ticket")}
              />
            ))}
          </TabsContent>

          <TabsContent value="referrals" className="space-y-4 mt-4">
            <Card className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Share Your Referral Code</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Earn rewards when friends join using your code
                  </p>
                </div>

                <div className="bg-primary/10 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <code className="text-lg font-mono font-bold text-primary">
                      {user?.referralCode || ''}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyReferralLink}
                      className="p-1 h-auto"
                    >
                      {copiedCode ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {user?.referralLink || ''}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-card/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary">{mockUser.totalReferrals}</div>
                    <div className="text-xs text-muted-foreground">Total Referrals</div>
                  </div>
                  <div className="bg-card/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary">{mockUser.referralEarnings}</div>
                    <div className="text-xs text-muted-foreground">SOL Earned</div>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={() => {
                    // Share functionality
                    if (navigator.share && user) {
                      navigator.share({
                        title: 'Join Let\'s Cook with my referral code!',
                        text: `Use my referral code ${user.referralCode} to join Let's Cook!`,
                        url: user.referralLink,
                      });
                    } else {
                      copyReferralLink();
                    }
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Referral Link
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

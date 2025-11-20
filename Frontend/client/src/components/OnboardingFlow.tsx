import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChefHat, Wallet, UserPlus, Shield, Target, Zap, Gift, ArrowRight, Link as LinkIcon } from "lucide-react";
import { useWallet } from '@solana/wallet-adapter-react';
import { referralService } from '@/lib/referralService';

interface OnboardingFlowProps {
  onComplete: (data: { username: string; walletConnected: boolean; referralOptIn: boolean; referralLink?: string }) => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [referralOptIn, setReferralOptIn] = useState(true);
  const [referrerCode, setReferrerCode] = useState("");
  const { publicKey } = useWallet();

  const handleNext = async () => {
    if (step < 5) {
      setStep(step + 1);
      return;
    }
    let referralLink: string | undefined = undefined;
    try {
      if (publicKey && referralOptIn) {
        const code = await referralService.generateReferralCode(publicKey);
        const baseUrl = typeof window !== 'undefined' && (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
          ? 'https://lets-cook-frontend.onrender.com'
          : (typeof window !== 'undefined' ? window.location.origin : 'https://lets-cook-frontend.onrender.com');
        referralLink = `${baseUrl}?ref=${code}`;
        if (username.trim()) {
          await referralService.setUsername(publicKey, username.trim());
        }
        if (referrerCode.trim()) {
          await referralService.trackReferralUsage(referrerCode.trim().toUpperCase(), publicKey);
        }
      }
    } catch (e) {
      console.error('Onboarding referral setup failed:', e);
    } finally {
      onComplete({ username, walletConnected, referralOptIn, referralLink });
    }
  };

  const handleSkip = () => {
    onComplete({ username: "", walletConnected: false, referralOptIn: false });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6">
        {/* Progress Dots */}
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((dot) => (
            <div
              key={dot}
              className={`w-3 h-3 rounded-full transition-colors ${
                dot <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: The Problem */}
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-destructive/10 rounded-full">
                <Shield className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">The Dev Dump Problem</h2>
              <div className="space-y-3 text-lg text-muted-foreground">
                <p>You're hyped for a new memecoin launch. You ape in early, your wallet's ready, and you're dreaming of 10x gains.</p>
                <p className="text-destructive font-semibold">But before the token even bonds, BAM—the devs dump their bags, the price tanks, and your SOL is gone.</p>
                <p>Sound familiar? We've all been burned by those shady launches where the only winners are the devs cashing out.</p>
              </div>
            </div>
            <Button onClick={handleNext} className="btn-primary w-full">
              Show Me The Solution
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: The Solution */}
        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-primary/10 rounded-full">
                <ChefHat className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">Let's Cook Solution</h2>
              <div className="space-y-3 text-lg text-muted-foreground">
                <p><span className="text-primary font-semibold">Not anymore.</span> Let's Cook flips the script with raffle-based launches that ensure a fair shot for everyone.</p>
                <p>No more losing your hard-earned SOL to instant dumps. With transparent raffles, guaranteed refunds for losing tickets, and automated liquidity pools.</p>
                <p className="text-foreground font-medium">We're cooking up a recipe for safe, fun, and equitable token launches!</p>
              </div>
            </div>
            <Button onClick={handleNext} className="btn-primary w-full">
              How It Works
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 3: How It Works */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-4">How Let's Cook Works</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Buy Tickets</h3>
                  <p className="text-sm text-muted-foreground">Purchase raffle tickets at a fixed price. No limits, no FOMO.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-success">2</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Random Draw</h3>
                  <p className="text-sm text-muted-foreground">Winning tickets are randomly selected. Everyone gets an equal chance.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-warning/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-warning">3</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Claim or Refund</h3>
                  <p className="text-sm text-muted-foreground">Winners claim tokens. Losers get refunds. No losses!</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-info/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-info">4</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Instant Trading</h3>
                  <p className="text-sm text-muted-foreground">First claim triggers automated liquidity. Tokens are immediately tradeable.</p>
                </div>
              </div>
            </div>
            <Button onClick={handleNext} className="btn-primary w-full">
              Why Choose Us
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 4: Why Choose Us */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-4">Why Let's Cook?</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Fair & Inclusive</h3>
                  <p className="text-sm text-muted-foreground">Randomized ticket draws give everyone an equal shot at tokens.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="h-4 w-4 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Safe & Transparent</h3>
                  <p className="text-sm text-muted-foreground">Refunds for losing tickets and failed raffles build user trust.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-warning/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">No More Dev Dumps</h3>
                  <p className="text-sm text-muted-foreground">The raffle system and liquidity threshold ensure fair launches.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-info/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Gift className="h-4 w-4 text-info" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Fun & Engaging</h3>
                  <p className="text-sm text-muted-foreground">A gamified, vibrant app experience attracts a broad audience.</p>
                </div>
              </div>
            </div>
            <Button onClick={handleNext} className="btn-primary w-full">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 5: Setup */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">Let's Get You Started!</h2>
              <p className="text-muted-foreground">Complete your profile to join the cooking revolution.</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-sm font-medium text-foreground">Username (Optional)</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="referrer" className="text-sm font-medium text-foreground">Who referred you? (Optional)</Label>
                <Input
                  id="referrer"
                  value={referrerCode}
                  onChange={(e) => setReferrerCode(e.target.value.toUpperCase())}
                  placeholder="Enter referral code e.g. CHEFABCD1234"
                  className="mt-1"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground">Connect Wallet</Label>
                  <p className="text-xs text-muted-foreground">Connect your Solana wallet to participate</p>
                </div>
                <Switch
                  checked={walletConnected}
                  onCheckedChange={setWalletConnected}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground">Referral Program</Label>
                  <p className="text-xs text-muted-foreground">Earn rewards for bringing friends</p>
                </div>
                <Switch
                  checked={referralOptIn}
                  onCheckedChange={setReferralOptIn}
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleSkip} className="flex-1">
                Skip for Now
              </Button>
              <Button onClick={handleNext} className="flex-1 btn-primary">
                Complete Setup
                <ChefHat className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
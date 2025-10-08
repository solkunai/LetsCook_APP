import SaucePointsBadge from "@/components/SaucePointsBadge";
import { Card } from "@/components/ui/card";
import { ChefHat, Shield, Sparkles, TrendingUp, Coins, Lock } from "lucide-react";
import { useWalletConnection } from "@/lib/wallet";
import { useState, useEffect } from "react";

// User sauce points will be fetched from blockchain
// const MOCK_USER_SAUCE_POINTS = 750;

export default function DocsPage() {
  const { wallet } = useWalletConnection();
  const [userSaucePoints, setUserSaucePoints] = useState(0);

  useEffect(() => {
    if (wallet.publicKey) {
      // Fetch real sauce points from blockchain
      // This would call the citizens program to get user sauce points
      // For now, we'll use 0 until the API is implemented
    }
  }, [wallet.publicKey]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-hero pt-8 pb-6 px-4 border-b border-border relative">
        <div className="absolute top-4 right-4 z-20">
          <Card className="p-3 bg-card/90 backdrop-blur-sm">
            <SaucePointsBadge points={userSaucePoints} />
          </Card>
        </div>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <ChefHat className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-heading font-bold">Documentation</h1>
          </div>
          <p className="text-muted-foreground">Everything you need to know about Let's Cook</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-heading font-bold mb-4">Overview</h2>
          <Card className="p-6">
            <p className="text-muted-foreground leading-relaxed mb-4">
              Let's Cook is a platform built on the Solana blockchain, revolutionizing token launches with a raffle-style mechanism. Designed to address the frustrations of unfair launches and dev dumps, it ensures safe, transparent, and engaging token distributions for users and customizable options for developers.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              By leveraging Solana's high-speed, low-cost transactions, Let's Cook creates a vibrant ecosystem for memecoins and beyond.
            </p>
          </Card>
        </section>

        {/* Purpose */}
        <section>
          <h2 className="text-2xl font-heading font-bold mb-4">Purpose</h2>
          <div className="grid gap-3">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Fairness</h3>
                  <p className="text-sm text-muted-foreground">Equal chances for all participants via randomized winning tickets</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-secondary mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Safety</h3>
                  <p className="text-sm text-muted-foreground">Refunds for losing tickets and failed raffles protect users from losses</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Engagement</h3>
                  <p className="text-sm text-muted-foreground">A gamified raffle system makes launches exciting and accessible</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Flexibility</h3>
                  <p className="text-sm text-muted-foreground">Developers can tailor tokenomics to fit their project's vision</p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Key Features */}
        <section>
          <h2 className="text-2xl font-heading font-bold mb-4">Key Features</h2>
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Raffle-Based Token Launches</h3>
              <p className="text-sm text-muted-foreground">
                Users buy tickets for a chance at token allocations, with losing tickets refunded (minus a small platform fee), preventing losses from dev dumps.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2. Customizable Tokenomics</h3>
              <p className="text-sm text-muted-foreground">
                Developers allocate percentages for airdrops, marketing, market-making rewards, team, and liquidity pools (e.g., $TOKEN/SOL).
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3. Guaranteed Liquidity Threshold</h3>
              <p className="text-sm text-muted-foreground">
                Ensures sufficient funds for a viable liquidity pool; if unmet, raffles fail, and all tickets are refunded, safeguarding user investments.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">4. Automated Liquidity Pool Deployment</h3>
              <p className="text-sm text-muted-foreground">
                Triggered by the first winning ticket claim, enabling immediate trading without manual intervention.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">5. User-Friendly Mobile App</h3>
              <p className="text-sm text-muted-foreground">
                Browse raffles, purchase tickets, and claim winnings with an intuitive, vibrant interface.
              </p>
            </div>
          </Card>
        </section>

        {/* Raffle Workflow */}
        <section>
          <h2 className="text-2xl font-heading font-bold mb-4">Raffle Workflow</h2>
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-primary mb-2">1. Raffle Creation</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Token creators define raffle parameters: ticket price, number of winning tickets, guaranteed liquidity threshold, and reward structure. They customize tokenomics by setting allocations for airdrops, marketing, market-making rewards, team, and liquidity pool.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-primary mb-2">2. Browsing Raffles</h3>
              <p className="text-sm text-muted-foreground">
                Users explore active raffles on the homepage or Calendar page, filtering by specific days or date ranges for easy discovery with transparent details like ticket price and winning odds.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-primary mb-2">3. Buying Tickets</h3>
              <p className="text-sm text-muted-foreground">
                During the open period, users purchase unlimited tickets at a fixed price. Real-time odds update as more tickets are sold, ensuring transparency and securing chances at token allocations without fear of instant dumps.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-primary mb-2">4. Raffle Closing</h3>
              <p className="text-sm text-muted-foreground">
                Ticket sales halt at the end of the raffle period. Total tickets sold determine the final winning odds. The raffle locks, ensuring no last-minute manipulations.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-primary mb-2">5. Checking Tickets</h3>
              <p className="text-sm text-muted-foreground">
                Users view their tickets in the app to see which are winning or losing, based on the preset number of winning tickets. Clear, tamper-proof results show who wins token allocations.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-primary mb-2">6. Claiming Winning Tickets</h3>
              <p className="text-sm text-muted-foreground">
                Winning ticket holders claim their equal token allocations. Losing ticket holders receive refunds (minus platform fees). Winners get tokens, and losers are protected with refunds.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-primary mb-2">7. Guaranteed Liquidity Threshold</h3>
              <p className="text-sm text-muted-foreground">
                If ticket sales meet or exceed the liquidity threshold, the raffle succeeds. If unmet, the raffle fails, and all tickets are refunded in full, ensuring only viable projects proceed.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-primary mb-2">8. Automated Liquidity Pool Deployment</h3>
              <p className="text-sm text-muted-foreground">
                The first winning ticket claim triggers a liquidity pool ($TOKEN/SOL) on a supported AMM (e.g., Raydium or CookAMM). Tokens are tradable immediately, reducing the risk of price crashes due to delayed liquidity.
              </p>
            </div>
          </Card>
        </section>

        {/* Why Let's Cook */}
        <section>
          <h2 className="text-2xl font-heading font-bold mb-4">Why Let's Cook?</h2>
          <Card className="p-6 space-y-3">
            <div className="flex items-start gap-3">
              <Coins className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">No More Dev Dumps</h3>
                <p className="text-sm text-muted-foreground">The raffle system and liquidity threshold ensure fair launches, protecting users from instant sell-offs.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Fair and Inclusive</h3>
                <p className="text-sm text-muted-foreground">Randomized ticket draws give everyone an equal shot at tokens.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Safe and Transparent</h3>
                <p className="text-sm text-muted-foreground">Refunds for losing tickets and failed raffles build user trust.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Developer-Friendly</h3>
                <p className="text-sm text-muted-foreground">Customizable tokenomics empower creators to align launches with their goals.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Fun and Engaging</h3>
                <p className="text-sm text-muted-foreground">A gamified, vibrant app experience attracts a broad user base.</p>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

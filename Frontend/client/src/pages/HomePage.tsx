import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronRight, 
  Shield, 
  Zap, 
  Users, 
  TrendingUp, 
  Clock, 
  Star,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Rocket,
  Target,
  Globe,
  Loader2
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { usePlatformStats, useActiveLaunches, useUpcomingLaunches } from '@/hooks/useApi';
import BuyTicketsModal from '@/components/BuyTicketsModal';
import { useLocation } from 'wouter';

export default function HomePage() {
  const { connected } = useWallet();
  const [, setLocation] = useLocation();
  const { data: platformStats, isLoading: statsLoading } = usePlatformStats();
  const { data: activeLaunches, isLoading: activeLoading } = useActiveLaunches();
  const { data: upcomingLaunches, isLoading: upcomingLoading } = useUpcomingLaunches();
  const [selectedLaunch, setSelectedLaunch] = useState<any>(null);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <img 
                  src="/logo.jpg" 
                  alt="Let's Cook Logo" 
                  className="w-10 h-10 object-contain"
                />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Let's Cook
                </h1>
                <p className="text-xs text-muted-foreground">Solana Launchpad</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <nav className="hidden md:flex items-center space-x-6">
                <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </a>
                <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  How it Works
                </a>
                <a href="#launches" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Live Launches
                </a>
                <button 
                  onClick={() => setLocation('/liquidity')}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Liquidity
                </button>
                <button 
                  onClick={() => setLocation('/referrals')}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Referrals
                </button>
              </nav>
              
              <WalletMultiButton className="wallet-adapter-button-custom" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]"></div>
        
        {/* Animated Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] animate-pulse"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
                <Rocket className="w-4 h-4 mr-2" />
                Outsmarting the Dev Dump
              </Badge>
              
              <div className="flex items-center justify-center mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="mr-4"
                >
                  <img 
                    src="/logo.jpg" 
                    alt="Let's Cook Logo" 
                    className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 object-contain"
                  />
                </motion.div>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
                  <span className="bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent">
                    Let's Cook
                  </span>
                </h1>
              </div>
              
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
                Raffle-Based Token Launchpad on Solana
              </h2>
              
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                No more losing your SOL to instant dumps! Our raffle-based launchpad ensures 
                <span className="text-primary font-semibold"> fair chances for everyone</span> with 
                guaranteed refunds and transparent processes.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg px-8 py-4"
                onClick={() => setLocation('/create-launch')}
              >
                {connected ? '🍳 Let\'s Cook!' : 'Connect Wallet to Start Cooking'}
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-4 group"
                onClick={() => document.getElementById('launches')?.scrollIntoView({ behavior: 'smooth' })}
              >
                View Active Raffles
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto pt-8"
            >
              <StatCard 
                number={statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : `$${(platformStats?.totalVolume / 1e9).toFixed(1)}M+`} 
                label="Total Volume" 
              />
              <StatCard 
                number={statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : `${platformStats?.successfulLaunches || 0}+`} 
                label="Successful Launches" 
              />
              <StatCard 
                number={statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : `${platformStats?.successRate.toFixed(0)}%`} 
                label="Success Rate" 
              />
              <StatCard 
                number="24/7" 
                label="Support" 
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <Badge variant="outline" className="px-4 py-2">
              <Star className="w-4 h-4 mr-2" />
              Why Choose Let's Cook
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              Built for <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Fairness</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our platform eliminates the common pitfalls of token launches with innovative solutions
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={Shield}
              title="No More Dev Dumps"
              description="Raffle system prevents instant sell-offs. Losing tickets get refunded, protecting your SOL from shady launches."
              gradient="from-green-500 to-emerald-500"
            />
            <FeatureCard
              icon={Zap}
              title="Guaranteed Liquidity"
              description="Automated pool deployment with liquidity thresholds. If not met, all tickets refunded - no failed launches!"
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={Users}
              title="Equal Chances for All"
              description="Randomized ticket draws give everyone the same shot at tokens, regardless of wallet size or timing."
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={Target}
              title="Customizable Tokenomics"
              description="Developers set allocations for airdrops, marketing, team, and liquidity - all transparent and fair."
              gradient="from-orange-500 to-red-500"
            />
            <FeatureCard
              icon={Clock}
              title="Real-Time Odds"
              description="Watch your winning chances update live as more tickets sell. Complete transparency in every raffle."
              gradient="from-indigo-500 to-blue-500"
            />
            <FeatureCard
              icon={Globe}
              title="Mobile-First Experience"
              description="Vibrant, intuitive app for browsing raffles, buying tickets, and claiming winnings on the go."
              gradient="from-teal-500 to-green-500"
            />
          </div>
        </div>
      </section>

      {/* Live Launches Section */}
      <section id="launches" className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <Badge variant="outline" className="px-4 py-2">
              <Rocket className="w-4 h-4 mr-2" />
              Active Raffles
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Live</span> Raffles
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Buy tickets for your chance to win tokens in these active raffles
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-8 bg-muted rounded w-1/2"></div>
                    <div className="h-3 bg-muted rounded w-full"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </Card>
              ))
            ) : activeLaunches && activeLaunches.length > 0 ? (
              activeLaunches.slice(0, 6).map((launch) => (
                <LaunchCard 
                  key={launch.id} 
                  launch={launch} 
                  onBuyTickets={(launch) => {
                    setSelectedLaunch(launch);
                    setIsBuyModalOpen(true);
                  }}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <Rocket className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Active Launches</h3>
                <p className="text-muted-foreground">Check back soon for new token launches!</p>
              </div>
            )}
          </div>

          {upcomingLaunches && upcomingLaunches.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mt-16"
            >
              <h3 className="text-2xl font-bold text-center mb-8">Upcoming Launches</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingLaunches.slice(0, 3).map((launch) => (
                  <LaunchCard 
                    key={launch.id} 
                    launch={launch} 
                    isUpcoming 
                    onBuyTickets={(launch) => {
                      setSelectedLaunch(launch);
                      setIsBuyModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <Badge variant="outline" className="px-4 py-2">
              <Rocket className="w-4 h-4 mr-2" />
              Raffle Workflow
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              How <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Let's Cook</span> Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Fair, transparent, and safe token launches that protect everyone
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <StepCard
              step="01"
              title="Create Raffle"
              description="Set ticket price, winning odds, and liquidity threshold. Customize tokenomics for airdrops, team, and marketing."
              icon={CheckCircle}
            />
            <StepCard
              step="02"
              title="Buy Tickets"
              description="Users buy unlimited tickets during the open period. Real-time odds update as more tickets sell."
              icon={Target}
            />
            <StepCard
              step="03"
              title="Win & Trade"
              description="Winners claim tokens, losers get refunds. First claim triggers automated liquidity pool deployment."
              icon={Rocket}
            />
          </div>
        </div>
      </section>

      {/* Anti-Dev Dump Section */}
      <section className="py-20 bg-gradient-to-br from-red-500/10 via-orange-500/5 to-yellow-500/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center space-y-8 max-w-4xl mx-auto"
          >
            <div className="flex items-center justify-center mb-4">
              <span className="text-4xl mr-3">😤</span>
              <h2 className="text-3xl md:text-4xl font-bold text-red-500">
                Tired of Dev Dumps?
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-red-400">The Old Way (Broken)</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">❌</span>
                    Devs dump their bags instantly
                  </li>
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">❌</span>
                    Price tanks before you can sell
                  </li>
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">❌</span>
                    Your SOL is gone forever
                  </li>
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">❌</span>
                    No protection, no refunds
                  </li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-green-400">Let's Cook (Fixed)</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✅</span>
                    Raffle system prevents dumps
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✅</span>
                    Losing tickets get refunded
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✅</span>
                    Your SOL is protected
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✅</span>
                    Fair chances for everyone
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl p-6 border border-primary/30">
              <p className="text-lg font-medium mb-2">🍳 Ready to cook up something better?</p>
              <p className="text-muted-foreground">
                Join the revolution against unfair launches. Let's Cook ensures every participant 
                gets a fair shot while protecting your investments.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center space-y-8 max-w-3xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Cook Up Something Fair?
            </h2>
            <p className="text-xl text-muted-foreground">
              Join the revolution against dev dumps. Launch your token the right way with Let's Cook.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg px-8 py-4"
                onClick={() => window.location.href = '/create-launch'}
              >
                🍳 Let's Cook!
                <Rocket className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-4"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold">Let's Cook</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Buy Tickets Modal */}
      {selectedLaunch && (
        <BuyTicketsModal
          isOpen={isBuyModalOpen}
          onClose={() => {
            setIsBuyModalOpen(false);
            setSelectedLaunch(null);
          }}
          launch={selectedLaunch}
        />
      )}
    </div>
  );
}

function StatCard({ number, label }: { number: React.ReactNode; label: string }) {
  return (
    <div className="text-center space-y-2">
      <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
        {number}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function LaunchCard({ 
  launch, 
  isUpcoming = false, 
  onBuyTickets 
}: { 
  launch: any; 
  isUpcoming?: boolean;
  onBuyTickets?: (launch: any) => void;
}) {
  const [, setLocation] = useLocation();
  const launchDate = new Date(launch.launchDate * 1000);
  const closeDate = new Date(launch.closeDate * 1000);
  const now = new Date();
  
  const timeRemaining = isUpcoming 
    ? Math.max(0, launchDate.getTime() - now.getTime())
    : Math.max(0, closeDate.getTime() - now.getTime());
  
  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="group"
    >
      <Card className="h-full hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/50">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {launch.symbol?.charAt(0) || 'T'}
                </span>
              </div>
              <div>
                <h3 className="font-semibold">{launch.name}</h3>
                <p className="text-sm text-muted-foreground">{launch.symbol}</p>
              </div>
            </div>
            <Badge variant={isUpcoming ? "secondary" : "default"}>
              {isUpcoming ? "Upcoming" : "Live"}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">🎫 Ticket Price:</span>
              <span className="font-medium">{(launch.ticketPrice / 1e9).toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">🎲 Tickets Sold:</span>
              <span className="font-medium">{launch.totalTicketsSold || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">🔥 Hype Score:</span>
              <span className="font-medium">{launch.hypeScore || 0}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {isUpcoming ? "Starts in:" : "Ends in:"}
              </span>
              <span className="font-medium">
                {days > 0 ? `${days}d ${hours}h` : `${hours}h`}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, ((launch.totalTicketsSold || 0) / launch.numMints) * 100)}%` 
                }}
              ></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Button 
              className="w-full" 
              variant={isUpcoming ? "outline" : "default"}
              disabled={isUpcoming}
              onClick={() => onBuyTickets?.(launch)}
            >
              {isUpcoming ? "Coming Soon" : "🎫 Buy Tickets"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="w-full"
              onClick={() => setLocation(`/token/${launch.id || launch.symbol}`)}
            >
              View Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  gradient 
}: { 
  icon: any; 
  title: string; 
  description: string; 
  gradient: string; 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="group"
    >
      <Card className="h-full hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/50">
        <CardContent className="p-6 space-y-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-muted-foreground leading-relaxed">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StepCard({ 
  step, 
  title, 
  description, 
  icon: Icon 
}: { 
  step: string; 
  title: string; 
  description: string; 
  icon: any; 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="text-center space-y-4"
    >
      <div className="relative">
        <div className="w-16 h-16 mx-auto bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center text-white font-bold text-lg">
          {step}
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-background border-2 border-primary rounded-full flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </motion.div>
  );
}
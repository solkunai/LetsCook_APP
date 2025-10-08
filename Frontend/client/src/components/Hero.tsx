import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, Shield, Zap, Users } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-radial from-purple-500/10 via-background to-background" />
      
      {/* Animated Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px]" />

      <div className="container relative z-10 px-4 md:px-6 space-y-12 py-24">
        {/* Main Heading */}
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-2"
          >
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-foreground">
              <span className="text-gradient">Let's Cook:</span> The Fair Launch
              <br className="hidden md:inline" /> Revolution on Solana
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground">
              Outsmarting the Dev Dump with Raffle-Based Token Launches
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
              Launch App
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="group">
              Learn More
              <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
            </Button>
          </motion.div>
        </div>

        {/* Key Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
        >
          <FeatureCard
            icon={Shield}
            title="Safe & Fair Launches"
            description="Equal chances for all with refunds for losing tickets. No more dev dumps!"
          />
          <FeatureCard
            icon={Zap}
            title="Instant Liquidity"
            description="Automated pool deployment ensures immediate trading capability"
          />
          <FeatureCard
            icon={Users}
            title="Community First"
            description="Transparent raffles and guaranteed liquidity thresholds protect users"
          />
        </motion.div>

        {/* Story Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="max-w-3xl mx-auto text-center space-y-6"
        >
          <h2 className="text-2xl md:text-3xl font-bold">
            The End of Unfair Token Launches
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Picture this: You're hyped for a new memecoin launch. You ape in early, your wallet's
            ready, and you're dreaming of 10x gains. But before the token even bonds, BAM—the
            devs dump their bags. Sound familiar? Not anymore. Let's Cook flips the script with
            our revolutionary raffle-based launchpad.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className="card p-6 space-y-4">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
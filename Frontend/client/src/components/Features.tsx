import { motion } from 'framer-motion';
import { Shield, Zap, Users, Rocket, Lock, ChartBar } from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Fair Launches',
    description: 'Equal chances for all participants via randomized winning tickets. No more dev dumps!',
    color: 'text-primary'
  },
  {
    icon: Lock,
    title: 'Guaranteed Safety',
    description: 'Refunds for losing tickets and failed raffles protect users from losses.',
    color: 'text-green-500'
  },
  {
    icon: Users,
    title: 'Community First',
    description: 'Transparent process and governance ensures everyone has a voice.',
    color: 'text-purple-500'
  },
  {
    icon: Zap,
    title: 'Instant Liquidity',
    description: 'Automated liquidity pool deployment for immediate trading.',
    color: 'text-yellow-500'
  },
  {
    icon: Rocket,
    title: 'Flexible Tokenomics',
    description: 'Customizable allocations for airdrops, marketing, and team tokens.',
    color: 'text-pink-500'
  },
  {
    icon: ChartBar,
    title: 'Analytics Dashboard',
    description: 'Track your tickets, wins, and portfolio performance in real-time.',
    color: 'text-blue-500'
  }
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export function Features() {
  return (
    <section className="py-24 bg-background/50">
      <div className="container px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Why Choose Let's Cook?
          </h2>
          <p className="text-lg text-muted-foreground">
            Our raffle-based launchpad revolutionizes token launches with fairness,
            safety, and excitement at its core.
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FeatureCard({ feature }) {
  const Icon = feature.icon;
  
  return (
    <motion.div
      variants={item}
      className="group relative overflow-hidden"
    >
      <div className="card transition-all duration-300 hover:translate-y-[-4px] hover:shadow-xl">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
          'bg-gradient-to-br from-background to-primary/10'
        )}>
          <Icon className={cn('w-6 h-6', feature.color)} />
        </div>
        
        <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
          {feature.title}
        </h3>
        
        <p className="text-muted-foreground">
          {feature.description}
        </p>
        
        {/* Hover Effect */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        </div>
      </div>
    </motion.div>
  );
}

import { cn } from '@/lib/utils';
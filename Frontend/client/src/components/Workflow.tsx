import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import {
  FileText,
  Search,
  Ticket,
  Clock,
  CheckCircle,
  Award,
  ShieldCheck,
  Zap
} from 'lucide-react';

const workflowSteps: WorkflowStep[] = [
  {
    icon: FileText,
    title: 'Raffle Creation',
    description: 'Token creators set parameters, tokenomics, and liquidity thresholds.',
  },
  {
    icon: Search,
    title: 'Browse Raffles',
    description: 'Explore active raffles and filter by date ranges for easy discovery.',
  },
  {
    icon: Ticket,
    title: 'Buy Tickets',
    description: 'Purchase tickets during the open period with real-time odds updates.',
  },
  {
    icon: Clock,
    title: 'Raffle Closing',
    description: 'Sales halt at period end, finalizing odds and preventing manipulation.',
  },
  {
    icon: CheckCircle,
    title: 'Check Results',
    description: 'View winning tickets through our tamper-proof verification system.',
  },
  {
    icon: Award,
    title: 'Claim Rewards',
    description: 'Winners claim tokens, losers receive refunds minus platform fees.',
  },
  {
    icon: ShieldCheck,
    title: 'Liquidity Check',
    description: 'System verifies if threshold is met, protecting from underfunded launches.',
  },
  {
    icon: Zap,
    title: 'Auto-Deploy Pool',
    description: 'First claim triggers automated liquidity pool deployment.',
  },
];

export function Workflow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.8, 1, 1, 0.8]);

  return (
    <section ref={containerRef} className="py-24 bg-gradient-to-b from-background/50 to-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px]" />
        <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent" />
      </div>

      <motion.div
        style={{ opacity, scale }}
        className="container px-4 md:px-6 relative"
      >
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground">
            Our 8-step process ensures fair, transparent, and efficient token launches
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {workflowSteps.map((step, index) => (
            <WorkflowCard
              key={index}
              step={step}
              index={index}
              total={workflowSteps.length}
            />
          ))}
        </div>
      </motion.div>
    </section>
  );
}

import { WorkflowCardProps, WorkflowStep } from '@/types/components';

function WorkflowCard({ step, index, total }: WorkflowCardProps) {
  const Icon = step.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      viewport={{ once: true }}
      className="relative"
    >
      <div className="card group hover:border-primary/20">
        {/* Step Number */}
        <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-sm font-bold text-primary">
          {index + 1}
        </div>

        {/* Connection Line */}
        {index < total - 1 && (
          <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-border" />
        )}

        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
          <Icon className="w-6 h-6 text-primary" />
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
          {step.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {step.description}
        </p>
      </div>
    </motion.div>
  );
}
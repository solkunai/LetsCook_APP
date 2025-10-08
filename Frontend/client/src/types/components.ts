import { LucideIcon } from 'lucide-react';

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}

export interface WorkflowStep {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface WorkflowCardProps {
  step: WorkflowStep;
  index: number;
  total: number;
}

export interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}
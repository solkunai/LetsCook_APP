import { Badge } from '@/components/ui/badge';
import { Zap, ChefHat, Trophy } from 'lucide-react';

interface SaucePointsBadgeProps {
  points?: number;
}

export function getSauceLevel(points: number): { level: string; icon: any; color: string } {
  if (points >= 1000) return { level: "MOON LORD", icon: Trophy, color: "badge-primary" };
  if (points >= 500) return { level: "CHEF", icon: ChefHat, color: "badge-secondary" };
  if (points >= 100) return { level: "COOKING", icon: Zap, color: "badge-primary" };
  return { level: "NEWBIE", icon: Zap, color: "badge-secondary" };
}

export default function SaucePointsBadge({ points = 0 }: SaucePointsBadgeProps) {
  return (
    <Badge className="badge-primary">
      <Zap className="w-3 h-3 mr-1" />
      <span>{points.toLocaleString()} pts</span>
    </Badge>
  );
}

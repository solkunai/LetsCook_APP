import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, Star, Zap, TrendingUp } from 'lucide-react';

interface RaffleCardProps {
  raffle: {
    id: string;
    name: string;
    symbol: string;
    description: string;
    image: string;
    ticketPrice: number;
    totalTickets: number;
    winningTickets: number;
    ticketsSold: number;
    status: 'open' | 'closed' | 'results';
    endTime: Date;
    creator: string;
    hypeScore: number;
  };
  onBuyTickets: () => void;
}

export default function RaffleCard({ raffle, onBuyTickets }: RaffleCardProps) {
  const progressPercentage = (raffle.ticketsSold / raffle.totalTickets) * 100;
  const timeLeft = Math.ceil((raffle.endTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <Card className="card-elevated">
      <div className="space-y-4">
        {/* Token Image */}
        <div className="aspect-video rounded-lg overflow-hidden">
          <img 
            src={raffle.image} 
            alt={raffle.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Token Info */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-card-title">{raffle.name}</h3>
              <p className="text-small text-muted-foreground mt-1">{raffle.description}</p>
            </div>
            <Badge className={`badge-${raffle.status === 'open' ? 'success' : raffle.status === 'closed' ? 'warning' : 'secondary'}`}>
              {raffle.status.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="metric-card">
            <div className="metric-value">{raffle.ticketPrice}</div>
            <div className="metric-label">SOL per ticket</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{Math.round(progressPercentage)}%</div>
            <div className="metric-label">Sold</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-small text-muted-foreground">
            <span>{raffle.ticketsSold} / {raffle.totalTickets} tickets</span>
            <span>{raffle.winningTickets} winners</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Hype Score */}
        <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-small font-medium">Hype Score</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary" />
            <span className="text-small font-bold text-primary">{raffle.hypeScore}%</span>
          </div>
        </div>

        {/* Time Left */}
        <div className="flex items-center gap-2 text-small text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>
            {raffle.status === 'open' 
              ? `Ends in ${timeLeft} days`
              : raffle.status === 'closed' 
                ? 'Raffle Closed'
                : 'Results Available'
            }
          </span>
        </div>

        {/* Action Button */}
        <Button 
          className="w-full btn-primary"
          onClick={onBuyTickets}
          disabled={raffle.status !== 'open'}
        >
          {raffle.status === 'open' ? 'Buy Tickets' : 
           raffle.status === 'closed' ? 'Raffle Closed' : 
           'View Results'}
        </Button>
      </div>
    </Card>
  );
}
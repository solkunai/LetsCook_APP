import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ticket, Trophy, RefreshCw } from "lucide-react";

interface TicketCardProps {
  raffleTokenName: string;
  raffleTokenSymbol: string;
  quantity: number;
  ticketPrice: string;
  isWinner: boolean;
  claimed: boolean;
  purchaseDate: string;
  onClaim?: () => void;
}

export default function TicketCard({
  raffleTokenName,
  raffleTokenSymbol,
  quantity,
  ticketPrice,
  isWinner,
  claimed,
  purchaseDate,
  onClaim,
}: TicketCardProps) {
  const totalSpent = (parseFloat(ticketPrice) * quantity).toFixed(2);
  
  return (
    <Card className={`p-4 ${isWinner ? 'border-green-500 border-2' : ''} hover-elevate`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-heading font-semibold" data-testid="text-ticket-raffle-name">
            {raffleTokenName}
          </h3>
          <p className="text-sm text-muted-foreground">${raffleTokenSymbol}</p>
        </div>
        {isWinner ? (
          <Badge className="bg-green-500 text-white">
            <Trophy className="w-3 h-3 mr-1" />
            Winner
          </Badge>
        ) : (
          <Badge variant="outline">
            Lost
          </Badge>
        )}
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tickets Purchased</span>
          <span className="font-medium flex items-center gap-1" data-testid="text-ticket-quantity">
            <Ticket className="w-3 h-3" />
            {quantity}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Spent</span>
          <span className="font-medium" data-testid="text-total-spent">{totalSpent} SOL</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Purchase Date</span>
          <span className="font-medium">{new Date(purchaseDate).toLocaleDateString()}</span>
        </div>
      </div>

      {!claimed && (
        <Button
          className={`w-full ${isWinner ? '' : 'bg-blue-500 hover:bg-blue-600'}`}
          onClick={onClaim}
          data-testid={isWinner ? "button-claim-tokens" : "button-claim-refund"}
        >
          {isWinner ? (
            <>
              <Trophy className="w-4 h-4 mr-2" />
              Claim Tokens
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Claim Refund
            </>
          )}
        </Button>
      )}
      
      {claimed && (
        <Badge variant="outline" className="w-full justify-center">
          Claimed
        </Badge>
      )}
    </Card>
  );
}

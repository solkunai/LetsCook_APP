import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, Ticket, Minus, Plus, PieChart as PieChartIcon } from "lucide-react";
import confetti from "canvas-confetti";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

interface TicketPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  raffle: {
    tokenName: string;
    tokenSymbol: string;
    ticketPrice: string;
    totalTickets: number;
    soldTickets: number;
    tokenomics?: {
      liquidityPoolSol: number;
      liquidityPoolToken: number;
      letsCookRewards: number;
      airdrops: number;
      marketing: number;
      team: number;
    };
  } | null;
  onPurchase: (quantity: number) => void;
  isLoading?: boolean;
}

export default function TicketPurchaseModal({
  isOpen,
  onClose,
  raffle,
  onPurchase,
  isLoading = false,
}: TicketPurchaseModalProps) {
  const [quantity, setQuantity] = useState(1);

  // Early return if raffle is null
  if (!raffle) {
    return null;
  }

  const totalCost = (parseFloat(raffle.ticketPrice) * quantity).toFixed(2);
  const newOdds = raffle.totalTickets > 0 ? (quantity / raffle.totalTickets * 100).toFixed(2) : "0";

  const handlePurchase = () => {
    onPurchase(quantity);
    
    // Trigger confetti animation
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    onClose();
  };

  const increaseQuantity = () => setQuantity(q => q + 1);
  const decreaseQuantity = () => setQuantity(q => Math.max(1, q - 1));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Flame className="w-5 h-5 text-primary" />
            {raffle.tokenName} (${raffle.tokenSymbol})
          </DialogTitle>
          <DialogDescription>
            View tokenomics or purchase raffle tickets
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="purchase" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="purchase" data-testid="tab-purchase">
              <Ticket className="w-4 h-4 mr-2" />
              Purchase
            </TabsTrigger>
            <TabsTrigger value="tokenomics" data-testid="tab-tokenomics">
              <PieChartIcon className="w-4 h-4 mr-2" />
              Tokenomics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchase" className="space-y-4 py-4">
            {/* Quantity Selector */}
            <div className="space-y-2">
              <Label>Number of Tickets</Label>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={decreaseQuantity}
                  disabled={quantity <= 1}
                  data-testid="button-decrease-quantity"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="text-center text-lg font-semibold"
                  data-testid="input-ticket-quantity"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={increaseQuantity}
                  data-testid="button-increase-quantity"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2 border border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ticket Price</span>
                <span className="font-medium">{raffle.ticketPrice} SOL</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your Odds</span>
                <span className="font-medium text-primary">{newOdds}%</span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between">
                <span className="font-semibold">Total Cost</span>
                <span className="font-bold text-lg" data-testid="text-total-cost">{totalCost} SOL</span>
              </div>
            </div>

            {/* Info */}
            <p className="text-sm text-primary font-medium">
              🔥 MAX DEGEN MODE: More tickets = moon mission odds! 🚀
            </p>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1" disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handlePurchase} className="flex-1" disabled={isLoading}>
                <Ticket className="w-4 h-4 mr-2" />
                {isLoading ? 'Processing...' : 'Purchase'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="tokenomics" className="py-4">
            {raffle.tokenomics ? (
              <div className="space-y-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "LP $SOL", value: raffle.tokenomics.liquidityPoolSol, color: "hsl(262 83% 58%)" },
                        { name: "LP $TOKEN", value: raffle.tokenomics.liquidityPoolToken, color: "hsl(158 64% 52%)" },
                        { name: "Market Making", value: raffle.tokenomics.letsCookRewards, color: "hsl(47 96% 53%)" },
                        { name: "Airdrops", value: raffle.tokenomics.airdrops, color: "hsl(200 85% 55%)" },
                        { name: "Marketing", value: raffle.tokenomics.marketing, color: "hsl(280 70% 60%)" },
                        { name: "Team", value: raffle.tokenomics.team, color: "hsl(0 85% 55%)" },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={(entry) => `${entry.value}%`}
                    >
                      {[
                        { name: "LP $SOL", value: raffle.tokenomics.liquidityPoolSol, color: "hsl(262 83% 58%)" },
                        { name: "LP $TOKEN", value: raffle.tokenomics.liquidityPoolToken, color: "hsl(158 64% 52%)" },
                        { name: "Market Making", value: raffle.tokenomics.letsCookRewards, color: "hsl(47 96% 53%)" },
                        { name: "Airdrops", value: raffle.tokenomics.airdrops, color: "hsl(200 85% 55%)" },
                        { name: "Marketing", value: raffle.tokenomics.marketing, color: "hsl(280 70% 60%)" },
                        { name: "Team", value: raffle.tokenomics.team, color: "hsl(0 85% 55%)" },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span className="text-xs">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Liquidity Pool</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">$SOL</span>
                        <span className="font-medium">{raffle.tokenomics.liquidityPoolSol}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">$TOKEN</span>
                        <span className="font-medium">{raffle.tokenomics.liquidityPoolToken}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <h4 className="font-semibold mb-2">Let's Cook Rewards</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Market Making</span>
                      <span className="font-medium">{raffle.tokenomics.letsCookRewards}%</span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <h4 className="font-semibold mb-2">Creator Controls</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Airdrops</span>
                        <span className="font-medium">{raffle.tokenomics.airdrops}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Marketing</span>
                        <span className="font-medium">{raffle.tokenomics.marketing}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Team</span>
                        <span className="font-medium">{raffle.tokenomics.team}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Tokenomics data not available for this raffle
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

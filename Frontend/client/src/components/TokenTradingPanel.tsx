import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Droplet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface TokenTradingPanelProps {
  tokenSymbol: string;
  currentPrice: number;
  priceChange24h: number;
  liquidityPool: { token: number; sol: number };
  userBalance: { sol: number; token: number };
}

const mockChartData = [
  { time: "00:00", price: 0.85 },
  { time: "04:00", price: 0.92 },
  { time: "08:00", price: 0.88 },
  { time: "12:00", price: 0.95 },
  { time: "16:00", price: 1.02 },
  { time: "20:00", price: 0.98 },
  { time: "24:00", price: 1.05 },
];

export default function TokenTradingPanel({
  tokenSymbol,
  currentPrice,
  priceChange24h,
  liquidityPool,
  userBalance,
}: TokenTradingPanelProps) {
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");

  const handleBuy = () => {
    console.log(`Buying ${buyAmount} SOL worth of ${tokenSymbol}`);
    setBuyAmount("");
  };

  const handleSell = () => {
    console.log(`Selling ${sellAmount} ${tokenSymbol}`);
    setSellAmount("");
  };

  return (
    <div className="space-y-4">
      {/* Price Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-heading font-bold" data-testid="text-token-symbol">${tokenSymbol}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-3xl font-bold" data-testid="text-current-price">${currentPrice.toFixed(4)}</span>
              <span className={`flex items-center text-sm ${priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {priceChange24h >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                {Math.abs(priceChange24h).toFixed(2)}%
              </span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Droplet className="w-4 h-4" />
              <span className="text-sm">Liquidity Pool</span>
            </div>
            <p className="text-sm font-medium">{liquidityPool.token.toLocaleString()} ${tokenSymbol}</p>
            <p className="text-sm font-medium">{liquidityPool.sol.toLocaleString()} SOL</p>
          </div>
        </div>

        {/* Price Chart */}
        <div className="h-48 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockChartData}>
              <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Trading Interface */}
      <Card className="p-6">
        <Tabs defaultValue="buy" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy" data-testid="tab-buy">Buy</TabsTrigger>
            <TabsTrigger value="sell" data-testid="tab-sell">Sell</TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="buy-amount">Amount (SOL)</Label>
              <Input
                id="buy-amount"
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="0.00"
                data-testid="input-buy-amount"
              />
              <p className="text-sm text-muted-foreground">
                Balance: {userBalance.sol.toFixed(4)} SOL
              </p>
            </div>
            
            {buyAmount && (
              <div className="p-3 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">You'll receive approximately</p>
                <p className="text-lg font-semibold">
                  {(parseFloat(buyAmount) / currentPrice).toFixed(2)} ${tokenSymbol}
                </p>
              </div>
            )}

            <Button 
              className="w-full" 
              onClick={handleBuy}
              disabled={!buyAmount || parseFloat(buyAmount) <= 0}
              data-testid="button-execute-buy"
            >
              Buy ${tokenSymbol}
            </Button>
          </TabsContent>

          <TabsContent value="sell" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="sell-amount">Amount (${tokenSymbol})</Label>
              <Input
                id="sell-amount"
                type="number"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                placeholder="0.00"
                data-testid="input-sell-amount"
              />
              <p className="text-sm text-muted-foreground">
                Balance: {userBalance.token.toFixed(2)} ${tokenSymbol}
              </p>
            </div>

            {sellAmount && (
              <div className="p-3 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">You'll receive approximately</p>
                <p className="text-lg font-semibold">
                  {(parseFloat(sellAmount) * currentPrice).toFixed(4)} SOL
                </p>
              </div>
            )}

            <Button 
              className="w-full" 
              onClick={handleSell}
              disabled={!sellAmount || parseFloat(sellAmount) <= 0}
              data-testid="button-execute-sell"
            >
              Sell ${tokenSymbol}
            </Button>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TicketCard from "@/components/TicketCard";
import SaucePointsBadge from "@/components/SaucePointsBadge";
import { User, Wallet } from "lucide-react";

// todo: remove mock functionality
const mockUser = {
  username: "chef_master",
  walletAddress: "9xQe...7mK3",
  saucePoints: 750,
};

const mockActiveTickets = [
  {
    raffleTokenName: "Spicy Token",
    raffleTokenSymbol: "SPCY",
    quantity: 5,
    ticketPrice: "0.1",
    isWinner: false,
    claimed: false,
    purchaseDate: "2025-02-01",
  },
];

const mockPastTickets = [
  {
    raffleTokenName: "Chef Coin",
    raffleTokenSymbol: "CHEF",
    quantity: 3,
    ticketPrice: "0.2",
    isWinner: true,
    claimed: true,
    purchaseDate: "2025-01-15",
  },
  {
    raffleTokenName: "Hot Sauce",
    raffleTokenSymbol: "HOT",
    quantity: 2,
    ticketPrice: "0.15",
    isWinner: false,
    claimed: true,
    purchaseDate: "2025-01-10",
  },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("active");

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Profile Header */}
      <div className="gradient-hero p-6 relative overflow-hidden border-b border-border">
        <div className="max-w-lg mx-auto relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="w-16 h-16 border-2 border-primary shadow-xl">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                {mockUser.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-heading font-bold" data-testid="text-username">
                {mockUser.username}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                <Wallet className="w-4 h-4" />
                <span data-testid="text-wallet-address">{mockUser.walletAddress}</span>
              </div>
            </div>
          </div>
          
          <Card className="bg-card/80 backdrop-blur-sm p-4 border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Degen Level</span>
              <SaucePointsBadge points={mockUser.saucePoints} />
            </div>
          </Card>
        </div>
      </div>

      {/* Tickets Section */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active" data-testid="tab-active-tickets">Active Tickets</TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past-tickets">Past Tickets</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4 mt-4">
            {mockActiveTickets.length > 0 ? (
              mockActiveTickets.map((ticket, index) => (
                <TicketCard
                  key={index}
                  {...ticket}
                  onClaim={() => console.log("Claim ticket")}
                />
              ))
            ) : (
              <Card className="p-8 text-center">
                <User className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No active tickets</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Buy tickets to join raffles! 🎫
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4 mt-4">
            {mockPastTickets.map((ticket, index) => (
              <TicketCard
                key={index}
                {...ticket}
                onClaim={() => console.log("Claim ticket")}
              />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

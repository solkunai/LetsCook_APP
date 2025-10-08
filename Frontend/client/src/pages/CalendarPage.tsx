import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Calendar as CalendarIcon } from "lucide-react";

// todo: remove mock functionality
const rafflesByDate: Record<string, Array<{ tokenName: string; status: string; ticketPrice: string }>> = {
  "2025-02-15": [
    { tokenName: "Spicy Token", status: "open", ticketPrice: "0.1" },
  ],
  "2025-02-20": [
    { tokenName: "Chef Coin", status: "open", ticketPrice: "0.2" },
  ],
  "2025-02-10": [
    { tokenName: "Hot Sauce", status: "closed", ticketPrice: "0.15" },
  ],
};

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const selectedDateStr = selectedDate?.toISOString().split('T')[0];
  const rafflesOnDate = selectedDateStr ? (rafflesByDate[selectedDateStr] || []) : [];

  const statusColors: Record<string, string> = {
    open: "bg-green-500",
    closed: "bg-orange-500",
    results: "bg-blue-500",
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-card border-b border-primary/30 p-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-6 h-6 text-primary drop-shadow-[0_0_8px_hsl(var(--primary))]" />
            <h1 className="text-2xl font-heading font-bold uppercase tracking-tight">Raffle Calendar</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1 font-medium">Find your next moon mission 🚀</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Calendar */}
        <Card className="p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md"
          />
        </Card>

        {/* Raffles on Selected Date */}
        {selectedDate && (
          <div>
            <h2 className="font-heading font-semibold text-lg mb-3" data-testid="text-selected-date">
              Raffles on {selectedDate.toLocaleDateString()}
            </h2>
            
            {rafflesOnDate.length > 0 ? (
              <div className="space-y-3">
                {rafflesOnDate.map((raffle, index) => (
                  <Card key={index} className="p-4 hover-elevate">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Flame className="w-8 h-8 text-primary" />
                        <div>
                          <h3 className="font-semibold" data-testid={`text-raffle-name-${index}`}>{raffle.tokenName}</h3>
                          <p className="text-sm text-muted-foreground">{raffle.ticketPrice} SOL</p>
                        </div>
                      </div>
                      <Badge className={`${statusColors[raffle.status]} text-white`}>
                        {raffle.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No raffles scheduled for this date</p>
                <p className="text-sm text-muted-foreground mt-1">Check back later! 🔥</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

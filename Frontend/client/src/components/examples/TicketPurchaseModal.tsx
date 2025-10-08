import { useState } from 'react';
import TicketPurchaseModal from '../TicketPurchaseModal';
import { Button } from '@/components/ui/button';

export default function TicketPurchaseModalExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setIsOpen(true)}>Open Purchase Modal</Button>
      <TicketPurchaseModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        raffle={{
          tokenName: "Spicy Token",
          tokenSymbol: "SPCY",
          ticketPrice: "0.1",
          totalTickets: 1000,
          soldTickets: 750,
        }}
        onPurchase={(quantity) => console.log(`Purchased ${quantity} tickets`)}
      />
    </div>
  );
}

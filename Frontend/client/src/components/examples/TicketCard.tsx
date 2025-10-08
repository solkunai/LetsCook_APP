import TicketCard from '../TicketCard';

export default function TicketCardExample() {
  return (
    <div className="p-4 max-w-sm space-y-4">
      <TicketCard
        raffleTokenName="Spicy Token"
        raffleTokenSymbol="SPCY"
        quantity={5}
        ticketPrice="0.1"
        isWinner={true}
        claimed={false}
        purchaseDate="2025-01-15"
        onClaim={() => console.log('Claim clicked')}
      />
      <TicketCard
        raffleTokenName="Chef Coin"
        raffleTokenSymbol="CHEF"
        quantity={3}
        ticketPrice="0.2"
        isWinner={false}
        claimed={false}
        purchaseDate="2025-01-10"
        onClaim={() => console.log('Claim refund clicked')}
      />
    </div>
  );
}

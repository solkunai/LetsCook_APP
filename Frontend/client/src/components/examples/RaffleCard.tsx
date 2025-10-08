import RaffleCard from '../RaffleCard';

export default function RaffleCardExample() {
  return (
    <div className="p-4 max-w-sm">
      <RaffleCard
        id="1"
        tokenName="Spicy Token"
        tokenSymbol="SPCY"
        ticketPrice="0.1"
        totalTickets={1000}
        soldTickets={750}
        status="open"
        launchDate="2025-02-15"
        onBuyTickets={() => console.log('Buy tickets clicked')}
      />
    </div>
  );
}

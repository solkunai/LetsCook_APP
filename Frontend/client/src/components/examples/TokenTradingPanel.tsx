import TokenTradingPanel from '../TokenTradingPanel';

export default function TokenTradingPanelExample() {
  return (
    <div className="p-4 max-w-lg">
      <TokenTradingPanel
        tokenSymbol="SPCY"
        currentPrice={1.05}
        priceChange24h={12.5}
        liquidityPool={{ token: 50000, sol: 52500 }}
        userBalance={{ sol: 10.5, token: 250 }}
      />
    </div>
  );
}

/**
 * Market Cap Chart Component
 * 
 * Displays market cap growth over time
 */

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, TrendingDown, Loader2, DollarSign } from 'lucide-react';
import { marketCapService, MarketCapData } from '@/lib/marketCapService';

interface MarketCapChartProps {
  tokenMint: string;
  totalSupply: number;
  timeframe?: '1h' | '24h' | '7d' | '30d';
  className?: string;
  showUSD?: boolean;
}

const MarketCapChart: React.FC<MarketCapChartProps> = ({
  tokenMint,
  totalSupply,
  timeframe = '24h',
  className = '',
  showUSD = true,
}) => {
  const [marketCapData, setMarketCapData] = useState<MarketCapData | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Get current market cap
        const current = await marketCapService.getMarketCap(tokenMint, totalSupply);
        setMarketCapData(current);

        // Get history
        const history = await marketCapService.getMarketCapHistory(tokenMint, timeframe);
        setHistoryData(history.map(point => ({
          time: new Date(point.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          timestamp: point.timestamp,
          marketCap: point.marketCap,
          marketCapUSD: point.marketCapUSD,
          price: point.price,
          priceUSD: point.priceUSD,
          circulatingSupply: point.circulatingSupply,
        })));
      } catch (error) {
        console.error('Error fetching market cap data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [tokenMint, totalSupply, timeframe]);

  // Calculate market cap change
  const marketCapChange = historyData.length > 1
    ? ((historyData[historyData.length - 1].marketCap - historyData[0].marketCap) / historyData[0].marketCap) * 100
    : 0;

  const formatMarketCap = (value: number, inUSD: boolean = false) => {
    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(2)}B ${inUSD ? 'USD' : 'SOL'}`;
    } else if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M ${inUSD ? 'USD' : 'SOL'}`;
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)}K ${inUSD ? 'USD' : 'SOL'}`;
    }
    return `${value.toFixed(2)} ${inUSD ? 'USD' : 'SOL'}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const marketCap = data?.marketCap ?? 0;
      const marketCapUSD = data?.marketCapUSD ?? 0;
      const price = data?.price ?? 0;
      const circulatingSupply = data?.circulatingSupply;
      
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-sm text-slate-400 mb-2">
            {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '—'}
          </p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Market Cap:</span>
              <span className="text-white font-semibold">
                {formatMarketCap(marketCap, false)}
              </span>
            </div>
            {showUSD && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Market Cap (USD):</span>
                <span className="text-green-400 font-semibold">
                  {formatMarketCap(marketCapUSD, true)}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Price:</span>
              <span className="text-white">
                {price > 0 ? `${price.toFixed(8)} SOL` : '—'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Circulating Supply:</span>
              <span className="text-white">
                {(circulatingSupply !== undefined && circulatingSupply !== null)
                  ? circulatingSupply.toLocaleString()
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (historyData.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <p className="text-slate-400">No market cap data available</p>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900 rounded-2xl border border-slate-800 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-2 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-yellow-400" />
            Market Cap ({timeframe})
          </h3>
          <div className="flex items-center space-x-4">
            <div className="text-2xl font-bold text-white">
              {marketCapData ? formatMarketCap(marketCapData.marketCap, false) : 'N/A'}
            </div>
            {showUSD && marketCapData && (
              <div className="text-lg text-green-400">
                ${formatMarketCap(marketCapData.marketCapUSD, true).replace(' USD', '')}
              </div>
            )}
            <div className={`flex items-center text-sm ${
              marketCapChange >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {marketCapChange >= 0 ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              {Math.abs(marketCapChange).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={historyData}>
            <defs>
              <linearGradient id="marketCapGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              stroke="#9ca3af"
              fontSize={12}
              tick={{ fill: '#9ca3af' }}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tick={{ fill: '#9ca3af' }}
              tickFormatter={(value) => formatMarketCap(value, false)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={showUSD ? "marketCapUSD" : "marketCap"}
              stroke="#f59e0b"
              fill="url(#marketCapGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      {marketCapData && (
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700">
          <div className="text-center">
            <div className="text-xs text-slate-400 mb-1">Circulating Supply</div>
            <div className="text-sm font-semibold text-white">
              {(marketCapData.circulatingSupply !== undefined && marketCapData.circulatingSupply !== null)
                ? marketCapData.circulatingSupply.toLocaleString()
                : '—'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400 mb-1">Total Supply</div>
            <div className="text-sm font-semibold text-white">
              {(marketCapData.totalSupply !== undefined && marketCapData.totalSupply !== null)
                ? marketCapData.totalSupply.toLocaleString()
                : '—'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400 mb-1">Fully Diluted MC</div>
            <div className="text-sm font-semibold text-yellow-400">
              {(marketCapData.fullyDilutedMarketCap !== undefined && marketCapData.fullyDilutedMarketCap !== null)
                ? formatMarketCap(marketCapData.fullyDilutedMarketCap, false)
                : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketCapChart;


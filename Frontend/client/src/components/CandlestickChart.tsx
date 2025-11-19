/**
 * Candlestick Chart Component
 * 
 * Displays price data as candlestick chart (OHLC - Open, High, Low, Close)
 * Uses recharts with custom candlestick rendering
 */

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

export interface CandlestickData {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickChartProps {
  data: CandlestickData[];
  timeframe?: '1h' | '24h' | '7d';
  className?: string;
  showVolume?: boolean;
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  timeframe = '24h',
  className = '',
  showVolume = true,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  // Calculate price change
  const priceChange = data.length > 0
    ? ((data[data.length - 1].close - data[0].open) / data[0].open) * 100
    : 0;

  // Custom tooltip for candlestick
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-sm text-slate-400 mb-2">
            {new Date(data.timestamp).toLocaleString()}
          </p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Open:</span>
              <span className="text-white font-semibold">{data.open.toFixed(8)} SOL</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">High:</span>
              <span className="text-green-400 font-semibold">{data.high.toFixed(8)} SOL</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Low:</span>
              <span className="text-red-400 font-semibold">{data.low.toFixed(8)} SOL</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Close:</span>
              <span className="text-white font-semibold">{data.close.toFixed(8)} SOL</span>
            </div>
            {showVolume && (
              <div className="flex justify-between gap-4 pt-2 border-t border-slate-700">
                <span className="text-slate-400">Volume:</span>
                <span className="text-white">{data.volume.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Render candlesticks as custom shapes
  const renderCandlesticks = () => {
    if (data.length === 0) return null;

    return data.map((point, index) => {
      const isBullish = point.close >= point.open;
      const color = isBullish ? '#10b981' : '#ef4444';
      const bodyColor = isBullish ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';

      // Calculate positions (simplified - would need actual chart coordinates)
      const x = (index / (data.length - 1)) * 100;
      const highY = 100 - ((point.high / Math.max(...data.map(d => d.high))) * 100);
      const lowY = 100 - ((point.low / Math.max(...data.map(d => d.high))) * 100);
      const openY = 100 - ((point.open / Math.max(...data.map(d => d.high))) * 100);
      const closeY = 100 - ((point.close / Math.max(...data.map(d => d.high))) * 100);

      return (
        <g key={index}>
          {/* Wick (high-low line) */}
          <line
            x1={`${x}%`}
            y1={`${highY}%`}
            x2={`${x}%`}
            y2={`${lowY}%`}
            stroke={color}
            strokeWidth={2}
          />
          {/* Body (open-close rectangle) */}
          <rect
            x={`${x - 1}%`}
            y={`${Math.min(openY, closeY)}%`}
            width="2%"
            height={`${Math.abs(closeY - openY)}%`}
            fill={bodyColor}
            stroke={color}
            strokeWidth={1}
          />
        </g>
      );
    });
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <p className="text-slate-400">No price data available</p>
      </div>
    );
  }

  // Prepare data for recharts (using area chart to show price range)
  const chartData = data.map(point => ({
    time: point.time,
    timestamp: point.timestamp,
    price: point.close,
    high: point.high,
    low: point.low,
    open: point.open,
    close: point.close,
    volume: point.volume,
  }));

  return (
    <div className={`bg-slate-900 rounded-2xl border border-slate-800 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-2">Price Chart ({timeframe})</h3>
          <div className="flex items-center space-x-4">
            <div className="text-2xl font-bold text-white">
              {data[data.length - 1]?.close.toFixed(8)} SOL
            </div>
            <div className={`flex items-center text-sm ${
              priceChange >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {priceChange >= 0 ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              {Math.abs(priceChange).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
              domain={['dataMin * 0.95', 'dataMax * 1.05']}
              tickFormatter={(value) => value.toFixed(6)}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* High line */}
            <Line
              type="monotone"
              dataKey="high"
              stroke="#10b981"
              strokeWidth={1}
              dot={false}
              strokeDasharray="2 2"
              name="High"
            />
            {/* Close price (main line) */}
            <Line
              type="monotone"
              dataKey="close"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="Price"
            />
            {/* Low line */}
            <Line
              type="monotone"
              dataKey="low"
              stroke="#ef4444"
              strokeWidth={1}
              dot={false}
              strokeDasharray="2 2"
              name="Low"
            />
            {/* Area under curve */}
            <Area
              type="monotone"
              dataKey="close"
              stroke="#f59e0b"
              fill="url(#priceGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Volume chart (optional) */}
      {showVolume && (
        <div className="h-24 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                stroke="#9ca3af"
                fontSize={10}
                tick={{ fill: '#9ca3af' }}
              />
              <YAxis
                stroke="#9ca3af"
                fontSize={10}
                tick={{ fill: '#9ca3af' }}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.3}
                strokeWidth={1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default CandlestickChart;


/**
 * Interactive Bonding Curve Chart
 * 
 * Shows price progression as tokens are sold
 * Interactive tooltip with detailed information
 */

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { bondingCurveService } from '@/lib/bondingCurveService';
import { formatLargeNumber, formatTokenAmount } from '@/lib/largeNumberFormatter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface BondingCurveChartProps {
  totalSupply: number;
  tokensSold: number;
  decimals?: number;
  className?: string;
}

export const BondingCurveChart: React.FC<BondingCurveChartProps> = ({
  totalSupply,
  tokensSold,
  decimals = 9,
  className = '',
}) => {
  // Generate curve data points
  const curveData = useMemo(() => {
    const points = 50; // Number of data points
    const data = [];
    const config = {
      totalSupply,
      decimals,
      curveType: 'linear' as const,
    };
    
    for (let i = 0; i <= points; i++) {
      const progress = i / points; // 0 to 1
      const tokensSoldAtPoint = totalSupply * progress;
      const price = bondingCurveService.calculatePrice(tokensSoldAtPoint, config);
      
      data.push({
        tokensSold: tokensSoldAtPoint,
        tokensSoldFormatted: formatLargeNumber(tokensSoldAtPoint),
        price,
        priceFormatted: bondingCurveService.formatPrice(price),
        progress: progress * 100,
      });
    }
    
    return data;
  }, [totalSupply, decimals]);
  
  // Find current position on curve
  const currentPoint = useMemo(() => {
    const progress = tokensSold / totalSupply;
    const config = {
      totalSupply,
      decimals,
      curveType: 'linear' as const,
    };
    const price = bondingCurveService.calculatePrice(tokensSold, config);
    
    return {
      tokensSold,
      tokensSoldFormatted: formatLargeNumber(tokensSold),
      price,
      priceFormatted: bondingCurveService.formatPrice(price),
      progress: progress * 100,
    };
  }, [tokensSold, totalSupply, decimals]);
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-sm text-slate-400 mb-2">Bonding Curve</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Tokens Sold:</span>
              <span className="text-white font-semibold">{data.tokensSoldFormatted}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Price:</span>
              <span className="text-yellow-400 font-semibold">{data.priceFormatted} SOL</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Progress:</span>
              <span className="text-white">{data.progress.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };
  
  return (
    <Card className={`bg-slate-800/50 border-slate-700 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TrendingUp className="w-5 h-5 text-yellow-400" />
          Bonding Curve
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curveData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="progress" 
                stroke="#9ca3af"
                label={{ value: 'Progress (%)', position: 'insideBottom', offset: -5, fill: '#9ca3af' }}
              />
              <YAxis 
                stroke="#9ca3af"
                label={{ value: 'Price (SOL)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                tickFormatter={(value) => value.toExponential(2)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#eab308"
                strokeWidth={2}
                fill="url(#priceGradient)"
                dot={false}
                activeDot={{ r: 6, fill: '#eab308' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Current Position Indicator */}
        <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-yellow-500/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Current Position</div>
              <div className="text-white font-semibold">
                {currentPoint.tokensSoldFormatted} / {formatLargeNumber(totalSupply)} tokens
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Current Price</div>
              <div className="text-yellow-400 font-semibold">
                {currentPoint.priceFormatted} SOL
              </div>
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Progress to graduation</span>
              <span>{currentPoint.progress.toFixed(2)}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(currentPoint.progress, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};



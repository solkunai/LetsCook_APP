/**
 * Bonding Curve Progress Component - Redesigned
 * 
 * Shows bonding curve progress with real data, no placeholders
 * Matches the clean design from the reference image
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Zap, Target, DollarSign, Loader2, Rocket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatLargeNumber, formatTokenAmount } from '@/lib/largeNumberFormatter';
import { bondingCurveService } from '@/lib/bondingCurveService';

export interface BondingCurveProgressProps {
  tokenMint: string;
  totalSupply: number;
  currentPrice: number;
  initialPrice: number;
  solReserves: number;
  tokenReserves: number;
  className?: string;
  refreshTrigger?: number;
}

export const BondingCurveProgress: React.FC<BondingCurveProgressProps> = ({
  tokenMint,
  totalSupply,
  currentPrice,
  initialPrice,
  solReserves,
  tokenReserves,
  className = '',
  refreshTrigger = 0
}) => {
  const [progress, setProgress] = useState(0);
  const [priceIncrease, setPriceIncrease] = useState(0);
  const [tokensSold, setTokensSold] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [livePrice, setLivePrice] = useState(0);
  const [livePriceUSD, setLivePriceUSD] = useState(0);
  const [initialPriceUSD, setInitialPriceUSD] = useState(0);
  const [marketCapUSD, setMarketCapUSD] = useState(0);
  const [priceMultiplier, setPriceMultiplier] = useState(0);
  const [solPriceUSD, setSolPriceUSD] = useState(150);
  const [liveTokensSold, setLiveTokensSold] = useState(0);
  const [liveSolReserves, setLiveSolReserves] = useState(solReserves || 0);
  const [liveTokenReserves, setLiveTokenReserves] = useState(tokenReserves || 0);
  
  const safeTotalSupply = Math.max(totalSupply || 0, 1);
  const GRADUATION_GOAL_SOL = 30;
  const safeInitialPrice = Math.max(initialPrice || 0.000001, 0.000001);
  const safeSolReserves = Math.max(solReserves || 0, 0);
  const safeTokenReserves = Math.max(tokenReserves || 0, 0);

  useEffect(() => {
    const fetchLiveData = async () => {
      if (!tokenMint) return;
      
      setIsLoading(true);
      try {
        // Get SOL price in USD
        try {
          const { pythPriceService } = await import('@/lib/pythPriceService');
          const solPrice = await pythPriceService.getSOLPrice();
          if (solPrice && solPrice > 0) {
            setSolPriceUSD(solPrice);
          }
        } catch (solPriceError) {
          console.warn('⚠️ Could not fetch SOL price, using fallback $150:', solPriceError);
        }
        
        // Try Supabase first
        let supabaseData: any = null;
        try {
          const { getSupabaseClient } = await import('@/lib/supabase');
          const supabase = getSupabaseClient();
          if (supabase) {
            const { data, error } = await supabase
              .from('bonding_curve_progress')
              .select('*')
              .eq('token_mint', tokenMint)
              .single();
            
            if (!error && data) {
              supabaseData = data;
              const dataAge = Date.now() - new Date(data.last_updated).getTime();
              if (dataAge < 5 * 60 * 1000) {
                setLiveSolReserves(parseFloat(data.sol_reserves || 0));
                setLiveTokenReserves(parseFloat(data.token_reserves || 0));
                setLiveTokensSold(parseFloat(data.tokens_sold || 0));
                setTokensSold(parseFloat(data.tokens_sold || 0));
                
                const solCollected = parseFloat(data.sol_collected || 0);
                const progressToGoal = Math.min(100, (solCollected / GRADUATION_GOAL_SOL) * 100);
                setProgress(progressToGoal);
              }
            }
          }
        } catch (supabaseError) {
          console.warn('⚠️ Supabase fetch failed:', supabaseError);
        }
        
        // Fetch from blockchain
        try {
          const { marketDataService } = await import('@/lib/marketDataService');
          const ammData = await marketDataService.getAMMAccountData(tokenMint);
          
          if (ammData) {
            const realSolReserves = ammData.solReserves || 0;
            const realTokenReserves = ammData.tokenReserves || 0;
            const poolPrice = ammData.price || 0;
            
            setLiveSolReserves(realSolReserves);
            setLiveTokenReserves(realTokenReserves);
            
            // Calculate tokens sold
            let actualTokensSold = 0;
            if (realTokenReserves > 0) {
              actualTokensSold = Math.max(0, safeTotalSupply - realTokenReserves);
            } else {
              actualTokensSold = supabaseData ? parseFloat(supabaseData.tokens_sold || 0) : 0;
            }
            
            setLiveTokensSold(actualTokensSold);
            setTokensSold(actualTokensSold);
            
            // Calculate price
            const bondingCurveConfig = {
              totalSupply: safeTotalSupply,
              curveType: 'linear' as const,
            };
            
            const calculatedPrice = actualTokensSold === 0 
              ? safeInitialPrice
              : bondingCurveService.calculatePrice(actualTokensSold, bondingCurveConfig);
            
            const finalPrice = (poolPrice > 0 && actualTokensSold > 0) 
              ? poolPrice 
              : (calculatedPrice > safeInitialPrice ? calculatedPrice : safeInitialPrice);
            
            setLivePrice(finalPrice);
            setLivePriceUSD(finalPrice * solPriceUSD);
            setInitialPriceUSD(safeInitialPrice * solPriceUSD);
            setMarketCapUSD(finalPrice * solPriceUSD * safeTotalSupply);
            
            // Calculate price multiplier
            if (safeInitialPrice > 0 && finalPrice >= safeInitialPrice) {
              const multiplier = finalPrice / safeInitialPrice;
              setPriceMultiplier(multiplier);
              const increase = ((finalPrice - safeInitialPrice) / safeInitialPrice) * 100;
              setPriceIncrease(increase);
            } else {
              setPriceMultiplier(1);
              setPriceIncrease(0);
            }
            
            // Calculate progress
            const solCollected = realSolReserves;
            const progressToGoal = Math.min(100, (solCollected / GRADUATION_GOAL_SOL) * 100);
            setProgress(Math.max(0, progressToGoal));
          }
        } catch (error) {
          console.error('❌ Error fetching blockchain data:', error);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('❌ Error fetching live data:', error);
        setIsLoading(false);
      }
    };

    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30000);
    return () => clearInterval(interval);
  }, [tokenMint, safeTotalSupply, safeInitialPrice, safeSolReserves, safeTokenReserves, refreshTrigger]);

  const solCollected = liveSolReserves > 0 ? liveSolReserves : safeSolReserves;
  const remainingToGoal = Math.max(0, GRADUATION_GOAL_SOL - solCollected);
  const displayPrice = livePrice > 0 ? livePrice : currentPrice;
  const displayPriceUSD = livePriceUSD > 0 ? livePriceUSD : (displayPrice * solPriceUSD);
  const displayMarketCap = marketCapUSD > 0 ? marketCapUSD : (displayPriceUSD * safeTotalSupply);
  const displayMultiplier = priceMultiplier > 0 ? priceMultiplier : (displayPrice / safeInitialPrice);
  const displayTokensSold = liveTokensSold > 0 ? liveTokensSold : tokensSold;

  return (
    <Card className={`bg-gradient-to-br from-yellow-500/10 via-slate-800/50 to-slate-800/50 border-yellow-500/20 ${className}`}>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">⚡ Bonding Curve Progress</h3>
            </div>
            <div className="flex items-center space-x-2 text-yellow-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">
                {priceIncrease > 0 ? `+${priceIncrease.toFixed(2)}%` : '0.00%'} Price Increase
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300 font-medium">Progress to Graduation Goal</span>
            </div>
            <div className="relative h-6 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
              <motion.div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white drop-shadow-lg z-10">
                  {progress >= 100 ? '🎉' : <Rocket className="w-3 h-3 inline" />} {progress.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                {isLoading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  `${solCollected.toFixed(2)} / ${GRADUATION_GOAL_SOL} SOL collected`
                )}
              </span>
              <span className="text-yellow-400">
                {isLoading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  remainingToGoal > 0 ? `${remainingToGoal.toFixed(2)} SOL to goal` : '🎉 Goal Reached!'
                )}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
              <div className="text-slate-400 text-xs mb-1">Tokens Sold</div>
              <div className="text-white font-semibold text-sm">
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  `${formatLargeNumber(displayTokensSold)} / ${formatLargeNumber(safeTotalSupply)}`
                )}
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
              <div className="text-slate-400 text-xs mb-1">SOL in Pool</div>
              <div className="text-white font-semibold text-sm">
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  `${solCollected.toFixed(4)} SOL`
                )}
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
              <div className="text-slate-400 text-xs mb-1">Tokens in Pool</div>
              <div className="text-white font-semibold text-sm">
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  formatLargeNumber(liveTokenReserves || safeTokenReserves)
                )}
              </div>
            </div>
          </div>

          {/* Key Metrics - 4 Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Current Price */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <div className="text-slate-400 text-xs mb-2 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Current Price
              </div>
              <div className="text-yellow-400 font-bold text-lg">
                ${displayPriceUSD.toFixed(8)}
              </div>
              <div className="text-slate-400 text-xs mt-1">
                ({bondingCurveService.formatPrice(displayPrice)} SOL)
              </div>
            </div>

            {/* Initial Price */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <div className="text-slate-400 text-xs mb-2 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Initial Price
              </div>
              <div className="text-white font-bold text-lg">
                ${initialPriceUSD.toFixed(6)}
              </div>
              <div className="text-slate-400 text-xs mt-1">
                ({bondingCurveService.formatPrice(safeInitialPrice)} SOL)
              </div>
            </div>

            {/* Market Cap */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <div className="text-slate-400 text-xs mb-2 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Market Cap
              </div>
              <div className="text-blue-400 font-bold text-lg">
                ${displayMarketCap >= 1e12 
                  ? `${(displayMarketCap / 1e12).toFixed(2)}T`
                  : displayMarketCap >= 1e9
                  ? `${(displayMarketCap / 1e9).toFixed(2)}B`
                  : displayMarketCap >= 1e6
                  ? `${(displayMarketCap / 1e6).toFixed(2)}M`
                  : displayMarketCap.toFixed(2)}
              </div>
              <div className="text-slate-400 text-xs mt-1">
                (Fully Diluted)
              </div>
            </div>

            {/* Price Multiplier */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <div className="text-slate-400 text-xs mb-2">Price Multiplier</div>
              <div className="text-yellow-400 font-bold text-lg">
                {displayMultiplier.toFixed(2)}x
              </div>
              <div className="text-slate-400 text-xs mt-1">
                +{priceIncrease.toFixed(2)}% increase
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

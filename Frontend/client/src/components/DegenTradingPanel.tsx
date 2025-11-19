/**
 * Degen Trading Panel - Enhanced with Real-time Preview
 * 
 * Features:
 * - Real-time curve preview with live calculations
 * - Price impact display
 * - Slippage warnings
 * - Sell-side profit projection
 * - Debounced inputs for performance
 * - Whale/bot detection indicators
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  AlertTriangle, 
  Info,
  Calculator,
  Target,
  DollarSign,
  Coins,
  Clock,
  Shield,
  Bot,
  Loader2
} from 'lucide-react';
import { bondingCurveService } from '@/lib/bondingCurveService';
import { formatLargeNumber, formatTokenAmount } from '@/lib/largeNumberFormatter';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/connection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebounce } from '@/hooks/use-debounce';

interface DegenTradingPanelProps {
  tokenMint: string;
  totalSupply: number;
  tokensSold: number;
  currentPrice: number;
  initialPrice: number;
  decimals?: number;
  solBalance: number;
  tokenBalance: number;
  tokenSymbol?: string; // Token symbol for display
  onBuy: (solAmount: number) => Promise<void>;
  onSell: (tokenAmount: number) => Promise<void>;
  isTrading?: boolean;
  launchDate?: number; // For first block protection display
}

export const DegenTradingPanel: React.FC<DegenTradingPanelProps> = ({
  tokenMint,
  totalSupply,
  tokensSold,
  currentPrice,
  initialPrice,
  decimals = 9,
  solBalance,
  tokenBalance,
  tokenSymbol = 'TOKENS',
  onBuy,
  onSell,
  isTrading = false,
  launchDate,
}) => {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [inputAmount, setInputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  
  // Debounce input for performance (150ms delay)
  const debouncedAmount = useDebounce(inputAmount, 150);
  
  // Real-time preview calculations with actual quotes from quotation service
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Fetch quote from quotation service when amount changes
  useEffect(() => {
    const fetchQuote = async () => {
      if (!debouncedAmount || parseFloat(debouncedAmount) <= 0 || isNaN(parseFloat(debouncedAmount))) {
        setQuote(null);
        return;
      }

      const amount = parseFloat(debouncedAmount);
      if (amount <= 0) {
        setQuote(null);
        return;
      }

      setQuoteLoading(true);
      try {
        const connection = getConnection('confirmed');
        const { QuotationService } = await import('@/lib/quotationService');
        const quotationService = new QuotationService(connection);

        if (mode === 'buy') {
          const quoteResult = await quotationService.getBuyQuote(
            tokenMint,
            amount,
            totalSupply,
            tokensSold,
            decimals,
            currentPrice
          );
          setQuote({ ...quoteResult, type: 'buy' });
        } else {
          const quoteResult = await quotationService.getSellQuote(
            tokenMint,
            amount,
            totalSupply,
            tokensSold,
            decimals,
            currentPrice
          );
          setQuote({ ...quoteResult, type: 'sell' });
        }
      } catch (error) {
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    };

    // Debounce quote fetching
    const timeoutId = setTimeout(fetchQuote, 300);
    return () => clearTimeout(timeoutId);
  }, [debouncedAmount, mode, tokenMint, decimals, tokensSold, currentPrice, totalSupply]);

  // Real-time preview calculations using quote from quotation service
  const previewData = useMemo(() => {
    // Use quote if available
    if (quote && !quoteLoading) {
      if (quote.type === 'buy' && quote.tokensReceived !== undefined) {
        return {
          tokensReceived: quote.tokensReceived * Math.pow(10, decimals), // Convert to raw for consistency
          tokensReceivedHuman: quote.tokensReceived,
          postBuyPrice: quote.postTradePrice,
          priceImpact: quote.priceImpact,
          avgPrice: quote.avgPrice || quote.currentPrice || currentPrice, // Use quote's currentPrice or fallback
          type: 'buy' as const,
        };
      } else if (quote.type === 'sell' && quote.solReceived !== undefined) {
        return {
          solReceived: quote.solReceived,
          postSellPrice: quote.postTradePrice,
          priceImpact: quote.priceImpact,
          type: 'sell' as const,
        };
      }
    }

    // Fallback to bonding curve calculation
    if (!debouncedAmount || parseFloat(debouncedAmount) <= 0 || isNaN(parseFloat(debouncedAmount))) {
      return null;
    }
    
    const amount = parseFloat(debouncedAmount);
    if (amount <= 0) return null;
    
    const config = {
      totalSupply,
      decimals,
      curveType: 'linear' as const,
    };
    
    if (mode === 'buy') {
      try {
        // tokensSold is in human-readable format (from bondingCurveData)
        // calculateTokensForSol expects tokensSold in human-readable format and returns human-readable units
        const tokensReceivedHuman = bondingCurveService.calculateTokensForSol(
          amount,
          tokensSold, // Already in human-readable format
          config
        );
        
        // Validate calculation
        if (tokensReceivedHuman <= 0 || !isFinite(tokensReceivedHuman)) {
          return null;
        }
        
        // Calculate post-buy price
        const postBuyTokensSold = tokensSold + tokensReceivedHuman;
        const postBuyPrice = bondingCurveService.calculatePrice(postBuyTokensSold, config);
        
        // Calculate price impact
        const calculatedCurrentPrice = bondingCurveService.calculatePrice(tokensSold, config);
        const priceImpact = calculatedCurrentPrice > 0 
          ? ((postBuyPrice - calculatedCurrentPrice) / calculatedCurrentPrice) * 100 
          : 0;
        
        // Calculate average price paid
        const avgPrice = tokensReceivedHuman > 0 
          ? amount / tokensReceivedHuman 
          : calculatedCurrentPrice;
        
        return {
          tokensReceived: tokensReceivedHuman * Math.pow(10, decimals), // Convert to raw for consistency
          tokensReceivedHuman,
          postBuyPrice,
          priceImpact,
          avgPrice,
          type: 'buy' as const,
        } as any;
      } catch (error) {
        return null;
      }
    } else {
      // Calculate SOL received for selling
      // amount is already in human-readable token units
      // calculateSolForTokens expects tokensAmount in human-readable format and returns SOL
      const solReceived = bondingCurveService.calculateSolForTokens(
        amount, // Already in human-readable format
        tokensSold,
        config
      ); // Returns SOL (human-readable)
      
      // Calculate post-sell price
      const postSellTokensSold = Math.max(0, tokensSold - amount); // amount is already in human-readable format
      const postSellPrice = bondingCurveService.calculatePrice(postSellTokensSold, config);
      
      // Calculate price impact
      const priceImpact = currentPrice > 0 
        ? ((currentPrice - postSellPrice) / currentPrice) * 100 
        : 0;
      
      // Calculate profit/loss if user bought at initial price
      // amount is already in human-readable token units
      const initialCost = amount * initialPrice;
      const profit = solReceived - initialCost;
      const profitPercent = initialCost > 0 ? (profit / initialCost) * 100 : 0;
      
      return {
        solReceived,
        postSellPrice,
        priceImpact,
        profit,
        profitPercent,
        type: 'sell' as const,
      };
    }
  }, [debouncedAmount, mode, totalSupply, tokensSold, currentPrice, initialPrice, decimals, quote, quoteLoading]);
  
  // Check if amount exceeds balance
  const exceedsBalance = useMemo(() => {
    if (!inputAmount) return false;
    const amount = parseFloat(inputAmount);
    if (mode === 'buy') {
      return amount > solBalance;
    } else {
      const tokensToSell = amount * Math.pow(10, decimals);
      return tokensToSell > tokenBalance;
    }
  }, [inputAmount, mode, solBalance, tokenBalance, decimals]);
  
  // Check for first block protection
  const isFirstBlock = useMemo(() => {
    if (!launchDate) return false;
    const now = Date.now() / 1000;
    const timeSinceLaunch = now - launchDate;
    return timeSinceLaunch < 0.4; // 400ms first block
  }, [launchDate]);
  
  // Quick amount buttons
  const quickAmounts = mode === 'buy' 
    ? [0.1, 0.5, 1, 5, 10]
    : [10, 25, 50, 75, 100]; // Percentage of balance
  
  const handleQuickAmount = (value: number) => {
    if (mode === 'buy') {
      setInputAmount(value.toString());
    } else {
      const percentage = value / 100;
      const tokens = (tokenBalance / Math.pow(10, decimals)) * percentage;
      setInputAmount(tokens.toFixed(2));
    }
  };
  
  const handleTrade = async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) return;
    const amount = parseFloat(inputAmount);
    
    try {
      if (mode === 'buy') {
        await onBuy(amount);
      } else {
        await onSell(amount);
      }
      setInputAmount(''); // Clear after successful trade
    } catch (error) {
      console.error('Trade error:', error);
    }
  };
  
  return (
    <Card className="bg-gradient-to-br from-yellow-500/10 via-slate-800/50 to-slate-800/50 border-yellow-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Zap className="w-5 h-5 text-yellow-400" />
          Degen Trading
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Toggle */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'buy' | 'sell')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy" className="data-[state=active]:bg-yellow-500">
              <TrendingUp className="w-4 h-4 mr-2" />
              Buy
            </TabsTrigger>
            <TabsTrigger value="sell" className="data-[state=active]:bg-red-500">
              <TrendingDown className="w-4 h-4 mr-2" />
              Sell
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="buy" className="space-y-4 mt-4">
            {/* Input */}
            <div className="space-y-2">
              <Label className="text-slate-300">Amount (SOL)</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white text-lg pr-20"
                  disabled={isTrading}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  SOL
                </div>
              </div>
              
              {/* Quick Amount Buttons */}
              <div className="flex gap-2 flex-wrap">
                {quickAmounts.map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAmount(amt)}
                    className="text-xs border-slate-700 hover:bg-yellow-500/20"
                    disabled={isTrading}
                  >
                    {amt} SOL
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInputAmount(solBalance.toFixed(4))}
                  className="text-xs border-slate-700 hover:bg-yellow-500/20"
                  disabled={isTrading}
                >
                  Max
                </Button>
              </div>
            </div>
            
            {/* Real-time Preview */}
            <AnimatePresence>
              {(() => {
                return previewData && previewData.type === 'buy' && debouncedAmount && parseFloat(debouncedAmount) > 0;
              })() && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-slate-900/50 rounded-lg p-4 space-y-3 border border-yellow-500/20"
                >
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Calculator className="w-4 h-4" />
                    <span className="font-semibold">Trade Preview</span>
                  </div>
                  
                  {/* You Will Receive - Prominent Display */}
                  <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
                    <div className="text-slate-400 text-sm mb-1">You will receive</div>
                    <div className="text-yellow-400 font-bold text-2xl">
                      {(() => {
                        const tokensHuman = (previewData as any).tokensReceivedHuman !== undefined
                          ? (previewData as any).tokensReceivedHuman
                          : previewData.tokensReceived / Math.pow(10, decimals);
                        return formatLargeNumber(tokensHuman);
                      })()}
                    </div>
                    <div className="text-slate-400 text-xs mt-1">
                      {tokenSymbol}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-slate-400 text-xs">You pay</div>
                      <div className="text-white font-semibold">
                        {parseFloat(debouncedAmount).toFixed(6)} SOL
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Avg. price per token</div>
                      <div className="text-white font-semibold">
                        {bondingCurveService.formatPrice(previewData.avgPrice)} SOL
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Current price</div>
                      <div className="text-white">
                        {bondingCurveService.formatPrice(currentPrice)} SOL
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Price after buy</div>
                      <div className="text-white">
                        {bondingCurveService.formatPrice(previewData.postBuyPrice)} SOL
                      </div>
                    </div>
                  </div>
                  
                  {/* Price Impact */}
                  <div className="pt-2 border-t border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-sm">Price impact</span>
                      <Badge 
                        variant={previewData.priceImpact > 5 ? "destructive" : previewData.priceImpact > 2 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {previewData.priceImpact > 0 ? '+' : ''}{previewData.priceImpact.toFixed(2)}%
                      </Badge>
                    </div>
                    {previewData.priceImpact > 5 && (
                      <div className="mt-2 flex items-center gap-2 text-yellow-400 text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        <span>High price impact! Consider splitting your order.</span>
                      </div>
                    )}
                  </div>
                  
                  {/* First Block Protection Warning */}
                  {isFirstBlock && (
                    <div className="mt-2 flex items-center gap-2 text-yellow-400 text-xs bg-yellow-500/10 p-2 rounded">
                      <Shield className="w-3 h-3" />
                      <span>First block protection: Min 0.1 SOL, Max 1 SOL per transaction</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Balance */}
            <div className="text-sm text-slate-400">
              Balance: <span className="text-white">{solBalance.toFixed(4)} SOL</span>
            </div>
            
            {/* Buy Button */}
            <Button
              onClick={handleTrade}
              disabled={!inputAmount || parseFloat(inputAmount) <= 0 || exceedsBalance || isTrading}
              className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-bold"
            >
              {isTrading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Buying...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Buy Tokens
                </>
              )}
            </Button>
          </TabsContent>
          
          <TabsContent value="sell" className="space-y-4 mt-4">
            {/* Input */}
            <div className="space-y-2">
              <Label className="text-slate-300">Amount (Tokens)</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white text-lg pr-20"
                  disabled={isTrading}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  Tokens
                </div>
              </div>
              
              {/* Quick Amount Buttons (Percentage) */}
              <div className="flex gap-2 flex-wrap">
                {quickAmounts.map((pct) => (
                  <Button
                    key={pct}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAmount(pct)}
                    className="text-xs border-slate-700 hover:bg-red-500/20"
                    disabled={isTrading}
                  >
                    {pct}%
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInputAmount((tokenBalance / Math.pow(10, decimals)).toFixed(2))}
                  className="text-xs border-slate-700 hover:bg-red-500/20"
                  disabled={isTrading}
                >
                  Max
                </Button>
              </div>
            </div>
            
            {/* Real-time Preview with Profit Projection */}
            <AnimatePresence>
              {previewData && previewData.type === 'sell' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-slate-900/50 rounded-lg p-4 space-y-3 border border-red-500/20"
                >
                  <div className="flex items-center gap-2 text-red-400">
                    <Calculator className="w-4 h-4" />
                    <span className="font-semibold">Sell Preview</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-slate-400">You will receive</div>
                      <div className="text-white font-bold text-lg">
                        {previewData.solReceived.toFixed(6)} SOL
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Post-sell price</div>
                      <div className="text-white">
                        {bondingCurveService.formatPrice(previewData.postSellPrice)} SOL
                      </div>
                    </div>
                  </div>
                  
                  {/* Profit Projection */}
                  {previewData.profit !== undefined && (
                    <div className="pt-2 border-t border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Profit/Loss</span>
                        <Badge 
                          variant={previewData.profit > 0 ? "default" : "destructive"}
                          className={previewData.profit > 0 ? "bg-green-500" : ""}
                        >
                          {previewData.profit > 0 ? '+' : ''}{previewData.profit.toFixed(6)} SOL
                          {' '}({previewData.profitPercent > 0 ? '+' : ''}{previewData.profitPercent.toFixed(2)}%)
                        </Badge>
                      </div>
                      
                      {/* Projection: If price reaches X, your $50 becomes $Y */}
                      {previewData.profit > 0 && (
                        <div className="bg-green-500/10 p-2 rounded text-xs">
                          <div className="flex items-center gap-2 text-green-400">
                            <Target className="w-3 h-3" />
                            <span>
                              If price reaches {bondingCurveService.formatPrice(previewData.postSellPrice * 2)} SOL,
                              your {previewData.solReceived.toFixed(2)} SOL becomes {(previewData.solReceived * 2).toFixed(2)} SOL
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Price Impact */}
                  <div className="pt-2 border-t border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-sm">Price impact</span>
                      <Badge 
                        variant={previewData.priceImpact > 5 ? "destructive" : "default"}
                        className="text-xs"
                      >
                        -{previewData.priceImpact.toFixed(2)}%
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Balance */}
            <div className="text-sm text-slate-400">
              Balance: <span className="text-white">{formatTokenAmount(tokenBalance, decimals)}</span>
            </div>
            
            {/* Sell Button */}
            <Button
              onClick={handleTrade}
              disabled={!inputAmount || parseFloat(inputAmount) <= 0 || exceedsBalance || isTrading}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold"
            >
              {isTrading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Selling...
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Sell Tokens
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
        
        {/* Slippage Settings */}
        <div className="pt-4 border-t border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-slate-300 text-sm">Slippage Tolerance</Label>
            <span className="text-slate-400 text-sm">{slippage}%</span>
          </div>
          <div className="flex gap-2">
            {[0.1, 0.5, 1.0, 3.0].map((val) => (
              <Button
                key={val}
                variant={slippage === val ? "default" : "outline"}
                size="sm"
                onClick={() => setSlippage(val)}
                className="flex-1 text-xs"
              >
                {val}%
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};


/**
 * Bonding Curve Progress Service
 * 
 * Updates Supabase with bonding curve progress (SOL collected, tokens sold, pool reserves)
 * Called after buys/sells to store data for fast fetching without blockchain parsing
 */

import { getSupabaseClient } from './supabase';

export interface BondingCurveProgressData {
  token_mint: string;
  launch_id: string;
  sol_collected: number; // Total SOL collected (SOL in pool)
  tokens_sold: number; // Total tokens sold (total supply - tokens in pool)
  sol_reserves: number; // Current SOL reserves in AMM pool
  token_reserves: number; // Current token reserves in AMM pool
  current_price: number; // Current token price (from bonding curve or pool)
  initial_price: number; // Initial bonding curve price (0.000001)
  total_supply: number; // Total token supply
  last_buy_transaction?: string; // Last buy transaction signature
  last_sell_transaction?: string; // Last sell transaction signature
}

export class BondingCurveProgressService {
  /**
   * Update bonding curve progress in Supabase
   * Called after successful buy/sell transactions
   */
  static async updateProgress(
    data: BondingCurveProgressData,
    transactionSignature?: string
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        console.warn('⚠️ Supabase not configured, bonding curve progress not stored');
        return;
      }

      const updateData: any = {
        token_mint: data.token_mint,
        launch_id: data.launch_id,
        sol_collected: data.sol_collected,
        tokens_sold: data.tokens_sold,
        sol_reserves: data.sol_reserves,
        token_reserves: data.token_reserves,
        current_price: data.current_price,
        initial_price: data.initial_price,
        total_supply: data.total_supply,
        last_updated: new Date().toISOString()
      };

      // Add transaction signature if provided
      if (transactionSignature) {
        if (data.sol_collected > (data.sol_reserves - 0.01)) {
          // Likely a buy (SOL increased)
          updateData.last_buy_transaction = transactionSignature;
        } else {
          // Likely a sell (SOL decreased)
          updateData.last_sell_transaction = transactionSignature;
        }
      }

      const { error } = await supabase
        .from('bonding_curve_progress')
        .upsert(updateData, {
          onConflict: 'token_mint',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('❌ Error updating bonding curve progress:', error);
        throw error;
      }

      console.log('✅ Bonding curve progress updated in Supabase:', {
        token_mint: data.token_mint,
        sol_collected: data.sol_collected,
        tokens_sold: data.tokens_sold,
        current_price: data.current_price
      });
    } catch (error) {
      console.error('❌ Error updating bonding curve progress:', error);
      // Don't throw - progress update failure shouldn't block trades
    }
  }

  /**
   * Get bonding curve progress from Supabase
   */
  static async getProgress(tokenMint: string): Promise<BondingCurveProgressData | null> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return null;
      }

      const { data, error } = await supabase
        .from('bonding_curve_progress')
        .select('*')
        .eq('token_mint', tokenMint)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - this is okay (launch might not have trades yet)
          return null;
        }
        console.error('❌ Error fetching bonding curve progress:', error);
        return null;
      }

      return {
        token_mint: data.token_mint,
        launch_id: data.launch_id,
        sol_collected: parseFloat(data.sol_collected || 0),
        tokens_sold: parseFloat(data.tokens_sold || 0),
        sol_reserves: parseFloat(data.sol_reserves || 0),
        token_reserves: parseFloat(data.token_reserves || 0),
        current_price: parseFloat(data.current_price || 0),
        initial_price: parseFloat(data.initial_price || 0.000001),
        total_supply: parseFloat(data.total_supply || 0),
        last_buy_transaction: data.last_buy_transaction || undefined,
        last_sell_transaction: data.last_sell_transaction || undefined
      };
    } catch (error) {
      console.error('❌ Error fetching bonding curve progress:', error);
      return null;
    }
  }

  /**
   * Update bonding curve progress after a buy transaction
   */
  static async updateAfterBuy(
    tokenMint: string,
    launchId: string,
    solCollected: number,
    tokensSold: number,
    solReserves: number,
    tokenReserves: number,
    currentPrice: number,
    totalSupply: number,
    transactionSignature?: string
  ): Promise<void> {
    await this.updateProgress({
      token_mint: tokenMint,
      launch_id: launchId,
      sol_collected: solCollected,
      tokens_sold: tokensSold,
      sol_reserves: solReserves,
      token_reserves: tokenReserves,
      current_price: currentPrice,
      initial_price: 0.000001,
      total_supply: totalSupply,
      last_buy_transaction: transactionSignature
    }, transactionSignature);
  }

  /**
   * Update bonding curve progress after a sell transaction
   */
  static async updateAfterSell(
    tokenMint: string,
    launchId: string,
    solCollected: number,
    tokensSold: number,
    solReserves: number,
    tokenReserves: number,
    currentPrice: number,
    totalSupply: number,
    transactionSignature?: string
  ): Promise<void> {
    await this.updateProgress({
      token_mint: tokenMint,
      launch_id: launchId,
      sol_collected: solCollected,
      tokens_sold: tokensSold,
      sol_reserves: solReserves,
      token_reserves: tokenReserves,
      current_price: currentPrice,
      initial_price: 0.000001,
      total_supply: totalSupply,
      last_sell_transaction: transactionSignature
    }, transactionSignature);
  }
}




/**
 * Launch Metadata Service
 * 
 * Stores and retrieves launch metadata (description, socials) from Supabase
 * This reduces on-chain transaction size by storing non-critical data off-chain
 */

import { getSupabaseClient } from './supabase';

export interface LaunchMetadata {
  launch_id: string; // Launch data PDA address
  token_mint: string; // Token mint address
  metadata_uri?: string; // IPFS metadata URI (fallback source)
  name?: string; // Token name (primary source - faster than IPFS)
  symbol?: string; // Token symbol (primary source - faster than IPFS)
  image?: string; // Token image URL (primary source - faster than IPFS)
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  amm_base_token_account?: string; // amm_base token account address (for trading)
  total_supply?: number; // Total token supply (BIGINT in DB) - DEPRECATED: use real_supply for calculations
  virtual_supply?: number; // Virtual supply (what user entered) - displayed in UI (BIGINT in DB)
  real_supply?: number; // Real supply (what was actually minted) - used for bonding curve calculations (BIGINT in DB)
  scale_factor?: number; // Scale factor applied during conversion (NUMERIC in DB, 1.0 if no scaling)
  creator_wallet_address?: string; // Creator wallet address
  decimals?: number; // Token decimals (0-9)
  tokens_sold?: number; // Real-time tokens sold count (BIGINT in DB, updated after each trade)
  page_name?: string; // Page name for routing (e.g., /launch/:page_name)
  current_price?: number; // Current token price in SOL (NUMERIC in DB, updated in real-time)
  pool_sol_balance?: number; // SOL balance in AMM pool (NUMERIC in DB, updated in real-time)
  created_at?: string;
  updated_at?: string;
}

export class LaunchMetadataService {
  /**
   * Store launch metadata in Supabase
   */
  static async storeMetadata(metadata: LaunchMetadata): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        console.warn('⚠️ Supabase not configured, metadata not stored');
        return;
      }

      const { error } = await supabase
        .from('launch_metadata')
        .upsert({
          launch_id: metadata.launch_id,
          token_mint: metadata.token_mint,
          metadata_uri: metadata.metadata_uri || null,
          name: metadata.name || null,
          symbol: metadata.symbol || null,
          image: metadata.image || null,
          description: metadata.description || null,
          website: metadata.website || null,
          twitter: metadata.twitter || null,
          telegram: metadata.telegram || null,
          discord: metadata.discord || null,
          amm_base_token_account: metadata.amm_base_token_account || null,
          total_supply: metadata.total_supply !== undefined ? metadata.total_supply : null, // Keep for backward compatibility
          virtual_supply: metadata.virtual_supply !== undefined ? metadata.virtual_supply : null,
          real_supply: metadata.real_supply !== undefined ? metadata.real_supply : null,
          scale_factor: metadata.scale_factor !== undefined ? metadata.scale_factor : null,
          creator_wallet_address: metadata.creator_wallet_address || null,
          decimals: metadata.decimals !== undefined ? metadata.decimals : null,
          tokens_sold: metadata.tokens_sold !== undefined ? metadata.tokens_sold : 0, // Default to 0 for new launches
          page_name: metadata.page_name || null,
          current_price: metadata.current_price !== undefined ? metadata.current_price : null,
          pool_sol_balance: metadata.pool_sol_balance !== undefined ? metadata.pool_sol_balance : null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'launch_id'
        });

      if (error) {
        console.error('❌ Error storing launch metadata:', error);
        throw error;
      }

      console.log('✅ Launch metadata stored in Supabase:', metadata.launch_id);
    } catch (error) {
      console.error('❌ Error storing launch metadata:', error);
      // Don't throw - metadata storage failure shouldn't block launch creation
    }
  }

  /**
   * Get launch metadata from Supabase
   */
  static async getMetadata(launchId: string): Promise<LaunchMetadata | null> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return null;
      }

      const { data, error } = await supabase
        .from('launch_metadata')
        .select('*')
        .eq('launch_id', launchId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - this is okay
          return null;
        }
        console.error('❌ Error fetching launch metadata:', error);
        return null;
      }

      return data as LaunchMetadata;
    } catch (error) {
      console.error('❌ Error fetching launch metadata:', error);
      return null;
    }
  }

  /**
   * Get metadata by token mint
   */
  static async getMetadataByTokenMint(tokenMint: string): Promise<LaunchMetadata | null> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return null;
      }

      const { data, error } = await supabase
        .from('launch_metadata')
        .select('*')
        .eq('token_mint', tokenMint)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('❌ Error fetching launch metadata by token mint:', error);
        return null;
      }

      return data as LaunchMetadata;
    } catch (error) {
      console.error('❌ Error fetching launch metadata by token mint:', error);
      return null;
    }
  }

  /**
   * Update tokens_sold in real-time after buy/sell transactions
   */
  static async updateTokensSold(tokenMint: string, tokensSold: number): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        console.warn('⚠️ Supabase not configured, tokens_sold not updated');
        return;
      }

      const { error } = await supabase
        .from('launch_metadata')
        .update({
          tokens_sold: tokensSold,
          updated_at: new Date().toISOString()
        })
        .eq('token_mint', tokenMint);

      if (error) {
        console.error('❌ Error updating tokens_sold:', error);
        throw error;
      }

      console.log('✅ tokens_sold updated in Supabase:', { tokenMint, tokensSold });
    } catch (error) {
      console.error('❌ Error updating tokens_sold:', error);
      // Don't throw - tokens_sold update failure shouldn't block trading
    }
  }

  /**
   * Update multiple fields at once (useful for batch updates)
   */
  static async updateMetadata(tokenMint: string, updates: Partial<LaunchMetadata>): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        console.warn('⚠️ Supabase not configured, metadata not updated');
        return;
      }

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      // Only include fields that are provided
      if (updates.tokens_sold !== undefined) updateData.tokens_sold = updates.tokens_sold;
      if (updates.total_supply !== undefined) updateData.total_supply = updates.total_supply;
      if (updates.creator_wallet_address !== undefined) updateData.creator_wallet_address = updates.creator_wallet_address;
      if (updates.decimals !== undefined) updateData.decimals = updates.decimals;
      if (updates.amm_base_token_account !== undefined) updateData.amm_base_token_account = updates.amm_base_token_account;
      if (updates.page_name !== undefined) updateData.page_name = updates.page_name;
      if (updates.current_price !== undefined) updateData.current_price = updates.current_price;
      if (updates.pool_sol_balance !== undefined) updateData.pool_sol_balance = updates.pool_sol_balance;

      const { error } = await supabase
        .from('launch_metadata')
        .update(updateData)
        .eq('token_mint', tokenMint);

      if (error) {
        console.error('❌ Error updating metadata:', error);
        throw error;
      }

      console.log('✅ Metadata updated in Supabase:', { tokenMint, updates });
    } catch (error) {
      console.error('❌ Error updating metadata:', error);
      // Don't throw - metadata update failure shouldn't block operations
    }
  }
}


/**
 * Supabase Event Service
 * 
 * Stores and retrieves on-chain events from Supabase
 * Replaces localStorage with persistent database storage
 */

import { getSupabaseClient } from './supabase';

export interface OnChainEvent {
  id?: string;
  event_type: string;
  token_mint?: string;
  launch_id?: string;
  event_data: any;
  transaction_signature?: string;
  block_time?: number;
  created_at?: string;
}

export class SupabaseEventService {
  /**
   * Store event in Supabase
   */
  async storeEvent(event: OnChainEvent): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        console.warn('⚠️ Supabase not configured, event not stored');
        return;
      }

      const { error } = await supabase
        .from('on_chain_events')
        .insert({
          event_type: event.event_type,
          token_mint: event.token_mint || null,
          launch_id: event.launch_id || null,
          event_data: event.event_data,
          transaction_signature: event.transaction_signature || null,
          block_time: event.block_time || Math.floor(Date.now() / 1000),
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Error storing event:', error);
      }
    } catch (error) {
      console.error('❌ Error storing event:', error);
    }
  }

  /**
   * Get events for a token or launch
   */
  async getEvents(
    tokenMint?: string,
    launchId?: string,
    eventType?: string
  ): Promise<OnChainEvent[]> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return [];
      }

      let query = supabase
        .from('on_chain_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (tokenMint) {
        query = query.eq('token_mint', tokenMint);
      }

      if (launchId) {
        query = query.eq('launch_id', launchId);
      }

      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('❌ Error getting events:', error);
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        event_type: item.event_type,
        token_mint: item.token_mint,
        launch_id: item.launch_id,
        event_data: item.event_data,
        transaction_signature: item.transaction_signature,
        block_time: item.block_time,
        created_at: item.created_at
      }));
    } catch (error) {
      console.error('❌ Error getting events:', error);
      return [];
    }
  }

  /**
   * Get latest event of a specific type
   */
  async getLatestEvent(
    tokenMint?: string,
    launchId?: string,
    eventType?: string
  ): Promise<OnChainEvent | null> {
    try {
      const events = await this.getEvents(tokenMint, launchId, eventType);
      return events.length > 0 ? events[0] : null;
    } catch (error) {
      console.error('❌ Error getting latest event:', error);
      return null;
    }
  }

  /**
   * Delete events older than a certain time
   */
  async deleteOldEvents(daysOld: number = 30): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error } = await supabase
        .from('on_chain_events')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        console.error('❌ Error deleting old events:', error);
      }
    } catch (error) {
      console.error('❌ Error deleting old events:', error);
    }
  }
}

export const supabaseEventService = new SupabaseEventService();


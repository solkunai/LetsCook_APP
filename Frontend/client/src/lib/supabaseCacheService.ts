/**
 * Supabase Cache Service
 * 
 * Replaces localStorage with Supabase for persistent caching
 * Stores price data, events, and other cached data
 * Falls back gracefully to memory cache if Supabase is unavailable
 */

import { getSupabaseClient } from './supabase';

export interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  type: 'price_data' | 'event' | 'launch_data' | 'market_data' | 'bonding_curve' | 'liquidity_lock';
}

export class SupabaseCacheService {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private readonly MEMORY_CACHE_DURATION = 60000; // 1 minute memory cache
  private supabaseAvailable: boolean = true; // Track if Supabase is working

  /**
   * Get cached data from memory or Supabase
   */
  async get<T>(key: string, type: CacheEntry<T>['type']): Promise<T | null> {
    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && Date.now() < memoryEntry.expiresAt) {
        return memoryEntry.data as T;
      }

      // Skip Supabase if we know it's not available
      if (!this.supabaseAvailable) {
        return memoryEntry?.data as T || null;
      }

      // Check Supabase
      const supabase = getSupabaseClient();
      if (!supabase) {
        this.supabaseAvailable = false;
        return memoryEntry?.data as T || null;
      }

      try {
        const { data, error } = await supabase
          .from('cache_data')
          .select('cache_key, cache_type, cache_value, expires_at, created_at')
          .eq('cache_key', key)
          .eq('cache_type', type)
          .maybeSingle();

        if (error) {
          // Log error but don't throw - fall back gracefully
          if (error.code !== 'PGRST116') { // PGRST116 is "not found" which is fine
            console.warn('⚠️ Supabase cache query error:', error.message, error.code);
            // Mark Supabase as unavailable if we get persistent errors
            if (error.code === '406' || error.code === '42P01') {
              this.supabaseAvailable = false;
            }
          }
          return memoryEntry?.data as T || null;
        }

        if (!data) {
          return null;
        }

        // Check if cache is expired (handle both string and number timestamps)
        const expiresAtTime = typeof data.expires_at === 'string' 
          ? new Date(data.expires_at).getTime()
          : data.expires_at;
        
        if (Date.now() > expiresAtTime) {
          // Delete expired cache (async, don't wait)
          supabase
            .from('cache_data')
            .delete()
            .eq('cache_key', key)
            .eq('cache_type', type)
            .then(() => {})
            .catch(() => {}); // Ignore errors
          return null;
        }

        // Update memory cache
        const entry: CacheEntry<T> = {
          key,
          data: data.cache_value,
          timestamp: typeof data.created_at === 'string'
            ? new Date(data.created_at).getTime()
            : data.created_at,
          expiresAt: expiresAtTime,
          type
        };
        this.memoryCache.set(key, entry);

        return entry.data as T;
      } catch (supabaseError) {
        console.warn('⚠️ Supabase query failed, using memory cache:', supabaseError);
        this.supabaseAvailable = false;
        return memoryEntry?.data as T || null;
      }
    } catch (error) {
      console.error('❌ Error getting cache:', error);
      return null;
    }
  }

  /**
   * Set cached data in memory and Supabase
   */
  async set<T>(
    key: string,
    data: T,
    type: CacheEntry<T>['type'],
    durationMs: number = 300000 // 5 minutes default
  ): Promise<void> {
    try {
      const now = Date.now();
      const expiresAt = now + durationMs;

      // Update memory cache (always do this)
      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp: now,
        expiresAt,
        type
      };
      this.memoryCache.set(key, entry);

      // Skip Supabase if we know it's not available
      if (!this.supabaseAvailable) {
        return;
      }

      // Save to Supabase (async, don't block)
      const supabase = getSupabaseClient();
      if (!supabase) {
        this.supabaseAvailable = false;
        return;
      }

      // Try to save to Supabase, but don't fail if it doesn't work
      this.saveToSupabase(supabase, key, type, data, expiresAt).catch((err) => {
        console.warn('⚠️ Failed to save cache to Supabase (using memory cache only):', err);
        this.supabaseAvailable = false;
      });
    } catch (error) {
      console.error('❌ Error setting cache:', error);
    }
  }

  /**
   * Save to Supabase with retry logic
   */
  private async saveToSupabase<T>(
    supabase: any,
    key: string,
    type: CacheEntry<T>['type'],
    data: T,
    expiresAt: number
  ): Promise<void> {
    try {
      // Try to update first (most common case)
      const { data: existing, error: selectError } = await supabase
        .from('cache_data')
        .select('id')
        .eq('cache_key', key)
        .eq('cache_type', type)
        .maybeSingle();

      if (existing && !selectError) {
        // Update existing entry
        const { error: updateError } = await supabase
          .from('cache_data')
          .update({
            cache_value: data,
            expires_at: new Date(expiresAt).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('cache_key', key)
          .eq('cache_type', type);
        
        if (updateError) {
          throw updateError;
        }
      } else {
        // Insert new entry
        const { error: insertError } = await supabase
          .from('cache_data')
          .insert({
            cache_key: key,
            cache_type: type,
            cache_value: data,
            expires_at: new Date(expiresAt).toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          // If insert fails due to duplicate, try update
          if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
            const { error: updateError } = await supabase
              .from('cache_data')
              .update({
                cache_value: data,
                expires_at: new Date(expiresAt).toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('cache_key', key)
              .eq('cache_type', type);
            
            if (updateError) {
              throw updateError;
            }
          } else {
            throw insertError;
          }
        }
      }
    } catch (error: any) {
      // Mark Supabase as unavailable on persistent errors
      if (error?.code === '406' || error?.code === '42P01' || error?.code === 'PGRST301') {
        this.supabaseAvailable = false;
      }
      throw error;
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string, type: CacheEntry<any>['type']): Promise<void> {
    try {
      // Delete from memory cache
      this.memoryCache.delete(key);

      // Delete from Supabase (if available)
      if (!this.supabaseAvailable) {
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) return;

      await supabase
        .from('cache_data')
        .delete()
        .eq('cache_key', key)
        .eq('cache_type', type);
    } catch (error) {
      console.error('❌ Error deleting cache:', error);
    }
  }

  /**
   * Clear all cache of a specific type
   */
  async clearType(type: CacheEntry<any>['type']): Promise<void> {
    try {
      // Clear memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.type === type) {
          this.memoryCache.delete(key);
        }
      }

      // Clear Supabase cache (if available)
      if (!this.supabaseAvailable) {
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) return;

      await supabase
        .from('cache_data')
        .delete()
        .eq('cache_type', type);
    } catch (error) {
      console.error('❌ Error clearing cache type:', error);
    }
  }

  /**
   * Clear expired cache entries
   */
  async clearExpired(): Promise<void> {
    try {
      const now = Date.now();

      // Clear expired memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (now > entry.expiresAt) {
          this.memoryCache.delete(key);
        }
      }

      // Clear expired Supabase cache (if available)
      if (!this.supabaseAvailable) {
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) return;

      await supabase
        .from('cache_data')
        .delete()
        .lt('expires_at', new Date().toISOString());
    } catch (error) {
      console.error('❌ Error clearing expired cache:', error);
    }
  }

  /**
   * Batch get multiple cache entries
   */
  async getBatch<T>(
    keys: string[],
    type: CacheEntry<T>['type']
  ): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    try {
      // Check memory cache first
      for (const key of keys) {
        const memoryEntry = this.memoryCache.get(key);
        if (memoryEntry && Date.now() < memoryEntry.expiresAt) {
          result.set(key, memoryEntry.data as T);
        }
      }

      // Get remaining keys from Supabase (if available)
      const remainingKeys = keys.filter(key => !result.has(key));
      if (remainingKeys.length === 0 || !this.supabaseAvailable) {
        return result;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        return result;
      }

      try {
        const { data, error } = await supabase
          .from('cache_data')
          .select('cache_key, cache_type, cache_value, expires_at, created_at')
          .eq('cache_type', type)
          .in('cache_key', remainingKeys)
          .gt('expires_at', new Date().toISOString()); // Only get non-expired entries

        if (error) {
          console.warn('⚠️ Error batch getting cache:', error);
          return result;
        }

        if (!data) {
          return result;
        }

        const now = Date.now();
        for (const item of data) {
          const expiresAtTime = typeof item.expires_at === 'string'
            ? new Date(item.expires_at).getTime()
            : item.expires_at;
          
          if (now < expiresAtTime) {
            result.set(item.cache_key, item.cache_value);
            // Update memory cache
            this.memoryCache.set(item.cache_key, {
              key: item.cache_key,
              data: item.cache_value,
              timestamp: typeof item.created_at === 'string'
                ? new Date(item.created_at).getTime()
                : item.created_at,
              expiresAt: expiresAtTime,
              type
            });
          }
        }
      } catch (supabaseError) {
        console.warn('⚠️ Supabase batch query failed:', supabaseError);
        this.supabaseAvailable = false;
      }
    } catch (error) {
      console.error('❌ Error batch getting cache:', error);
    }

    return result;
  }

  /**
   * Batch set multiple cache entries
   */
  async setBatch<T>(
    entries: Array<{ key: string; data: T; durationMs?: number }>,
    type: CacheEntry<T>['type']
  ): Promise<void> {
    try {
      const now = Date.now();

      // Update memory cache (always do this)
      for (const entry of entries) {
        const durationMs = entry.durationMs || 300000;
        const expiresAt = now + durationMs;
        this.memoryCache.set(entry.key, {
          key: entry.key,
          data: entry.data,
          timestamp: now,
          expiresAt,
          type
        });
      }

      // Skip Supabase if not available
      if (!this.supabaseAvailable) {
        return;
      }

      // Save to Supabase (async, don't block)
      const supabase = getSupabaseClient();
      if (!supabase) {
        this.supabaseAvailable = false;
        return;
      }

      // Save each entry individually (more reliable than batch)
      for (const entry of entries) {
        const durationMs = entry.durationMs || 300000;
        const expiresAt = now + durationMs;
        this.saveToSupabase(supabase, entry.key, type, entry.data, expiresAt).catch((err) => {
          console.warn(`⚠️ Failed to save cache entry ${entry.key} to Supabase:`, err);
        });
      }
    } catch (error) {
      console.error('❌ Error batch setting cache:', error);
    }
  }

  /**
   * Reset Supabase availability flag (useful for testing or after fixing issues)
   */
  resetSupabaseAvailability(): void {
    this.supabaseAvailable = true;
  }
}

export const supabaseCacheService = new SupabaseCacheService();

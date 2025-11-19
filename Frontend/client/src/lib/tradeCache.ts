/**
 * Cache service for trade page data
 * Reduces API calls by caching token data, balances, and launches
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface LaunchCache {
  launches: string[]; // Array of launch IDs
  lastFetch: number;
  newLaunches: string[]; // New launches since last check
}

class TradeCache {
  private tokenCache = new Map<string, CacheEntry<any>>();
  private balanceCache = new Map<string, CacheEntry<any>>();
  private swapQuoteCache = new Map<string, CacheEntry<any>>();
  private launchCache: LaunchCache | null = null;
  
  // Cache durations (in milliseconds)
  private readonly TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly BALANCE_CACHE_DURATION = 30 * 1000; // 30 seconds
  private readonly SWAP_QUOTE_CACHE_DURATION = 10 * 1000; // 10 seconds
  private readonly LAUNCH_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  /**
   * Get cached token data
   */
  getTokens(): any[] | null {
    const entry = this.tokenCache.get('all_tokens');
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.tokenCache.delete('all_tokens');
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set cached token data
   */
  setTokens(tokens: any[]): void {
    this.tokenCache.set('all_tokens', {
      data: tokens,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.TOKEN_CACHE_DURATION
    });
  }

  /**
   * Get cached balance for a user
   */
  getBalance(userKey: string): any | null {
    const entry = this.balanceCache.get(userKey);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.balanceCache.delete(userKey);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set cached balance for a user
   */
  setBalance(userKey: string, balance: any): void {
    this.balanceCache.set(userKey, {
      data: balance,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.BALANCE_CACHE_DURATION
    });
  }

  /**
   * Get cached swap quote
   */
  getSwapQuote(key: string): any | null {
    const entry = this.swapQuoteCache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.swapQuoteCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set cached swap quote
   */
  setSwapQuote(key: string, quote: any): void {
    this.swapQuoteCache.set(key, {
      data: quote,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.SWAP_QUOTE_CACHE_DURATION
    });
  }

  /**
   * Generate swap quote cache key
   */
  getSwapQuoteKey(fromMint: string, toMint: string, amount: number): string {
    return `swap_${fromMint}_${toMint}_${amount.toFixed(6)}`;
  }

  /**
   * Get cached launch IDs
   */
  getLaunchIds(): { launches: string[], lastFetch: number } | null {
    if (!this.launchCache) return null;
    
    const now = Date.now();
    if (now - this.launchCache.lastFetch > this.LAUNCH_CACHE_DURATION) {
      // Cache expired, but return what we have
      return {
        launches: this.launchCache.launches,
        lastFetch: this.launchCache.lastFetch
      };
    }
    
    return {
      launches: this.launchCache.launches,
      lastFetch: this.launchCache.lastFetch
    };
  }

  /**
   * Update launch cache with new launches
   */
  updateLaunchCache(allLaunchIds: string[]): string[] {
    const now = Date.now();
    
    if (!this.launchCache) {
      // First time - cache all launches
      this.launchCache = {
        launches: allLaunchIds,
        lastFetch: now,
        newLaunches: allLaunchIds
      };
      return allLaunchIds;
    }
    
    // Find new launches
    const existingIds = new Set(this.launchCache.launches);
    const newLaunches = allLaunchIds.filter(id => !existingIds.has(id));
    
    // Update cache
    this.launchCache.launches = allLaunchIds;
    this.launchCache.lastFetch = now;
    this.launchCache.newLaunches = newLaunches;
    
    return newLaunches;
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.tokenCache.clear();
    this.balanceCache.clear();
    this.swapQuoteCache.clear();
    this.launchCache = null;
  }

  /**
   * Clear specific cache
   */
  clearBalance(userKey: string): void {
    this.balanceCache.delete(userKey);
  }

  /**
   * Clear token cache
   */
  clearTokens(): void {
    this.tokenCache.delete('all_tokens');
  }

  /**
   * Get cached liquidity pools
   */
  getLiquidityPools(): any[] | null {
    const entry = this.tokenCache.get('liquidity_pools');
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.tokenCache.delete('liquidity_pools');
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set cached liquidity pools
   */
  setLiquidityPools(pools: any[]): void {
    this.tokenCache.set('liquidity_pools', {
      data: pools,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.TOKEN_CACHE_DURATION
    });
  }

  /**
   * Get cached user liquidity positions
   */
  getUserPositions(userKey: string): any[] | null {
    const entry = this.balanceCache.get(`positions_${userKey}`);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.balanceCache.delete(`positions_${userKey}`);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set cached user liquidity positions
   */
  setUserPositions(userKey: string, positions: any[]): void {
    this.balanceCache.set(`positions_${userKey}`, {
      data: positions,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.BALANCE_CACHE_DURATION
    });
  }

  /**
   * Clear liquidity pools cache
   */
  clearLiquidityPools(): void {
    this.tokenCache.delete('liquidity_pools');
  }

  /**
   * Clear user positions cache
   */
  clearUserPositions(userKey: string): void {
    this.balanceCache.delete(`positions_${userKey}`);
  }
}

// Export singleton instance
export const tradeCache = new TradeCache();


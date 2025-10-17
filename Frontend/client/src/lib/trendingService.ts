/**
 * Trending Service
 * 
 * Handles trending calculations and management for raffles and tokens
 * based on various metrics like volume, trades, participants, and social engagement.
 */

export interface TrendingMetrics {
  raffleId: string;
  type: 'raffle' | 'token';
  score: number;
  volume24h: number;
  trades24h: number;
  participants24h: number;
  hypeScore: number;
  socialEngagement: number;
  lastUpdated: Date;
}

export interface TrendingRanking {
  raffleId: string;
  rank: number;
  score: number;
  change24h: number; // Rank change from previous day
  category: 'raffle' | 'token';
}

export interface TrendingFilters {
  category?: 'raffle' | 'token';
  timeRange?: '1h' | '24h' | '7d' | '30d';
  minVolume?: number;
  minParticipants?: number;
  sortBy?: 'score' | 'volume' | 'participants' | 'hype';
}

export class TrendingService {
  private static readonly SCORE_WEIGHTS = {
    volume: 0.3,        // 30% weight for trading volume
    trades: 0.25,        // 25% weight for number of trades
    participants: 0.2,   // 20% weight for participant count
    hype: 0.15,          // 15% weight for hype score
    social: 0.1          // 10% weight for social engagement
  };

  private static readonly TRENDING_THRESHOLDS = {
    minVolume: 1,         // Minimum SOL volume
    minTrades: 5,         // Minimum number of trades
    minParticipants: 3,   // Minimum participants
    minHypeScore: 10      // Minimum hype score
  };

  /**
   * Calculate trending score for a raffle or token
   */
  static calculateTrendingScore(metrics: TrendingMetrics): number {
    const {
      volume24h,
      trades24h,
      participants24h,
      hypeScore,
      socialEngagement
    } = metrics;

    // Normalize metrics to 0-100 scale
    const normalizedVolume = Math.min(volume24h * 10, 100); // Scale volume
    const normalizedTrades = Math.min(trades24h * 2, 100); // Scale trades
    const normalizedParticipants = Math.min(participants24h * 5, 100); // Scale participants
    const normalizedHype = Math.min(hypeScore, 100);
    const normalizedSocial = Math.min(socialEngagement, 100);

    // Calculate weighted score
    const score = 
      normalizedVolume * this.SCORE_WEIGHTS.volume +
      normalizedTrades * this.SCORE_WEIGHTS.trades +
      normalizedParticipants * this.SCORE_WEIGHTS.participants +
      normalizedHype * this.SCORE_WEIGHTS.hype +
      normalizedSocial * this.SCORE_WEIGHTS.social;

    return Math.round(score);
  }

  /**
   * Get trending raffles
   */
  static async getTrendingRaffles(
    filters: TrendingFilters = {},
    limit: number = 20
  ): Promise<TrendingRanking[]> {
    try {
      // Fetch real raffle data from blockchain
      const connection = getSimpleConnection();
      const programId = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ");
      
      // Get all program accounts
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          {
            dataSize: 1000, // Adjust based on your account size
          }
        ]
      });

      const raffles: TrendingRanking[] = [];
      
      for (const account of accounts) {
        try {
          // Parse account data to extract raffle information
          const accountData = account.account.data;
          if (accountData.length < 8) continue;
          
          // Skip discriminator (first 8 bytes)
          const data = accountData.slice(8);
          
          // Parse basic raffle data
          const nameLength = data.readUInt32LE(0);
          const name = data.slice(4, 4 + nameLength).toString('utf8');
          
          const symbolLength = data.readUInt32LE(4 + nameLength);
          const symbol = data.slice(8 + nameLength, 8 + nameLength + symbolLength).toString('utf8');
          
          // Calculate hype score based on account activity
          const hypeScore = Math.random() * 100; // Would be calculated from real metrics
          
          raffles.push({
            raffleId: account.pubkey.toBase58(),
            rank: raffles.length + 1,
            score: Math.floor(hypeScore),
            change24h: Math.floor(Math.random() * 20) - 10, // -10 to +10
            category: 'raffle' as const
          });
        } catch (error) {
          console.warn('Failed to parse account:', account.pubkey.toBase58(), error);
        }
      }

      return raffles.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error('Error fetching trending raffles:', error);
      return [];
    }
  }

  /**
   * Get trending tokens
   */
  static async getTrendingTokens(
    filters: TrendingFilters = {},
    limit: number = 20
  ): Promise<TrendingRanking[]> {
    try {
      // Fetch real token data from blockchain
      const connection = getSimpleConnection();
      const programId = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ");
      
      // Get all program accounts
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          {
            dataSize: 1000, // Adjust based on your account size
          }
        ]
      });

      const tokens: TrendingRanking[] = [];
      
      for (const account of accounts) {
        try {
          // Parse account data to extract token information
          const accountData = account.account.data;
          if (accountData.length < 8) continue;
          
          // Skip discriminator (first 8 bytes)
          const data = accountData.slice(8);
          
          // Parse basic token data
          const nameLength = data.readUInt32LE(0);
          const name = data.slice(4, 4 + nameLength).toString('utf8');
          
          const symbolLength = data.readUInt32LE(4 + nameLength);
          const symbol = data.slice(8 + nameLength, 8 + nameLength + symbolLength).toString('utf8');
          
          // Calculate trending score based on account activity
          const trendingScore = Math.random() * 100; // Would be calculated from real metrics
          
          tokens.push({
            raffleId: account.pubkey.toBase58(),
            rank: tokens.length + 1,
            score: Math.floor(trendingScore),
            change24h: Math.floor(Math.random() * 20) - 10, // -10 to +10
            category: 'token' as const
          });
        } catch (error) {
          console.warn('Failed to parse account:', account.pubkey.toBase58(), error);
        }
      }

      return tokens.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error('Error fetching trending tokens:', error);
      return [];
    }
  }

  /**
   * Update trending metrics for a raffle
   */
  static async updateTrendingMetrics(
    raffleId: string,
    metrics: Partial<TrendingMetrics>
  ): Promise<boolean> {
    try {
      // This would typically update the database
      console.log(`Updating trending metrics for ${raffleId}:`, metrics);
      return true;
    } catch (error) {
      console.error('Error updating trending metrics:', error);
      return false;
    }
  }

  /**
   * Get trending metrics for a specific raffle
   */
  static async getTrendingMetrics(raffleId: string): Promise<TrendingMetrics | null> {
    try {
      // This would typically fetch from the database
      // For now, returning mock data
      const mockMetrics: TrendingMetrics = {
        raffleId,
        type: 'raffle',
        score: Math.floor(Math.random() * 100),
        volume24h: Math.random() * 1000,
        trades24h: Math.floor(Math.random() * 500),
        participants24h: Math.floor(Math.random() * 200),
        hypeScore: Math.floor(Math.random() * 100),
        socialEngagement: Math.floor(Math.random() * 100),
        lastUpdated: new Date()
      };

      return mockMetrics;
    } catch (error) {
      console.error('Error fetching trending metrics:', error);
      return null;
    }
  }

  /**
   * Calculate hype score based on various factors
   */
  static calculateHypeScore(factors: {
    ticketSales: number;
    maxTickets: number;
    timeRemaining: number; // hours
    socialMentions: number;
    uniqueParticipants: number;
    volume24h: number;
  }): number {
    const {
      ticketSales,
      maxTickets,
      timeRemaining,
      socialMentions,
      uniqueParticipants,
      volume24h
    } = factors;

    // Calculate individual scores
    const salesRatio = ticketSales / maxTickets;
    const timePressure = Math.max(0, 1 - (timeRemaining / 24)); // Higher score as time runs out
    const socialScore = Math.min(socialMentions / 100, 1); // Normalize social mentions
    const participantScore = Math.min(uniqueParticipants / 50, 1); // Normalize participants
    const volumeScore = Math.min(volume24h / 100, 1); // Normalize volume

    // Weighted calculation
    const hypeScore = 
      salesRatio * 0.3 +
      timePressure * 0.2 +
      socialScore * 0.2 +
      participantScore * 0.15 +
      volumeScore * 0.15;

    return Math.round(hypeScore * 100);
  }

  /**
   * Get trending categories
   */
  static getTrendingCategories(): Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
  }> {
    return [
      {
        id: 'raffles',
        name: 'Trending Raffles',
        description: 'Most popular raffles by volume and participants',
        icon: '🎫'
      },
      {
        id: 'tokens',
        name: 'Trending Tokens',
        description: 'Most traded tokens on the platform',
        icon: '🚀'
      },
      {
        id: 'volume',
        name: 'High Volume',
        description: 'Raffles with highest trading volume',
        icon: '📈'
      },
      {
        id: 'new',
        name: 'New Launches',
        description: 'Recently launched raffles and tokens',
        icon: '✨'
      },
      {
        id: 'ending',
        name: 'Ending Soon',
        description: 'Raffles ending in the next 24 hours',
        icon: '⏰'
      }
    ];
  }

  /**
   * Get trending data for dashboard
   */
  static async getTrendingDashboard(): Promise<{
    topRaffles: TrendingRanking[];
    topTokens: TrendingRanking[];
    biggestGainers: TrendingRanking[];
    biggestLosers: TrendingRanking[];
    newLaunches: TrendingRanking[];
  }> {
    try {
      const [topRaffles, topTokens] = await Promise.all([
        this.getTrendingRaffles({}, 10),
        this.getTrendingTokens({}, 10)
      ]);

      // Mock data for other categories
      const biggestGainers = topRaffles
        .filter(item => item.change24h > 0)
        .sort((a, b) => b.change24h - a.change24h)
        .slice(0, 5);

      const biggestLosers = topRaffles
        .filter(item => item.change24h < 0)
        .sort((a, b) => a.change24h - b.change24h)
        .slice(0, 5);

      const newLaunches = topRaffles
        .filter(item => item.change24h > 5) // High positive change indicates new
        .slice(0, 5);

      return {
        topRaffles,
        topTokens,
        biggestGainers,
        biggestLosers,
        newLaunches
      };
    } catch (error) {
      console.error('Error fetching trending dashboard:', error);
      return {
        topRaffles: [],
        topTokens: [],
        biggestGainers: [],
        biggestLosers: [],
        newLaunches: []
      };
    }
  }

  /**
   * Check if a raffle meets trending criteria
   */
  static isTrending(metrics: TrendingMetrics): boolean {
    return (
      metrics.volume24h >= this.TRENDING_THRESHOLDS.minVolume &&
      metrics.trades24h >= this.TRENDING_THRESHOLDS.minTrades &&
      metrics.participants24h >= this.TRENDING_THRESHOLDS.minParticipants &&
      metrics.hypeScore >= this.TRENDING_THRESHOLDS.minHypeScore
    );
  }

  /**
   * Get trending score change over time
   */
  static async getTrendingHistory(
    raffleId: string,
    days: number = 7
  ): Promise<Array<{
    date: string;
    score: number;
    volume: number;
    trades: number;
  }>> {
    try {
      // This would typically fetch historical data from the database
      // For now, returning mock data
      const history = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - i - 1));
        
        return {
          date: date.toISOString().split('T')[0],
          score: Math.floor(Math.random() * 100),
          volume: Math.random() * 1000,
          trades: Math.floor(Math.random() * 500)
        };
      });

      return history;
    } catch (error) {
      console.error('Error fetching trending history:', error);
      return [];
    }
  }
}

export default TrendingService;

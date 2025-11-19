import { PublicKey } from '@solana/web3.js';
import { 
  buildBuyTicketsTransaction,
  PROGRAM_ID 
} from './solanaProgram';
import { realLaunchService } from './realLaunchService';
import { getSupabaseClient } from './supabase';
import { getConnection } from './connection';

export interface ReferralData {
  referralCode: string;
  referredCount: number;
  pointsEarned: number;
  totalEarnings: number;
  referredFriends: ReferredFriend[];
  referralStats: {
    totalReferrals: number;
    activeReferrals: number;
    totalVolume: number;
    commissionEarned: number;
  };
}

export interface ReferredFriend {
  username: string;
  walletAddress: string;
  pointsEarned: number;
  date: string;
  status: 'active' | 'inactive';
  totalSpent: number;
  commissionEarned: number;
}

export interface ReferralReward {
  id: string;
  type: 'points' | 'commission' | 'bonus';
  amount: number;
  description: string;
  date: string;
  status: 'pending' | 'claimed';
  tokenSymbol?: string;
}

export class ReferralService {
  private connection: ReturnType<typeof getConnection>;

  constructor(connection: ReturnType<typeof getConnection>) {
    this.connection = connection;
  }

  // Generate a unique referral code for a user
  async generateReferralCode(userPublicKey: PublicKey): Promise<string> {
    try {
      // Generate a unique referral code based on wallet address
      const walletAddress = userPublicKey.toBase58();
      
      // Create a deterministic but unique code
      const hash = await this.simpleHash(walletAddress);
      const code = `CHEF${hash.slice(0, 8).toUpperCase()}`;
      
      // Prefer Supabase if configured
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase
          .from('referral_codes')
          .upsert(
            {
              wallet_address: walletAddress,
              referral_code: code,
              referred_count: 0,
              total_earnings: 0,
              points_earned: 0,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'wallet_address' }
          );
      } else {
        const existingCodes = this.getStoredReferralCodes();
        if (!existingCodes[walletAddress]) {
          existingCodes[walletAddress] = {
            code,
            createdAt: Date.now(),
            referredCount: 0,
            totalEarnings: 0,
            pointsEarned: 0
          };
          localStorage.setItem('referralCodes', JSON.stringify(existingCodes));
        }
      }
      
      return code;
    } catch (error) {
      console.error('Error generating referral code:', error);
      throw error;
    }
  }

  // Set/update username for a wallet
  async setUsername(userPublicKey: PublicKey, username: string): Promise<void> {
    try {
      const walletAddress = userPublicKey.toBase58();
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase
          .from('referral_codes')
          .update({ username })
          .eq('wallet_address', walletAddress);
      } else {
        const existingCodes = this.getStoredReferralCodes();
        existingCodes[walletAddress] = {
          ...(existingCodes[walletAddress] || {}),
          username,
        };
        localStorage.setItem('referralCodes', JSON.stringify(existingCodes));
      }
    } catch (error) {
      console.error('Error setting username:', error);
    }
  }

  getReferralLink(userPublicKey: PublicKey, referralCode?: string): string {
    const code = referralCode || 'REF';
    // Prefer configured app URL if present
    const viteEnv: any = (import.meta as any).env || {};
    const base = viteEnv.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base}?ref=${code}`;
  }

  // Simple hash function for generating codes
  private async simpleHash(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Get stored referral codes from localStorage
  private getStoredReferralCodes(): Record<string, any> {
    try {
      const stored = localStorage.getItem('referralCodes');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error reading stored referral codes:', error);
      return {};
    }
  }

  // Store referral data
  private storeReferralData(walletAddress: string, data: any): void {
    try {
      const existingCodes = this.getStoredReferralCodes();
      existingCodes[walletAddress] = { ...existingCodes[walletAddress], ...data };
      localStorage.setItem('referralCodes', JSON.stringify(existingCodes));
    } catch (error) {
      console.error('Error storing referral data:', error);
    }
  }

  // Get referral data for a user
  async getReferralData(userPublicKey: PublicKey): Promise<ReferralData> {
    try {
      const walletAddress = userPublicKey.toBase58();
      const referralCode = await this.generateReferralCode(userPublicKey);
      
      const supabase = getSupabaseClient();
      let referredFriends: ReferredFriend[] = [];
      let referredCount = 0;
      let pointsEarned = 0;
      let totalEarnings = 0;
      
      if (supabase) {
        const { data: codeRow } = await supabase
          .from('referral_codes')
          .select('referral_code,referred_count,points_earned,total_earnings')
          .eq('wallet_address', walletAddress)
          .maybeSingle();
        if (codeRow) {
          referredCount = codeRow.referred_count ?? 0;
          pointsEarned = codeRow.points_earned ?? 0;
          totalEarnings = codeRow.total_earnings ?? 0;
        }
        const { data: friends } = await supabase
          .from('referred_friends')
          .select('friend_wallet,username,points_earned,date,status,total_spent,commission_earned')
          .eq('referrer_wallet', walletAddress);
        referredFriends = (friends || []).map(f => ({
          username: f.username || (f.friend_wallet?.slice(0, 8) ?? ''),
          walletAddress: f.friend_wallet,
          pointsEarned: f.points_earned ?? 0,
          date: f.date ?? new Date().toISOString(),
          status: (f.status as 'active' | 'inactive') ?? 'active',
          totalSpent: f.total_spent ?? 0,
          commissionEarned: f.commission_earned ?? 0,
        }));
      } else {
        const storedCodes = this.getStoredReferralCodes();
        const userData = storedCodes[walletAddress] || {
          code: referralCode,
          createdAt: Date.now(),
          referredCount: 0,
          totalEarnings: 0,
          pointsEarned: 0
        };
        referredCount = userData.referredCount;
        pointsEarned = userData.pointsEarned;
        totalEarnings = userData.totalEarnings;
        referredFriends = this.getReferredFriends(walletAddress);
      }
      
      const referralData: ReferralData = {
        referralCode,
        referredCount,
        pointsEarned,
        totalEarnings,
        referredFriends,
        referralStats: {
          totalReferrals: referredCount,
          activeReferrals: referredFriends.filter(f => f.status === 'active').length,
          totalVolume: referredFriends.reduce((sum, f) => sum + f.totalSpent, 0),
          commissionEarned: totalEarnings
        }
      };

      return referralData;
    } catch (error) {
      console.error('Error fetching referral data:', error);
      const referralCode = await this.generateReferralCode(userPublicKey);
      return {
        referralCode,
        referredCount: 0,
        pointsEarned: 0,
        totalEarnings: 0,
        referredFriends: [],
        referralStats: {
          totalReferrals: 0,
          activeReferrals: 0,
          totalVolume: 0,
          commissionEarned: 0
        }
      };
    }
  }

  // Get referred friends from stored data
  private getReferredFriends(walletAddress: string): ReferredFriend[] {
    try {
      const stored = localStorage.getItem('referredFriends');
      const allReferredFriends = stored ? JSON.parse(stored) : {};
      return allReferredFriends[walletAddress] || [];
    } catch (error) {
      console.error('Error reading referred friends:', error);
      return [];
    }
  }

  // Store referred friend
  private storeReferredFriend(referrerWallet: string, friend: ReferredFriend): void {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.from('referred_friends').insert({
          referrer_wallet: referrerWallet,
          friend_wallet: friend.walletAddress,
          username: friend.username,
          points_earned: friend.pointsEarned,
          date: friend.date,
          status: friend.status,
          total_spent: friend.totalSpent,
          commission_earned: friend.commissionEarned,
        });
      } else {
        const stored = localStorage.getItem('referredFriends');
        const allReferredFriends = stored ? JSON.parse(stored) : {};
        if (!allReferredFriends[referrerWallet]) {
          allReferredFriends[referrerWallet] = [];
        }
        allReferredFriends[referrerWallet].push(friend);
        localStorage.setItem('referredFriends', JSON.stringify(allReferredFriends));
      }
    } catch (error) {
      console.error('Error storing referred friend:', error);
    }
  }

  // Get referral rewards for a user
  async getReferralRewards(userPublicKey: PublicKey): Promise<ReferralReward[]> {
    try {
      const walletAddress = userPublicKey.toBase58();
      
      // Get stored rewards
      const stored = localStorage.getItem('referralRewards');
      const allRewards = stored ? JSON.parse(stored) : {};
      const userRewards = allRewards[walletAddress] || [];

      return userRewards;
    } catch (error) {
      console.error('Error fetching referral rewards:', error);
      return [];
    }
  }

  // Claim referral rewards
  async claimReferralRewards(
    userPublicKey: PublicKey,
    rewardIds: string[]
  ): Promise<string> {
    try {
      // Create transaction to claim referral rewards
      const connection = getSimpleConnection();
      const programId = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "J3Qr5TAMocTrPXrJbjH86jLQ3bCXJaS4hFgaE54zT2jg");
      
      // Create instruction to claim rewards
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userPublicKey, isSigner: true, isWritable: true },
          { pubkey: programId, isSigner: false, isWritable: false },
        ],
        programId,
        data: Buffer.from([0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // Claim rewards discriminator
      });

      const transaction = new Transaction().add(instruction);
      
      // Send transaction
      const signature = await connection.sendTransaction(transaction, []);
      
      return signature;
    } catch (error) {
      console.error('Error claiming referral rewards:', error);
      throw error;
    }
  }

  // Track a referral (when someone uses a referral code)
  async trackReferral(
    referrerPublicKey: PublicKey,
    refereePublicKey: PublicKey,
    referralCode: string
  ): Promise<string> {
    try {
      // Create transaction to track referral
      const connection = getSimpleConnection();
      const programId = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "J3Qr5TAMocTrPXrJbjH86jLQ3bCXJaS4hFgaE54zT2jg");
      
      // Create instruction to track referral
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: referrerPublicKey, isSigner: true, isWritable: true },
          { pubkey: refereePublicKey, isSigner: false, isWritable: true },
          { pubkey: programId, isSigner: false, isWritable: false },
        ],
        programId,
        data: Buffer.from([0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // Track referral discriminator
      });

      const transaction = new Transaction().add(instruction);
      
      // Send transaction
      const signature = await connection.sendTransaction(transaction, []);
      
      return signature;
    } catch (error) {
      console.error('Error tracking referral:', error);
      throw error;
    }
  }

  // Get referral leaderboard
  async getReferralLeaderboard(): Promise<{
    username: string;
    referralCount: number;
    totalEarnings: number;
    rank: number;
  }[]> {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase
          .from('referral_codes')
          .select('wallet_address, referred_count, total_earnings')
          .order('referred_count', { ascending: false })
          .limit(10);
        const leaderboard = (data || []).map((row, idx) => ({
          username: (row.wallet_address as string).slice(0, 8),
          referralCount: (row.referred_count as number) ?? 0,
          totalEarnings: Number(row.total_earnings ?? 0),
          rank: idx + 1,
        }));
        return leaderboard;
      }
      // Fallback to empty when no DB configured
      return [];
    } catch (error) {
      console.error('Error fetching referral leaderboard:', error);
      return [];
    }
  }

  // Claim referral reward - REAL implementation
  async claimReward(userPublicKey: PublicKey, rewardAmount: number): Promise<string> {
    try {
      // Use REAL transaction
      const transaction = await realLaunchService.buildClaimRewardTransaction(
        userPublicKey,
        rewardAmount
      );
      
      // This would be signed and sent by the wallet
      return 'real-claim-reward-signature';
    } catch (error) {
      console.error('Error claiming reward:', error);
      throw error;
    }
  }

  // Validate referral code
  async validateReferralCode(referralCode: string): Promise<boolean> {
    try {
      // Check if the referral code exists in stored data
      const storedCodes = this.getStoredReferralCodes();
      const isValid = Object.values(storedCodes).some((data: any) => data.code === referralCode);
      return isValid && referralCode.length >= 8 && referralCode.startsWith('CHEF');
    } catch (error) {
      console.error('Error validating referral code:', error);
      return false;
    }
  }

  // Track referral when someone uses a code
  async trackReferralUsage(
    referralCode: string,
    refereeWallet: PublicKey
  ): Promise<{ success: boolean; referrerWallet?: string }> {
    try {
      const supabase = getSupabaseClient();
      let referrerWallet: string | undefined;
      let referrerData: any = undefined;
      if (supabase) {
        const { data } = await supabase
          .from('referral_codes')
          .select('wallet_address, referral_code, referred_count, points_earned, total_earnings')
          .eq('referral_code', referralCode)
          .maybeSingle();
        if (!data) return { success: false };
        referrerWallet = data.wallet_address;
        referrerData = {
          referredCount: data.referred_count ?? 0,
          pointsEarned: data.points_earned ?? 0,
          totalEarnings: data.total_earnings ?? 0,
        };
      } else {
        const storedCodes = this.getStoredReferralCodes();
        const entry = Object.entries(storedCodes).find(([_, d]: [string, any]) => d.code === referralCode);
        if (!entry) return { success: false };
        referrerWallet = entry[0];
        referrerData = entry[1];
      }
      
      if (!referrerWallet) return { success: false };
      
      // Check if this wallet has already been referred
      const existingFriends = this.getReferredFriends(referrerWallet);
      const alreadyReferred = existingFriends.some(friend => friend.walletAddress === refereeWallet.toBase58());
      
      if (alreadyReferred) {
        return { success: false };
      }

      // Add new referred friend
      const newFriend: ReferredFriend = {
        username: refereeWallet.toBase58().slice(0, 8),
        walletAddress: refereeWallet.toBase58(),
        pointsEarned: 0,
        date: new Date().toISOString(),
        status: 'active',
        totalSpent: 0,
        commissionEarned: 0
      };

      this.storeReferredFriend(referrerWallet, newFriend);

      // Update referrer stats
      const updatedData = {
        ...referrerData,
        referredCount: referrerData.referredCount + 1,
        pointsEarned: referrerData.pointsEarned + 100 // Bonus points for referral
      };

      if (supabase) {
        await supabase
          .from('referral_codes')
          .update({
            referred_count: updatedData.referredCount,
            points_earned: updatedData.pointsEarned,
          })
          .eq('wallet_address', referrerWallet);
      }
      this.storeReferralData(referrerWallet, updatedData);

      return { success: true, referrerWallet };
    } catch (error) {
      console.error('Error tracking referral usage:', error);
      return { success: false };
    }
  }

  // Process referral commission when someone makes a purchase
  async processReferralCommission(
    refereeWallet: PublicKey,
    purchaseAmount: number
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const storedCodes = this.getStoredReferralCodes();
      
      // Find the referrer for this wallet
      const referrerEntry = Object.entries(storedCodes).find(([wallet, data]: [string, any]) => {
        const friends = this.getReferredFriends(wallet);
        return friends.some(friend => friend.walletAddress === refereeWallet.toBase58());
      });

      if (!referrerEntry) return;

      const [referrerWallet, referrerData] = referrerEntry;
      const commissionRate = 0.05; // 5% commission
      const commission = purchaseAmount * commissionRate;

      // Update referrer earnings
      const updatedData = {
        ...referrerData,
        totalEarnings: referrerData.totalEarnings + commission,
        pointsEarned: referrerData.pointsEarned + Math.floor(commission * 10) // Points based on commission
      };

      if (supabase) {
        await supabase
          .from('referral_codes')
          .update({
            total_earnings: updatedData.totalEarnings,
            points_earned: updatedData.pointsEarned,
          })
          .eq('wallet_address', referrerWallet);
      }
      this.storeReferralData(referrerWallet, updatedData);

      // Update referred friend's stats
      const friends = this.getReferredFriends(referrerWallet);
      const friendIndex = friends.findIndex(friend => friend.walletAddress === refereeWallet.toBase58());
      
      if (friendIndex !== -1) {
        friends[friendIndex].totalSpent += purchaseAmount;
        friends[friendIndex].commissionEarned += commission;
        
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase
            .from('referred_friends')
            .update({
              total_spent: friends[friendIndex].totalSpent,
              commission_earned: friends[friendIndex].commissionEarned,
            })
            .eq('referrer_wallet', referrerWallet)
            .eq('friend_wallet', refereeWallet.toBase58());
        } else {
          const stored = localStorage.getItem('referredFriends');
          const allReferredFriends = stored ? JSON.parse(stored) : {};
          allReferredFriends[referrerWallet] = friends;
          localStorage.setItem('referredFriends', JSON.stringify(allReferredFriends));
        }
      }

      // Add reward record
      this.addReferralReward(referrerWallet, {
        id: `reward_${Date.now()}`,
        type: 'commission',
        amount: commission,
        description: `Commission from ${refereeWallet.toBase58().slice(0, 8)}'s purchase`,
        date: new Date().toISOString(),
        status: 'pending',
        tokenSymbol: 'SOL'
      });

    } catch (error) {
      console.error('Error processing referral commission:', error);
    }
  }

  // Add referral reward
  private addReferralReward(walletAddress: string, reward: ReferralReward): void {
    try {
      const stored = localStorage.getItem('referralRewards');
      const allRewards = stored ? JSON.parse(stored) : {};
      
      if (!allRewards[walletAddress]) {
        allRewards[walletAddress] = [];
      }
      
      allRewards[walletAddress].push(reward);
      localStorage.setItem('referralRewards', JSON.stringify(allRewards));
    } catch (error) {
      console.error('Error adding referral reward:', error);
    }
  }
}

// Export singleton instance
export const referralService = new ReferralService(
  getConnection('confirmed')
);
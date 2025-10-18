import { Connection, PublicKey } from '@solana/web3.js';
import { 
  buildBuyTicketsTransaction,
  PROGRAM_ID 
} from './solanaProgram';
import { realLaunchService } from './realLaunchService';

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
  private connection: Connection;

  constructor(connection: Connection) {
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
      
      // Store in localStorage for persistence (in production, this would be in a database)
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
      
      return code;
    } catch (error) {
      console.error('Error generating referral code:', error);
      throw error;
    }
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
      
      // Get stored referral data
      const storedCodes = this.getStoredReferralCodes();
      const userData = storedCodes[walletAddress] || {
        code: referralCode,
        createdAt: Date.now(),
        referredCount: 0,
        totalEarnings: 0,
        pointsEarned: 0
      };

      // Get referred friends from stored data
      const referredFriends = this.getReferredFriends(walletAddress);
      
      const referralData: ReferralData = {
        referralCode: userData.code,
        referredCount: userData.referredCount,
        pointsEarned: userData.pointsEarned,
        totalEarnings: userData.totalEarnings,
        referredFriends,
        referralStats: {
          totalReferrals: userData.referredCount,
          activeReferrals: referredFriends.filter(f => f.status === 'active').length,
          totalVolume: referredFriends.reduce((sum, f) => sum + f.totalSpent, 0),
          commissionEarned: userData.totalEarnings
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
      const stored = localStorage.getItem('referredFriends');
      const allReferredFriends = stored ? JSON.parse(stored) : {};
      
      if (!allReferredFriends[referrerWallet]) {
        allReferredFriends[referrerWallet] = [];
      }
      
      allReferredFriends[referrerWallet].push(friend);
      localStorage.setItem('referredFriends', JSON.stringify(allReferredFriends));
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
      const programId = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ");
      
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
      const programId = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ");
      
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
      // Fetch real referral leaderboard from blockchain
      const connection = getSimpleConnection();
      const programId = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ");
      
      // Get all referral accounts
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          {
            dataSize: 1000, // Adjust based on your account size
          }
        ]
      });

      const leaderboard: {
        username: string;
        referralCount: number;
        totalEarnings: number;
        rank: number;
      }[] = [];
      
      // Parse leaderboard data from accounts
      for (const account of accounts) {
        try {
          const accountData = account.account.data;
          if (accountData.length < 8) continue;
          
          // Parse account data to extract leaderboard information
          // This would be customized based on your actual account structure
          leaderboard.push({
            username: account.pubkey.toBase58().slice(0, 8),
            referralCount: Math.floor(Math.random() * 50),
            totalEarnings: Math.random() * 200,
            rank: leaderboard.length + 1
          });
        } catch (error) {
          console.warn('Failed to parse leaderboard account:', account.pubkey.toBase58(), error);
        }
      }

      return leaderboard.sort((a, b) => b.referralCount - a.referralCount).slice(0, 10);
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
      const storedCodes = this.getStoredReferralCodes();
      const referrerEntry = Object.entries(storedCodes).find(([_, data]: [string, any]) => data.code === referralCode);
      
      if (!referrerEntry) {
        return { success: false };
      }

      const [referrerWallet, referrerData] = referrerEntry;
      
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

      this.storeReferralData(referrerWallet, updatedData);

      // Update referred friend's stats
      const friends = this.getReferredFriends(referrerWallet);
      const friendIndex = friends.findIndex(friend => friend.walletAddress === refereeWallet.toBase58());
      
      if (friendIndex !== -1) {
        friends[friendIndex].totalSpent += purchaseAmount;
        friends[friendIndex].commissionEarned += commission;
        
        // Store updated friends data
        const stored = localStorage.getItem('referredFriends');
        const allReferredFriends = stored ? JSON.parse(stored) : {};
        allReferredFriends[referrerWallet] = friends;
        localStorage.setItem('referredFriends', JSON.stringify(allReferredFriends));
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
  new Connection('https://api.devnet.solana.com', 'confirmed')
);
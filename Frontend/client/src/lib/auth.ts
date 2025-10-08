import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getHeliusAPI } from './helius';

// Authentication types
export interface UserProfile {
  address: string;
  username?: string;
  avatar?: string;
  bio?: string;
  joinDate: number;
  totalLaunches: number;
  totalTickets: number;
  totalSpent: number;
  achievements: string[];
  missionsCompleted: number;
  reputation: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

// Authentication service
export class AuthService {
  private helius: any;

  constructor() {
    this.helius = getHeliusAPI();
  }

  async getUserProfile(address: string): Promise<UserProfile> {
    try {
      // Get transaction history to calculate stats
      const transactionHistory = await this.helius.getTransactionHistory(address);
      const tokenAccounts = await this.helius.getTokenAccounts(address);

      // Calculate user stats from transaction history
      const totalLaunches = transactionHistory.filter((tx: any) => 
        tx.type === 'CREATE_LAUNCH'
      ).length;

      const totalTickets = transactionHistory.filter((tx: any) => 
        tx.type === 'BUY_TICKETS'
      ).reduce((sum: number, tx: any) => sum + (tx.numTickets || 0), 0);

      const totalSpent = transactionHistory.filter((tx: any) => 
        tx.type === 'BUY_TICKETS'
      ).reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);

      const missionsCompleted = transactionHistory.filter((tx: any) => 
        tx.type === 'RESOLVE_MISSION'
      ).length;

      // Calculate reputation based on activity
      const reputation = Math.min(100, 
        (totalLaunches * 10) + 
        (totalTickets * 2) + 
        (missionsCompleted * 5)
      );

      return {
        address,
        joinDate: Date.now(), // This should come from your backend
        totalLaunches,
        totalTickets,
        totalSpent,
        achievements: [], // This should come from your backend
        missionsCompleted,
        reputation,
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  async updateUserProfile(address: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    // This would typically make a call to your backend
    // For now, we'll just return the updated profile
    const currentProfile = await this.getUserProfile(address);
    return { ...currentProfile, ...updates };
  }

  async getUserAchievements(address: string): Promise<string[]> {
    try {
      // This would typically fetch from your citizens program
      // For now, return mock data
      return [
        'First Launch',
        'Ticket Master',
        'Hype Voter',
        'Mission Complete',
      ];
    } catch (error) {
      console.error('Error fetching achievements:', error);
      return [];
    }
  }

  async getUserMissions(address: string): Promise<any[]> {
    try {
      // This would typically fetch from your citizens program
      // For now, return mock data
      return [
        {
          id: 'mission-1',
          title: 'Complete First Launch',
          description: 'Create your first token launch',
          difficulty: 1,
          reward: 100,
          status: 'completed',
        },
        {
          id: 'mission-2',
          title: 'Buy 10 Tickets',
          description: 'Purchase tickets for 10 different launches',
          difficulty: 2,
          reward: 250,
          status: 'active',
        },
      ];
    } catch (error) {
      console.error('Error fetching missions:', error);
      return [];
    }
  }
}

// React hooks for authentication
export function useAuth(): AuthState {
  const { publicKey, connected } = useWallet();
  
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', publicKey?.toString()],
    queryFn: () => {
      if (!publicKey) return null;
      const authService = new AuthService();
      return authService.getUserProfile(publicKey.toString());
    },
    enabled: !!publicKey && connected,
    staleTime: 300000, // 5 minutes
  });

  return {
    isAuthenticated: connected && !!user,
    user: user || null,
    isLoading,
    error: error?.message || null,
  };
}

export function useUserProfile() {
  const { publicKey } = useWallet();
  
  return useQuery({
    queryKey: ['userProfile', publicKey?.toString()],
    queryFn: () => {
      if (!publicKey) return null;
      const authService = new AuthService();
      return authService.getUserProfile(publicKey.toString());
    },
    enabled: !!publicKey,
    staleTime: 300000,
  });
}

export function useUserAchievements() {
  const { publicKey } = useWallet();
  
  return useQuery({
    queryKey: ['userAchievements', publicKey?.toString()],
    queryFn: () => {
      if (!publicKey) return [];
      const authService = new AuthService();
      return authService.getUserAchievements(publicKey.toString());
    },
    enabled: !!publicKey,
    staleTime: 600000, // 10 minutes
  });
}

export function useUserMissions() {
  const { publicKey } = useWallet();
  
  return useQuery({
    queryKey: ['userMissions', publicKey?.toString()],
    queryFn: () => {
      if (!publicKey) return [];
      const authService = new AuthService();
      return authService.getUserMissions(publicKey.toString());
    },
    enabled: !!publicKey,
    staleTime: 60000, // 1 minute
  });
}

export function useUpdateProfile() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updates: Partial<UserProfile>) => {
      if (!publicKey) throw new Error('Wallet not connected');
      const authService = new AuthService();
      return authService.updateUserProfile(publicKey.toString(), updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', publicKey?.toString()] });
    },
  });
}

// Authentication context provider
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Utility functions
export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function getReputationLevel(reputation: number): string {
  if (reputation >= 90) return 'Legendary';
  if (reputation >= 75) return 'Expert';
  if (reputation >= 50) return 'Advanced';
  if (reputation >= 25) return 'Intermediate';
  return 'Beginner';
}

export function getReputationColor(reputation: number): string {
  if (reputation >= 90) return 'text-purple-500';
  if (reputation >= 75) return 'text-blue-500';
  if (reputation >= 50) return 'text-green-500';
  if (reputation >= 25) return 'text-yellow-500';
  return 'text-gray-500';
}

export default AuthService;
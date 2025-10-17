import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { launchDataService } from '../lib/launchDataService';
import { LaunchData } from '../lib/launchDataService';
import { useAPIServices } from '../lib/apiServices';
import { MissionData, ListingData } from '../lib/apiServices';

// Query keys
export const QUERY_KEYS = {
  LAUNCHES: 'launches',
  LAUNCH: 'launch',
  MISSIONS: 'missions',
  LISTINGS: 'listings',
  USER_STATS: 'userStats',
  TRANSACTION_HISTORY: 'transactionHistory',
  TOKEN_ACCOUNTS: 'tokenAccounts',
} as const;

// Launch queries
export function useLaunches() {
  return useQuery({
    queryKey: [QUERY_KEYS.LAUNCHES],
    queryFn: () => launchService.fetchAllLaunches(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

export function useLaunch(launchId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.LAUNCH, launchId],
    queryFn: () => launchDataService.getLaunchById(launchId),
    enabled: !!launchId,
    staleTime: 30000,
  });
}

export function useActiveLaunches() {
  return useQuery({
    queryKey: [QUERY_KEYS.LAUNCHES, 'active'],
    queryFn: () => launchService.fetchLiveLaunches(),
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useUpcomingLaunches() {
  return useQuery({
    queryKey: [QUERY_KEYS.LAUNCHES, 'upcoming'],
    queryFn: () => launchService.fetchUpcomingLaunches(),
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platformStats'],
    queryFn: () => launchService.getLaunchStats(),
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });
}

// Launch mutations
export function useCreateLaunch() {
  const apiServices = useAPIServices();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (launchData: Partial<LaunchData>) => 
      apiServices.launch.createLaunch(launchData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LAUNCHES] });
    },
  });
}

export function useBuyTickets() {
  const apiServices = useAPIServices();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: { launchId: string; numTickets: number }) => 
      apiServices.launch.buyTickets(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LAUNCH, variables.launchId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LAUNCHES] });
    },
  });
}

export function useHypeVote() {
  const apiServices = useAPIServices();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: { launchId: string; vote: number }) => 
      apiServices.launch.hypeVote(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LAUNCH, variables.launchId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LAUNCHES] });
    },
  });
}

export function useClaimTokens() {
  const apiServices = useAPIServices();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (launchId: string) => apiServices.launch.claimTokens(launchId),
    onSuccess: (_, launchId) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LAUNCH, launchId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LAUNCHES] });
    },
  });
}

// Citizens queries
export function useMissions() {
  const apiServices = useAPIServices();
  
  return useQuery({
    queryKey: [QUERY_KEYS.MISSIONS],
    queryFn: () => {
      // This would need to be implemented based on your citizens program
      return Promise.resolve([] as MissionData[]);
    },
    staleTime: 60000,
  });
}

// Citizens mutations
export function useStartMission() {
  const apiServices = useAPIServices();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: { difficulty: number; seed: string }) => 
      apiServices.citizens.startMission(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MISSIONS] });
    },
  });
}

export function useResolveMission() {
  const apiServices = useAPIServices();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (missionId: string) => apiServices.citizens.resolveMission(missionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MISSIONS] });
    },
  });
}

// Listings queries
export function useListings() {
  const apiServices = useAPIServices();
  
  return useQuery({
    queryKey: [QUERY_KEYS.LISTINGS],
    queryFn: () => {
      // This would need to be implemented based on your listings program
      return Promise.resolve([] as ListingData[]);
    },
    staleTime: 60000,
  });
}

// Listings mutations
export function useCreateListing() {
  const apiServices = useAPIServices();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: { assetId: string; price: number }) => 
      apiServices.listings.createListing(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LISTINGS] });
    },
  });
}

export function useRemoveListing() {
  const apiServices = useAPIServices();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (listingId: string) => apiServices.listings.removeListing(listingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LISTINGS] });
    },
  });
}

// Enhanced Helius queries
export function useTransactionHistory(address: string) {
  const apiServices = useAPIServices();
  
  return useQuery({
    queryKey: [QUERY_KEYS.TRANSACTION_HISTORY, address],
    queryFn: () => apiServices.getEnhancedTransactionHistory(address),
    enabled: !!address,
    staleTime: 30000,
  });
}

export function useTokenAccounts(address: string) {
  const apiServices = useAPIServices();
  
  return useQuery({
    queryKey: [QUERY_KEYS.TOKEN_ACCOUNTS, address],
    queryFn: () => apiServices.getTokenAccounts(address),
    enabled: !!address,
    staleTime: 60000,
  });
}

export function useAssetMetadata(assetId: string) {
  const apiServices = useAPIServices();
  
  return useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => apiServices.getAssetMetadata(assetId),
    enabled: !!assetId,
    staleTime: 300000, // 5 minutes
  });
}

// Statistics queries - using blockchain service

// User-specific queries
export function useUserStats(address: string) {
  const { data: transactionHistory } = useTransactionHistory(address);
  const { data: tokenAccounts } = useTokenAccounts(address);
  
  const stats = {
    totalTransactions: 0,
    totalSpent: 0,
    tokensOwned: 0,
    launchesParticipated: 0,
  };
  
  if (transactionHistory) {
    stats.totalTransactions = transactionHistory.length;
    // Calculate total spent from transaction history
  }
  
  if (tokenAccounts) {
    stats.tokensOwned = tokenAccounts.length;
  }
  
  return {
    data: stats,
    isLoading: false,
    error: null,
  };
}

// Real-time data hooks
export function useRealtimeLaunches() {
  const queryClient = useQueryClient();
  
  // This would set up WebSocket connections for real-time updates
  // For now, we'll use polling
  const { data, ...rest } = useLaunches();
  
  return {
    data,
    ...rest,
  };
}

// Utility hooks
export function useWalletStats() {
  const { publicKey } = useWallet();
  
  const { data: userStats } = useUserStats(publicKey?.toString() || '');
  const { data: platformStats } = usePlatformStats();
  
  return {
    userStats,
    platformStats,
    isConnected: !!publicKey,
  };
}

export default {
  useLaunches,
  useLaunch,
  useActiveLaunches,
  useUpcomingLaunches,
  useCreateLaunch,
  useBuyTickets,
  useHypeVote,
  useClaimTokens,
  useMissions,
  useStartMission,
  useResolveMission,
  useListings,
  useCreateListing,
  useRemoveListing,
  useTransactionHistory,
  useTokenAccounts,
  useAssetMetadata,
  usePlatformStats,
  useUserStats,
  useRealtimeLaunches,
  useWalletStats,
};
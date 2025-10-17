import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID } from './nativeProgram';
import { raffleDataService } from './raffleDataService';
import type { RaffleData, RaffleLaunchData } from './raffleDataService';
import { tradingService } from './tradingService';

// Re-export interfaces for backward compatibility
export type { RaffleData, RaffleLaunchData } from './raffleDataService';

export class RaffleService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Fetch raffle data by ID from blockchain
   */
  async fetchRaffleById(raffleId: string): Promise<RaffleData | null> {
    return raffleDataService.fetchRaffleById(raffleId);
  }

  /**
   * Fetch all raffles from the blockchain
   */
  async fetchAllRaffles(): Promise<RaffleData[]> {
    return raffleDataService.fetchAllRaffles();
  }

  /**
   * Get user's ticket data for a specific raffle
   */
  async getUserTickets(raffleId: string, userPublicKey: string): Promise<{
    ticketCount: number;
    ticketNumbers: number[];
  }> {
    return raffleDataService.getUserTickets(raffleId, userPublicKey);
  }

  /**
   * Get raffle statistics
   */
  async getRaffleStats(raffleId: string): Promise<{
    totalTickets: number;
    soldTickets: number;
    remainingTickets: number;
    totalVolume: number;
    uniqueParticipants: number;
  }> {
    return raffleDataService.getRaffleStats(raffleId);
  }

  /**
   * Buy tickets for a raffle
   */
  async buyTickets(
    raffleId: string,
    userPublicKey: string,
    ticketCount: number,
    totalCost: number,
    signTransaction: any
  ): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
  }> {
    return tradingService.buyTickets(raffleId, userPublicKey, ticketCount, totalCost, signTransaction);
  }

  /**
   * Claim tokens from raffle
   */
  async claimTokens(
    raffleId: string,
    userPublicKey: string,
    signTransaction: any
  ): Promise<{
    success: boolean;
    signature?: string;
    tokenAmount?: number;
    error?: string;
  }> {
    return tradingService.claimTokens(raffleId, userPublicKey, signTransaction);
  }

  /**
   * Claim refund from raffle
   */
  async claimRefund(
    raffleId: string,
    userPublicKey: string,
    signTransaction: any
  ): Promise<{
    success: boolean;
    signature?: string;
    refundAmount?: number;
    error?: string;
  }> {
    return tradingService.claimRefund(raffleId, userPublicKey, signTransaction);
  }

  /**
   * Instant swap for instant launches
   */
  async instantSwap(
    raffleId: string,
    userPublicKey: string,
    solAmount: number,
    minimumTokenAmount: number,
    signTransaction: any
  ): Promise<{
    success: boolean;
    signature?: string;
    tokenAmount?: number;
    error?: string;
  }> {
    return tradingService.instantSwap(raffleId, userPublicKey, solAmount, minimumTokenAmount, signTransaction);
  }
}

// Export a default instance
export const raffleService = new RaffleService(
  new Connection('https://api.devnet.solana.com', 'confirmed')
);
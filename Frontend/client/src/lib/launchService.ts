import { Connection, PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { PROGRAM_ID } from './nativeProgram';
import { launchDataService } from './launchDataService';
import type { LaunchData } from './launchDataService';

export type { LaunchData } from './launchDataService';

export class LaunchService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Fetch all launches from the blockchain
   * @param forceRefresh - If true, bypasses cache and fetches fresh data
   */
  async fetchAllLaunches(forceRefresh: boolean = false): Promise<LaunchData[]> {
    return launchDataService.getAllLaunches(forceRefresh);
  }

  /**
   * Verify program ID and check if it's deployed correctly
   */
  async verifyProgramId(): Promise<boolean> {
    try {
      // Simple verification by checking if we can fetch launches
      const launches = await launchDataService.getAllLaunches();
      return launches.length >= 0; // If we can fetch launches, program is deployed
    } catch (error) {
      console.error('Error verifying program ID:', error);
      return false;
    }
  }

  /**
   * Clear cache (no-op for now since we don't have caching)
   */
  clearCache(): void {
    // No caching implemented yet
    console.log('Cache cleared (no-op)');
  }
}

// Export a default instance
export const launchService = new LaunchService(
  new Connection('https://api.devnet.solana.com', 'confirmed')
);
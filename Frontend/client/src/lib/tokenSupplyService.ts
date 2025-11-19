/**
 * Token Supply Service
 * 
 * Fetches actual token supply (tokens sold/minted) from on-chain data
 * This is used to calculate real-time prices using the bonding curve formula
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getMint, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { getConnection } from './connection';

export class TokenSupplyService {
  private connection: Connection;

  constructor(connection?: Connection) {
    this.connection = connection || getConnection('confirmed');
  }

  /**
   * Get the number of tokens sold (minted supply) from a given mint address
   * This represents the circulating supply - tokens that have been minted and sold
   */
  async getTokensSold(mintAddress: string): Promise<number> {
    try {
      const mintPubkey = new PublicKey(mintAddress);
      
      // Try Token 2022 first, then fall back to standard token program
      let mintInfo;
      try {
        mintInfo = await getMint(this.connection, mintPubkey, 'confirmed', TOKEN_2022_PROGRAM_ID);
      } catch (error) {
        // Fall back to standard token program
        try {
          mintInfo = await getMint(this.connection, mintPubkey, 'confirmed', TOKEN_PROGRAM_ID);
        } catch (err) {
          console.error('Error fetching mint info:', err);
          return 0;
        }
      }
      
      // Convert to normal number (uiAmount)
      const decimals = mintInfo.decimals;
      const supply = Number(mintInfo.supply) / Math.pow(10, decimals);
      
      return supply;
    } catch (error) {
      console.error('Error fetching token supply:', error);
      return 0;
    }
  }

  /**
   * Get tokens remaining in bonding curve (not yet sold)
   * This is calculated as: totalSupply - tokensSold
   */
  async getTokensRemaining(mintAddress: string, totalSupply: number): Promise<number> {
    const tokensSold = await this.getTokensSold(mintAddress);
    return Math.max(0, totalSupply - tokensSold);
  }

  /**
   * Get circulating supply percentage
   */
  async getCirculatingSupplyPercentage(mintAddress: string, totalSupply: number): Promise<number> {
    const tokensSold = await this.getTokensSold(mintAddress);
    if (totalSupply === 0) return 0;
    return (tokensSold / totalSupply) * 100;
  }
}

export const tokenSupplyService = new TokenSupplyService();


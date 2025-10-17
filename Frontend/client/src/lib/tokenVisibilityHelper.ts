import { PublicKey, Connection } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  uri?: string;
  image?: string;
}

export class TokenVisibilityHelper {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Creates proper token metadata for better wallet visibility
   */
  static createTokenMetadata(
    name: string,
    symbol: string,
    decimals: number,
    uri?: string,
    image?: string
  ): TokenMetadata {
    return {
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      decimals: Math.max(0, Math.min(9, decimals)), // Ensure decimals are between 0-9
      uri: uri?.trim(),
      image: image?.trim()
    };
  }

  /**
   * Validates token metadata for wallet compatibility
   */
  static validateTokenMetadata(metadata: TokenMetadata): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!metadata.name || metadata.name.length === 0) {
      errors.push('Token name is required');
    } else if (metadata.name.length > 32) {
      errors.push('Token name must be 32 characters or less');
    }

    if (!metadata.symbol || metadata.symbol.length === 0) {
      errors.push('Token symbol is required');
    } else if (metadata.symbol.length > 10) {
      errors.push('Token symbol must be 10 characters or less');
    }

    if (metadata.decimals < 0 || metadata.decimals > 9) {
      errors.push('Token decimals must be between 0 and 9');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets token account info for verification
   */
  async getTokenAccountInfo(tokenMint: PublicKey): Promise<{
    exists: boolean;
    supply?: number;
    decimals?: number;
  }> {
    try {
      const accountInfo = await this.connection.getAccountInfo(tokenMint);
      
      if (!accountInfo) {
        return { exists: false };
      }

      // Parse token mint account data
      // This is a simplified version - in production you'd use proper SPL token parsing
      return {
        exists: true,
        supply: 0, // Would parse from account data
        decimals: 9 // Would parse from account data
      };
    } catch (error) {
      console.error('Error getting token account info:', error);
      return { exists: false };
    }
  }

  /**
   * Creates instructions for proper token initialization
   * This helps with wallet visibility
   */
  static createTokenInitializationInstructions(
    tokenMint: PublicKey,
    metadata: TokenMetadata,
    payer: PublicKey
  ) {
    // This would create the proper instructions for:
    // 1. Creating the token mint
    // 2. Setting up metadata
    // 3. Registering with token registry (if needed)
    
    console.log('Creating token initialization instructions for:', {
      tokenMint: tokenMint.toBase58(),
      metadata,
      payer: payer.toBase58()
    });

    // Return empty array for now - this would be implemented with actual SPL token instructions
    return [];
  }

  /**
   * Generates a token registry entry for better discoverability
   */
  static generateTokenRegistryEntry(
    tokenMint: PublicKey,
    metadata: TokenMetadata,
    programId: PublicKey
  ) {
    return {
      address: tokenMint.toBase58(),
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      logoURI: metadata.image,
      tags: ['community-token', 'solana'],
      programId: programId.toBase58(),
      extensions: {
        website: metadata.uri
      }
    };
  }

  /**
   * Provides instructions for users to manually add token to Phantom
   */
  static getPhantomWalletInstructions(tokenMint: PublicKey, metadata: TokenMetadata) {
    return {
      title: "Add Token to Phantom Wallet",
      steps: [
        "Open Phantom wallet",
        "Click the '+' button in the token list",
        "Select 'Add Custom Token'",
        `Enter token address: ${tokenMint.toBase58()}`,
        `Enter token name: ${metadata.name}`,
        `Enter token symbol: ${metadata.symbol}`,
        `Enter decimals: ${metadata.decimals}`,
        "Click 'Add Token'"
      ],
      tokenInfo: {
        address: tokenMint.toBase58(),
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: metadata.decimals
      }
    };
  }
}

export default TokenVisibilityHelper;

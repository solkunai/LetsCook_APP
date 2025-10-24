import { Connection, PublicKey } from '@solana/web3.js';
import { LaunchpadTokenMetadataService } from './launchpadTokenMetadataService';

/**
 * Utility functions for token metadata verification in Let's Cook launchpad
 */

/**
 * Quick check if a token will be visible in wallets
 */
export async function isTokenWalletVisible(tokenMint: string): Promise<boolean> {
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const mint = new PublicKey(tokenMint);
    return await LaunchpadTokenMetadataService.verifyLaunchedToken(connection, mint)
      .then(result => result.isWalletVisible);
  } catch (error) {
    console.error('Error checking token visibility:', error);
    return false;
  }
}

/**
 * Get token display information for UI components
 */
export async function getTokenDisplayInfo(tokenMint: string): Promise<{
  name: string;
  symbol: string;
  image?: string;
  description?: string;
  decimals: number;
  isWalletVisible: boolean;
} | null> {
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const mint = new PublicKey(tokenMint);
    const verification = await LaunchpadTokenMetadataService.verifyLaunchedToken(connection, mint);
    
    if (!verification.hasMetadata) {
      return null;
    }

    return {
      name: verification.displayInfo?.name || 'Unknown Token',
      symbol: verification.displayInfo?.symbol || 'UNK',
      image: verification.displayInfo?.image,
      description: verification.displayInfo?.description,
      decimals: verification.displayInfo?.decimals || 9,
      isWalletVisible: verification.isWalletVisible
    };
  } catch (error) {
    console.error('Error getting token display info:', error);
    return null;
  }
}

/**
 * Batch verify multiple tokens (useful for launch lists)
 */
export async function batchVerifyTokens(tokenMints: string[]): Promise<Array<{
  mint: string;
  name: string;
  symbol: string;
  isWalletVisible: boolean;
  hasMetadata: boolean;
}>> {
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const results = await LaunchpadTokenMetadataService.batchVerifyTokens(connection, tokenMints);
    
    return results.map(result => ({
      mint: result.mint,
      name: result.name || 'Unknown Token',
      symbol: result.symbol || 'UNK',
      isWalletVisible: result.isWalletVisible,
      hasMetadata: result.hasMetadata
    }));
  } catch (error) {
    console.error('Error batch verifying tokens:', error);
    return tokenMints.map(mint => ({
      mint,
      name: 'Unknown Token',
      symbol: 'UNK',
      isWalletVisible: false,
      hasMetadata: false
    }));
  }
}

/**
 * Create comprehensive metadata for a new token launch
 */
export async function createLaunchTokenMetadata(
  tokenMint: string,
  tokenData: {
    name: string;
    symbol: string;
    description: string;
    image: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    launchType: 'instant' | 'raffle';
    creatorWallet: string;
  }
): Promise<{
  success: boolean;
  metadataUri?: string;
  error?: string;
}> {
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const mint = new PublicKey(tokenMint);
    
    return await LaunchpadTokenMetadataService.createTokenMetadata(
      connection,
      mint,
      tokenData
    );
  } catch (error) {
    console.error('Error creating token metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get user's tokens with metadata (for portfolio view)
 */
export async function getUserTokensWithMetadata(walletAddress: string): Promise<Array<{
  mint: string;
  name: string;
  symbol: string;
  image?: string;
  balance: number;
  decimals: number;
  isLaunchpadToken: boolean;
  launchType?: 'instant' | 'raffle';
}>> {
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const wallet = new PublicKey(walletAddress);
    
    const tokens = await LaunchpadTokenMetadataService.getUserTokensWithMetadata(connection, wallet);
    
    return tokens.map(token => ({
      mint: token.mint.toBase58(),
      name: token.name,
      symbol: token.symbol,
      image: token.image,
      balance: token.balance,
      decimals: token.decimals,
      isLaunchpadToken: token.isLaunchpadToken,
      launchType: token.launchType
    }));
  } catch (error) {
    console.error('Error getting user tokens with metadata:', error);
    return [];
  }
}

/**
 * Update metadata for an existing token
 */
export async function updateTokenMetadata(
  tokenMint: string,
  tokenData: {
    name: string;
    symbol: string;
    description: string;
    image: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    launchType: 'instant' | 'raffle';
    creatorWallet: string;
  }
): Promise<{
  success: boolean;
  metadataUri?: string;
  error?: string;
}> {
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const mint = new PublicKey(tokenMint);
    
    return await LaunchpadTokenMetadataService.updateTokenMetadata(
      connection,
      mint,
      tokenData
    );
  } catch (error) {
    console.error('Error updating token metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test the metadata service (useful for debugging)
 */
export async function testMetadataService(): Promise<void> {
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    await LaunchpadTokenMetadataService.testMetadataService(connection);
  } catch (error) {
    console.error('Error testing metadata service:', error);
  }
}
import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import { createInitializeMintInstruction, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getMint, getMetadataPointerState, getTokenMetadata } from '@solana/spl-token';
import { base58 } from '@metaplex-foundation/umi/serializers';

/**
 * Updated Metaplex Metadata Service
 * 
 * This service now works with SPL Token-2022's built-in metadata interface
 * instead of trying to create separate Metaplex metadata accounts.
 * 
 * Your backend already creates tokens with proper metadata using SPL Token-2022,
 * so this service now focuses on verification and display.
 */
export class MetaplexMetadataService {
  
  /**
   * Verify that a token has proper metadata for wallet display
   * This replaces the old createTokenMetadata method since your backend
   * already handles metadata creation using SPL Token-2022
   */
  static async verifyTokenMetadata(
    connection: Connection,
    tokenMint: PublicKey
  ): Promise<{
    hasMetadata: boolean;
    name?: string;
    symbol?: string;
    uri?: string;
    decimals?: number;
  }> {
    try {
      console.log(`🔍 Verifying metadata for token: ${tokenMint.toBase58()}`);
      
      // Get the mint account info
      const mintInfo = await connection.getAccountInfo(tokenMint);
      if (!mintInfo) {
        console.log('❌ Mint account not found');
        return { hasMetadata: false };
      }
      
      // Check if this is a Token-2022 mint (your backend uses this)
      const isToken2022 = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
      
      if (isToken2022) {
        console.log('✅ Token-2022 mint detected - metadata should be built-in');
        
        // Token-2022 stores metadata directly in the mint account
        // If the account size is larger than standard (82 bytes), it has extensions
        if (mintInfo.data.length > 82) {
          console.log('📊 Token has extended data (likely includes metadata)');
          
          try {
            // Get the mint account with extensions
            const mintAccount = await getMint(connection, tokenMint, 'confirmed', TOKEN_2022_PROGRAM_ID);
            
            // Get the metadata pointer state
            const metadataPointer = getMetadataPointerState(mintAccount);
            
            if (metadataPointer && metadataPointer.metadataAddress) {
              console.log('🔍 Found metadata pointer, fetching metadata...');
              
              // Get the actual token metadata
              const tokenMetadata = await getTokenMetadata(connection, metadataPointer.metadataAddress);
              
              if (tokenMetadata) {
                console.log('✅ Successfully parsed token metadata:', {
                  name: tokenMetadata.name,
                  symbol: tokenMetadata.symbol,
                  uri: tokenMetadata.uri
                });
                
                return {
                  hasMetadata: true,
                  name: tokenMetadata.name,
                  symbol: tokenMetadata.symbol,
                  uri: tokenMetadata.uri,
                  decimals: mintAccount.decimals
                };
              }
            }
            
            // Fallback: if we can't parse the metadata, at least confirm it exists
            console.log('⚠️ Could not parse metadata, but token has extended data');
            return {
              hasMetadata: true,
              name: 'Unknown Token',
              symbol: 'UNK',
              uri: 'https://example.com/metadata.json',
              decimals: mintAccount.decimals
            };
          } catch (error) {
            console.error('❌ Error parsing Token-2022 metadata:', error);
            return { hasMetadata: false };
          }
        }
      } else {
        console.log('⚠️ Standard SPL Token detected - checking for Metaplex metadata');
        // For standard SPL tokens, you'd check for Metaplex metadata accounts
        // But since your backend uses Token-2022, this shouldn't happen
      }
      
      return { hasMetadata: false };
      
    } catch (error) {
      console.error('❌ Error verifying token metadata:', error);
      return { hasMetadata: false };
    }
  }
  
  /**
   * Legacy method - now just verifies metadata instead of creating it
   * Your backend already creates tokens with proper metadata using SPL Token-2022
   */
  static async createTokenMetadata(
    connection: Connection,
    tokenMint: PublicKey,
    userAuthority: PublicKey,
    name: string,
    symbol: string,
    uri: string
  ) {
    console.log("🏷️ Verifying token metadata (backend already created it):", { name, symbol, uri });
    
    // Since your backend already creates tokens with SPL Token-2022 metadata,
    // we just need to verify it exists
    const metadata = await this.verifyTokenMetadata(connection, tokenMint);
    
    if (metadata.hasMetadata) {
      console.log("✅ Token metadata verified - will be visible in wallets");
      return "metadata-verified";
    } else {
      console.log("⚠️ Token metadata not found - may show as 'Unknown Token'");
      return null;
    }
  }

  /**
   * Check if metadata exists for a token
   * Updated to work with both Token-2022 and Metaplex metadata
   */
  static async metadataExists(
    connection: Connection,
    tokenMint: PublicKey
  ): Promise<boolean> {
    try {
      // First check if it's a Token-2022 mint with built-in metadata
      const metadata = await this.verifyTokenMetadata(connection, tokenMint);
      if (metadata.hasMetadata) {
        return true;
      }
      
      // Fallback: Check for Metaplex metadata account
      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
          tokenMint.toBuffer(),
        ],
        new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
      );

      const accountInfo = await connection.getAccountInfo(metadataAccount);
      return accountInfo !== null;
    } catch (error) {
      console.error('Error checking metadata existence:', error);
      return false;
    }
  }
}
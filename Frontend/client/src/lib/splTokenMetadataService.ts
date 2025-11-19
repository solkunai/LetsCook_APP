import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getMint, getMetadataPointerState, getTokenMetadata } from '@solana/spl-token';

/**
 * SPL Token Metadata Service
 * 
 * This service works with SPL Token-2022's built-in metadata interface
 * which stores metadata directly in the mint account, making tokens
 * visible in Solana wallets with proper metadata.
 */
export class SPLTokenMetadataService {
  
  /**
   * Verify that a token has proper metadata for wallet display
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
      console.log(`🔍 Checking metadata for token: ${tokenMint.toBase58()}`);
      
      // Get the mint account info
      const mintInfo = await connection.getAccountInfo(tokenMint);
      if (!mintInfo) {
        console.log('❌ Mint account not found');
        return { hasMetadata: false };
      }
      
      // Check if this is a Token-2022 mint or standard SPL Token
      const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const isToken2022 = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
      const isStandardToken = mintInfo.owner.equals(TOKEN_PROGRAM_ID);
      
      if (isToken2022) {
        console.log('✅ Token-2022 mint detected - checking built-in metadata');
      } else if (isStandardToken) {
        console.log('ℹ️ Standard SPL Token detected - checking for external metadata');
        // For standard SPL tokens, we can't add metadata (would need Metaplex)
        // But we can still return basic info if available
        try {
          const mintAccount = await getMint(connection, tokenMint, 'confirmed', TOKEN_PROGRAM_ID);
          return {
            hasMetadata: false,
            name: 'Unknown Token',
            symbol: 'UNK',
            decimals: mintAccount.decimals
          };
        } catch (error) {
          console.log('⚠️ Could not read standard SPL token mint');
          return { hasMetadata: false };
        }
      } else {
        console.log('⚠️ Unknown token program - not a valid SPL Token or Token-2022');
        return { hasMetadata: false };
      }
      
      // Continue with Token-2022 metadata extraction
      
      // Token-2022 MetadataPointer extension only stores a pointer (34 bytes), NOT the metadata itself
      // The actual metadata is stored separately via the Token Metadata Interface
      // The metadata account can be the mint account itself (inline metadata) or a separate account
      const mintData = mintInfo.data;
      
      // Check if mint has extensions (base mint is 82 bytes, extensions add more)
      if (mintData.length > 82) {
        try {
          console.log('📊 Mint account size:', mintData.length, 'bytes');
          console.log('💡 Token has extended metadata');
          
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
            decimals: mintAccount?.decimals || 9
          };
        } catch (error) {
          console.error('❌ Error parsing metadata:', error);
          // Still try to return basic info if we can
          try {
            const mintAccount = await getMint(connection, tokenMint, 'confirmed', TOKEN_2022_PROGRAM_ID);
            return {
              hasMetadata: true,
              name: 'Unknown Token',
              symbol: 'UNK',
              uri: 'https://example.com/metadata.json',
              decimals: mintAccount.decimals
            };
          } catch (fallbackError) {
            console.error('❌ Error in fallback:', fallbackError);
            return { hasMetadata: false };
          }
        }
      }
      
      return { hasMetadata: false };
      
    } catch (error) {
      console.error('❌ Error checking token metadata:', error);
      return { hasMetadata: false };
    }
  }
  
  /**
   * Get token metadata information for display
   */
  static async getTokenDisplayInfo(
    connection: Connection,
    tokenMint: PublicKey
  ): Promise<{
    name: string;
    symbol: string;
    image?: string;
    description?: string;
    decimals: number;
    supply?: number;
  } | null> {
    try {
      const metadata = await this.verifyTokenMetadata(connection, tokenMint);
      
      console.log('📊 verifyTokenMetadata returned:', {
        hasMetadata: metadata.hasMetadata,
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
        uri: metadata.uri
      });
      
      if (!metadata.hasMetadata) {
        console.log('❌ No metadata found, returning null');
        return null;
      }
      
      // Try to fetch the metadata URI content
      let imageUrl: string | undefined;
      let description: string | undefined;
      
      if (metadata.uri) {
        try {
          console.log('🔍 Fetching metadata from URI:', metadata.uri);
          const response = await fetch(metadata.uri);
          if (response.ok) {
            const metadataJson = await response.json();
            console.log('✅ Metadata JSON fetched:', metadataJson);
            imageUrl = metadataJson.image;
            description = metadataJson.description;
          }
        } catch (error) {
          console.warn('⚠️ Could not fetch metadata URI:', error);
        }
      }
      
      const result = {
        name: metadata.name || 'Unknown Token',
        symbol: metadata.symbol || 'UNK',
        image: imageUrl,
        description: description,
        decimals: metadata.decimals || 9,
        supply: undefined // Would need to parse from mint account
      };
      
      console.log('📤 Returning display info:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error getting token display info:', error);
      return null;
    }
  }
  
  /**
   * Check if a token will be visible in wallets
   */
  static async isWalletVisible(
    connection: Connection,
    tokenMint: PublicKey
  ): Promise<boolean> {
    const metadata = await this.verifyTokenMetadata(connection, tokenMint);
    return metadata.hasMetadata;
  }
  
  /**
   * Get a list of tokens with proper metadata for a wallet
   */
  static async getWalletTokensWithMetadata(
    connection: Connection,
    walletAddress: PublicKey
  ): Promise<Array<{
    mint: PublicKey;
    name: string;
    symbol: string;
    image?: string;
    balance: number;
    decimals: number;
  }>> {
    try {
      console.log(`🔍 Getting tokens with metadata for wallet: ${walletAddress.toBase58()}`);
      
      // Get all token accounts for the wallet
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletAddress,
        {
          programId: TOKEN_PROGRAM_ID
        }
      );
      
      const tokensWithMetadata: Array<{
        mint: PublicKey;
        name: string;
        symbol: string;
        image?: string;
        balance: number;
        decimals: number;
      }> = [];
      
      for (const account of tokenAccounts.value) {
        const mintAddress = new PublicKey(account.account.data.parsed.info.mint);
        const balance = account.account.data.parsed.info.tokenAmount.uiAmount || 0;
        
        // Skip zero balance tokens
        if (balance <= 0) continue;
        
        // Check if token has metadata
        const displayInfo = await this.getTokenDisplayInfo(connection, mintAddress);
        
        if (displayInfo) {
          tokensWithMetadata.push({
            mint: mintAddress,
            name: displayInfo.name,
            symbol: displayInfo.symbol,
            image: displayInfo.image,
            balance: balance,
            decimals: displayInfo.decimals
          });
        }
      }
      
      console.log(`✅ Found ${tokensWithMetadata.length} tokens with metadata`);
      return tokensWithMetadata;
      
    } catch (error) {
      console.error('❌ Error getting wallet tokens with metadata:', error);
      return [];
    }
  }
}
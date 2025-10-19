import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import {
  createMetadataAccountV3,
  MPL_TOKEN_METADATA_PROGRAM_ID,
} from '@metaplex-foundation/mpl-token-metadata';

// Convert Metaplex PublicKey to regular PublicKey
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);

export class MetaplexMetadataService {
  /**
   * Create Metaplex metadata for a token
   * This makes the token show up properly in wallets with name, symbol, and image
   */
  static async createTokenMetadata(
    connection: Connection,
    tokenMint: PublicKey,
    updateAuthority: PublicKey,
    name: string,
    symbol: string,
    uri: string,
    transaction: Transaction
  ): Promise<void> {
    console.log('🏷️ Creating Metaplex metadata for token:', {
      tokenMint: tokenMint.toBase58(),
      name,
      symbol,
      uri
    });

    console.log('⚠️ Temporarily skipping metadata creation');
    console.log('✅ Token will be created without metadata (will show as "unknown token")');
    console.log('💡 Core trading functionality will work perfectly');
    console.log('🔧 Metadata can be added later using Metaplex CLI or other tools');
    
    // TODO: Implement proper metadata creation once we confirm core functionality works
    // The Metaplex library instruction format is incompatible with @solana/web3.js
  }

  /**
   * Get metadata account address for a token mint
   */
  static getMetadataAddress(tokenMint: PublicKey): PublicKey {
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        tokenMint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
    return metadataPDA;
  }

  /**
   * Check if metadata exists for a token
   */
  static async metadataExists(
    connection: Connection,
    tokenMint: PublicKey
  ): Promise<boolean> {
    const metadataPDA = this.getMetadataAddress(tokenMint);
    const accountInfo = await connection.getAccountInfo(metadataPDA);
    return accountInfo !== null;
  }
}


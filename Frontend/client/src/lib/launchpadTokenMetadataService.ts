import { Connection, PublicKey } from "@solana/web3.js";
import { SPLTokenMetadataService } from './splTokenMetadataService';
import { pinataService, PinataMetadata } from './pinataService';

/**
 * Enhanced Token Metadata Service for Let's Cook Launchpad
 * 
 * This service integrates SPL Token-2022 metadata with Pinata IPFS storage
 * specifically designed for your launchpad's token creation workflow.
 */
export class LaunchpadTokenMetadataService {
  
  /**
   * Create comprehensive token metadata for launchpad tokens
   * This replaces the old MetaplexMetadataService.createTokenMetadata method
   */
  static async createTokenMetadata(
    connection: Connection,
    tokenMint: PublicKey,
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
      console.log('🏷️ Creating comprehensive token metadata for launchpad token:', {
        tokenMint: tokenMint.toBase58(),
        name: tokenData.name,
        symbol: tokenData.symbol,
        launchType: tokenData.launchType
      });

      // Create comprehensive metadata JSON following Solana Token Metadata standard
      const metadataJson = {
        name: tokenData.name,
        symbol: tokenData.symbol,
        description: tokenData.description,
        image: tokenData.image,
        external_url: tokenData.website || '',
        attributes: [
          {
            trait_type: "Platform",
            value: "Let's Cook"
          },
          {
            trait_type: "Launch Type",
            value: tokenData.launchType === 'instant' ? 'Instant Launch' : 'Raffle Launch'
          },
          {
            trait_type: "Created Date",
            value: new Date().toISOString()
          }
        ],
        properties: {
          files: tokenData.image ? [{
            uri: tokenData.image,
            type: 'image/jpeg'
          }] : [],
          category: 'fungible',
          creators: [
            {
              address: tokenData.creatorWallet,
              share: 100
            }
          ]
        },
        // Additional social links
        ...(tokenData.twitter && { twitter: tokenData.twitter }),
        ...(tokenData.telegram && { telegram: tokenData.telegram }),
        ...(tokenData.discord && { discord: tokenData.discord })
      };

      // Upload metadata JSON to IPFS using Pinata
      let metadataUri = '';
      try {
        console.log('📤 Uploading metadata JSON to Pinata...');
        
        const pinataMetadata: PinataMetadata = {
          name: `${tokenData.name}-metadata`,
          keyvalues: {
            tokenName: tokenData.name,
            tokenSymbol: tokenData.symbol,
            launchType: tokenData.launchType,
            creatorWallet: tokenData.creatorWallet,
            uploadDate: new Date().toISOString(),
            platform: 'letscook'
          }
        };

        const uploadResult = await pinataService.uploadJSON(metadataJson, `${tokenData.name}-metadata.json`, pinataMetadata);
        metadataUri = pinataService.getPinataUrl(uploadResult.cid);
        
        console.log('✅ Metadata JSON uploaded to IPFS:', metadataUri);
        console.log('📊 Upload details:', {
          cid: uploadResult.cid,
          size: uploadResult.size,
          name: uploadResult.name
        });

      } catch (error) {
        console.error('❌ Failed to upload metadata JSON to Pinata:', error);
        return {
          success: false,
          error: `Failed to upload metadata to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }

      // Verify that the token will be visible in wallets
      // Note: Your backend already handles the SPL Token-2022 metadata creation
      // This is just verification
      try {
        console.log('🔍 Verifying token metadata visibility...');
        const isVisible = await SPLTokenMetadataService.isWalletVisible(connection, tokenMint);
        
        if (isVisible) {
          console.log('✅ Token will be visible in Solana wallets with metadata');
        } else {
          console.log('⚠️ Token may show as "Unknown Token" - backend metadata creation may have failed');
        }
      } catch (error) {
        console.warn('⚠️ Could not verify token visibility:', error);
      }

      return {
        success: true,
        metadataUri: metadataUri
      };

    } catch (error) {
      console.error('❌ Error creating token metadata:', error);
      return {
        success: false,
        error: `Failed to create token metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Verify token metadata for a launched token
   */
  static async verifyLaunchedToken(
    connection: Connection,
    tokenMint: PublicKey
  ): Promise<{
    hasMetadata: boolean;
    isWalletVisible: boolean;
    displayInfo?: {
      name: string;
      symbol: string;
      image?: string;
      description?: string;
      decimals: number;
    };
    metadataUri?: string;
  }> {
    try {
      console.log(`🔍 Verifying launched token: ${tokenMint.toBase58()}`);

      // Check if token has SPL Token-2022 metadata
      const metadata = await SPLTokenMetadataService.verifyTokenMetadata(connection, tokenMint);
      
      if (!metadata.hasMetadata) {
        return {
          hasMetadata: false,
          isWalletVisible: false
        };
      }

      // Get detailed display information
      const displayInfo = await SPLTokenMetadataService.getTokenDisplayInfo(connection, tokenMint);
      
      // Check wallet visibility
      const isWalletVisible = await SPLTokenMetadataService.isWalletVisible(connection, tokenMint);

      return {
        hasMetadata: true,
        isWalletVisible: isWalletVisible,
        displayInfo: displayInfo || undefined,
        metadataUri: metadata.uri
      };

    } catch (error) {
      console.error('❌ Error verifying launched token:', error);
      return {
        hasMetadata: false,
        isWalletVisible: false
      };
    }
  }

  /**
   * Get all tokens with metadata for a wallet (launchpad users)
   */
  static async getUserTokensWithMetadata(
    connection: Connection,
    walletAddress: PublicKey
  ): Promise<Array<{
    mint: PublicKey;
    name: string;
    symbol: string;
    image?: string;
    balance: number;
    decimals: number;
    isLaunchpadToken: boolean;
    launchType?: 'instant' | 'raffle';
  }>> {
    try {
      console.log(`🔍 Getting user tokens with metadata: ${walletAddress.toBase58()}`);

      // Get all tokens with metadata
      const tokensWithMetadata = await SPLTokenMetadataService.getWalletTokensWithMetadata(
        connection, 
        walletAddress
      );

      // Enhance with launchpad-specific information
      const enhancedTokens = await Promise.all(
        tokensWithMetadata.map(async (token) => {
          // Check if this is a launchpad token by looking at metadata
          let isLaunchpadToken = false;
          let launchType: 'instant' | 'raffle' | undefined;

          try {
            // Try to fetch metadata to check for launchpad attributes
            const metadata = await SPLTokenMetadataService.verifyTokenMetadata(connection, token.mint);
            if (metadata.uri) {
              const response = await fetch(metadata.uri);
              if (response.ok) {
                const metadataJson = await response.json();
                
                // Check if it has Let's Cook platform attribute
                if (metadataJson.attributes) {
                  const platformAttr = metadataJson.attributes.find(
                    (attr: any) => attr.trait_type === "Platform" && attr.value === "Let's Cook"
                  );
                  
                  if (platformAttr) {
                    isLaunchpadToken = true;
                    
                    // Check launch type
                    const launchTypeAttr = metadataJson.attributes.find(
                      (attr: any) => attr.trait_type === "Launch Type"
                    );
                    
                    if (launchTypeAttr) {
                      launchType = launchTypeAttr.value.includes('Instant') ? 'instant' : 'raffle';
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.warn(`⚠️ Could not check metadata for token ${token.mint.toBase58()}:`, error);
          }

          return {
            ...token,
            isLaunchpadToken,
            launchType
          };
        })
      );

      console.log(`✅ Found ${enhancedTokens.length} tokens with metadata`);
      const launchpadTokens = enhancedTokens.filter(token => token.isLaunchpadToken);
      console.log(`🎯 Found ${launchpadTokens.length} launchpad tokens`);

      return enhancedTokens;

    } catch (error) {
      console.error('❌ Error getting user tokens with metadata:', error);
      return [];
    }
  }

  /**
   * Batch verify multiple launched tokens
   */
  static async batchVerifyTokens(
    connection: Connection,
    tokenMints: string[]
  ): Promise<Array<{
    mint: string;
    hasMetadata: boolean;
    isWalletVisible: boolean;
    name?: string;
    symbol?: string;
    error?: string;
  }>> {
    console.log(`🔍 Batch verifying ${tokenMints.length} tokens...`);

    const results = await Promise.all(
      tokenMints.map(async (mintAddress) => {
        try {
          const mint = new PublicKey(mintAddress);
          const verification = await this.verifyLaunchedToken(connection, mint);
          
          return {
            mint: mintAddress,
            hasMetadata: verification.hasMetadata,
            isWalletVisible: verification.isWalletVisible,
            name: verification.displayInfo?.name,
            symbol: verification.displayInfo?.symbol
          };
        } catch (error) {
          console.error(`❌ Error verifying token ${mintAddress}:`, error);
          return {
            mint: mintAddress,
            hasMetadata: false,
            isWalletVisible: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    const successCount = results.filter(r => r.hasMetadata).length;
    const visibleCount = results.filter(r => r.isWalletVisible).length;
    
    console.log(`📊 Batch verification results:`);
    console.log(`   Total tokens: ${tokenMints.length}`);
    console.log(`   With metadata: ${successCount}`);
    console.log(`   Wallet visible: ${visibleCount}`);

    return results;
  }

  /**
   * Update metadata for an existing token
   * Note: This creates new metadata on IPFS - the token's metadata URI would need to be updated on-chain
   */
  static async updateTokenMetadata(
    connection: Connection,
    tokenMint: PublicKey,
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
      console.log('🔄 Updating token metadata for:', tokenMint.toBase58());

      // First verify the token exists and has metadata
      const verification = await this.verifyLaunchedToken(connection, tokenMint);
      
      if (!verification.hasMetadata) {
        console.log('⚠️ Token does not have existing metadata, creating new metadata instead');
        return await this.createTokenMetadata(connection, tokenMint, tokenData);
      }

      // Create updated metadata JSON
      const metadataJson = {
        name: tokenData.name,
        symbol: tokenData.symbol,
        description: tokenData.description,
        image: tokenData.image,
        external_url: tokenData.website || '',
        attributes: [
          {
            trait_type: "Platform",
            value: "Let's Cook"
          },
          {
            trait_type: "Launch Type",
            value: tokenData.launchType === 'instant' ? 'Instant Launch' : 'Raffle Launch'
          },
          {
            trait_type: "Updated Date",
            value: new Date().toISOString()
          }
        ],
        properties: {
          files: tokenData.image ? [{
            uri: tokenData.image,
            type: 'image/jpeg'
          }] : [],
          category: 'fungible',
          creators: [
            {
              address: tokenData.creatorWallet,
              share: 100
            }
          ]
        },
        // Additional social links
        ...(tokenData.twitter && { twitter: tokenData.twitter }),
        ...(tokenData.telegram && { telegram: tokenData.telegram }),
        ...(tokenData.discord && { discord: tokenData.discord })
      };

      // Upload updated metadata JSON to IPFS using Pinata
      let metadataUri = '';
      try {
        console.log('📤 Uploading updated metadata JSON to Pinata...');
        
        const pinataMetadata: PinataMetadata = {
          name: `${tokenData.name}-metadata-updated`,
          keyvalues: {
            tokenName: tokenData.name,
            tokenSymbol: tokenData.symbol,
            launchType: tokenData.launchType,
            creatorWallet: tokenData.creatorWallet,
            updateDate: new Date().toISOString(),
            platform: 'letscook',
            action: 'update'
          }
        };

        const uploadResult = await pinataService.uploadJSON(metadataJson, `${tokenData.name}-metadata-updated.json`, pinataMetadata);
        metadataUri = pinataService.getPinataUrl(uploadResult.cid);
        
        console.log('✅ Updated metadata JSON uploaded to IPFS:', metadataUri);
        console.log('📊 Upload details:', {
          cid: uploadResult.cid,
          size: uploadResult.size,
          name: uploadResult.name
        });

      } catch (error) {
        console.error('❌ Failed to upload updated metadata JSON to Pinata:', error);
        return {
          success: false,
          error: `Failed to upload updated metadata to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }

      console.log('✅ Token metadata updated successfully');
      console.log('⚠️ Note: The token\'s on-chain metadata URI would need to be updated separately');

      return {
        success: true,
        metadataUri: metadataUri
      };

    } catch (error) {
      console.error('❌ Error updating token metadata:', error);
      return {
        success: false,
        error: `Failed to update token metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Test metadata service with a sample token
   */
  static async testMetadataService(connection: Connection): Promise<void> {
    console.log('🧪 Testing Launchpad Token Metadata Service...\n');

    try {
      // Test Pinata connection
      console.log('1. Testing Pinata connection...');
      const pinataConnected = await pinataService.testConnection();
      if (pinataConnected) {
        console.log('✅ Pinata connection successful');
      } else {
        console.log('❌ Pinata connection failed');
      }

      // Test with a sample token mint (replace with actual token from your launches)
      const sampleTokenMint = 'YOUR_SAMPLE_TOKEN_MINT_HERE';
      
      if (sampleTokenMint === 'YOUR_SAMPLE_TOKEN_MINT_HERE') {
        console.log('⚠️ Please replace YOUR_SAMPLE_TOKEN_MINT_HERE with an actual token mint address');
        console.log('💡 You can find token mint addresses in your launch logs or on Solana Explorer');
        return;
      }

      console.log('\n2. Testing token verification...');
      const verification = await this.verifyLaunchedToken(connection, new PublicKey(sampleTokenMint));
      
      console.log('📊 Verification results:');
      console.log(`   Has metadata: ${verification.hasMetadata}`);
      console.log(`   Wallet visible: ${verification.isWalletVisible}`);
      if (verification.displayInfo) {
        console.log(`   Name: ${verification.displayInfo.name}`);
        console.log(`   Symbol: ${verification.displayInfo.symbol}`);
      }

      console.log('\n✅ Metadata service testing completed!');

    } catch (error) {
      console.error('❌ Error testing metadata service:', error);
    }
  }
}
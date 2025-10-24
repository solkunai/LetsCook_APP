/**
 * Token Metadata Implementation Guide
 * 
 * This file demonstrates the proper way to implement token metadata
 * for Solana wallet visibility using SPL Token-2022.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { SPLTokenMetadataService } from './splTokenMetadataService';

/**
 * Example: How to check if your launched tokens will be visible in wallets
 */
export async function checkTokenWalletVisibility() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Example token mint from your launch
  const tokenMint = new PublicKey('YOUR_TOKEN_MINT_ADDRESS_HERE');
  
  console.log('🔍 Checking token wallet visibility...');
  
  // Check if token has proper metadata
  const isVisible = await SPLTokenMetadataService.isWalletVisible(connection, tokenMint);
  
  if (isVisible) {
    console.log('✅ Token will be visible in Solana wallets with metadata');
    
    // Get detailed display information
    const displayInfo = await SPLTokenMetadataService.getTokenDisplayInfo(connection, tokenMint);
    console.log('📊 Token display info:', displayInfo);
  } else {
    console.log('❌ Token will show as "Unknown Token" in wallets');
    console.log('💡 This means the metadata wasn\'t properly set during token creation');
  }
}

/**
 * Example: How to get all tokens with metadata for a wallet
 */
export async function getWalletTokensWithMetadata(walletAddress: string) {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const wallet = new PublicKey(walletAddress);
  
  console.log(`🔍 Getting tokens with metadata for wallet: ${walletAddress}`);
  
  const tokensWithMetadata = await SPLTokenMetadataService.getWalletTokensWithMetadata(
    connection, 
    wallet
  );
  
  console.log(`✅ Found ${tokensWithMetadata.length} tokens with metadata:`);
  
  tokensWithMetadata.forEach((token, index) => {
    console.log(`${index + 1}. ${token.name} (${token.symbol})`);
    console.log(`   Balance: ${token.balance} ${token.symbol}`);
    console.log(`   Mint: ${token.mint.toBase58()}`);
    if (token.image) {
      console.log(`   Image: ${token.image}`);
    }
    console.log('');
  });
  
  return tokensWithMetadata;
}

/**
 * Example: How to verify metadata for multiple tokens
 */
export async function verifyMultipleTokens(tokenMints: string[]) {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  console.log(`🔍 Verifying metadata for ${tokenMints.length} tokens...`);
  
  const results = await Promise.all(
    tokenMints.map(async (mintAddress) => {
      const mint = new PublicKey(mintAddress);
      const metadata = await SPLTokenMetadataService.verifyTokenMetadata(connection, mint);
      
      return {
        mint: mintAddress,
        hasMetadata: metadata.hasMetadata,
        name: metadata.name,
        symbol: metadata.symbol
      };
    })
  );
  
  console.log('📊 Verification results:');
  results.forEach((result, index) => {
    const status = result.hasMetadata ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.mint}`);
    if (result.hasMetadata) {
      console.log(`   Name: ${result.name}, Symbol: ${result.symbol}`);
    }
  });
  
  return results;
}

/**
 * Example: How to create a token metadata JSON for IPFS
 * This is what your backend should upload to IPFS
 */
export function createTokenMetadataJSON(tokenData: {
  name: string;
  symbol: string;
  description: string;
  image: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
}) {
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
        trait_type: "Type",
        value: "Token Launch"
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
          address: "YOUR_CREATOR_WALLET_ADDRESS",
          share: 100
        }
      ]
    },
    // Additional social links
    ...(tokenData.twitter && { twitter: tokenData.twitter }),
    ...(tokenData.telegram && { telegram: tokenData.telegram }),
    ...(tokenData.discord && { discord: tokenData.discord })
  };
  
  return metadataJson;
}

/**
 * Example: How to test your token metadata implementation
 */
export async function testTokenMetadataImplementation() {
  console.log('🧪 Testing Token Metadata Implementation...\n');
  
  // Test with a known token mint from your launches
  const testTokenMint = 'YOUR_TEST_TOKEN_MINT_HERE';
  
  if (testTokenMint === 'YOUR_TEST_TOKEN_MINT_HERE') {
    console.log('⚠️ Please replace YOUR_TEST_TOKEN_MINT_HERE with an actual token mint address');
    console.log('💡 You can find token mint addresses in your launch logs or on Solana Explorer');
    return;
  }
  
  try {
    // Test 1: Check wallet visibility
    console.log('Test 1: Checking wallet visibility...');
    await checkTokenWalletVisibility();
    console.log('');
    
    // Test 2: Get display info
    console.log('Test 2: Getting token display info...');
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const tokenMint = new PublicKey(testTokenMint);
    const displayInfo = await SPLTokenMetadataService.getTokenDisplayInfo(connection, tokenMint);
    
    if (displayInfo) {
      console.log('✅ Token display info retrieved:');
      console.log(`   Name: ${displayInfo.name}`);
      console.log(`   Symbol: ${displayInfo.symbol}`);
      console.log(`   Decimals: ${displayInfo.decimals}`);
      if (displayInfo.image) {
        console.log(`   Image: ${displayInfo.image}`);
      }
      if (displayInfo.description) {
        console.log(`   Description: ${displayInfo.description}`);
      }
    } else {
      console.log('❌ Could not retrieve token display info');
    }
    
    console.log('\n✅ Token metadata testing completed!');
    
  } catch (error) {
    console.error('❌ Error testing token metadata:', error);
  }
}
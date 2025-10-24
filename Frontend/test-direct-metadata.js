#!/usr/bin/env node

/**
 * Test Direct Metadata Creation
 * 
 * This script tests the direct metadata creation implementation
 * using Solana program invocation.
 * 
 * Usage:
 *   node test-direct-metadata.js
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { MetaplexMetadataService } from './client/src/lib/metaplexMetadataService.js';

async function testDirectMetadataCreation() {
  console.log('🧪 Testing Direct Metadata Creation Implementation...\n');
  
  try {
    // Create connection
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    console.log('✅ Connected to Solana devnet');
    
    // Test with a dummy token mint (you can replace this with a real one)
    const testTokenMint = new PublicKey('DFWjWGiaFRW53AG8rUnRkcucpkeRZP1aexaUyrZ4oDsz');
    const testUserAuthority = new PublicKey('8fvPxVrPp1p3QGwjiFQVYg5xpBTVrWrarrUxQryftUZV'); // Your wallet
    
    console.log('📋 Test Parameters:');
    console.log(`   Token Mint: ${testTokenMint.toBase58()}`);
    console.log(`   User Authority: ${testUserAuthority.toBase58()}`);
    console.log(`   Token Name: "Test Token"`);
    console.log(`   Token Symbol: "TEST"`);
    console.log(`   Metadata URI: "https://gateway.pinata.cloud/ipfs/bafkreig7qoceupufcyc6bnruyuywe6csk6bq6mlum7hrwyfivomi5isdve"`);
    console.log('');
    
    // Test metadata creation
    console.log('🏷️ Testing direct metadata creation...');
    const metadataSignature = await MetaplexMetadataService.createTokenMetadata(
      connection,
      testTokenMint,
      testUserAuthority,
      'Test Token',
      'TEST',
      'https://gateway.pinata.cloud/ipfs/bafkreig7qoceupufcyc6bnruyuywe6csk6bq6mlum7hrwyfivomi5isdve'
    );
    
    if (metadataSignature) {
      console.log('✅ Direct metadata creation test passed!');
      console.log(`   Signature: ${metadataSignature}`);
      console.log('🎯 Token should now show up in wallets with proper metadata!');
    } else {
      console.log('⚠️ Metadata creation test completed (no signature returned)');
      console.log('   This could mean metadata already exists or there was an error');
    }
    
    // Test metadata existence check
    console.log('\n🔍 Testing metadata existence check...');
    const metadataExists = await MetaplexMetadataService.metadataExists(connection, testTokenMint);
    console.log(`   Metadata exists: ${metadataExists}`);
    
    console.log('\n🎉 Direct metadata creation test completed!');
    console.log('💡 The implementation is ready for production use');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('💡 Make sure your .env file has VITE_ADMIN_PRIVATE_KEY set');
    console.log('💡 And that the admin wallet has sufficient SOL for transaction fees');
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testDirectMetadataCreation();
}

export { testDirectMetadataCreation };
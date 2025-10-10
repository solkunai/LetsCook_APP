// Simple program verification using existing frontend setup
import { Connection, PublicKey } from '@solana/web3.js';

const programId = 'AJpR7bij67VzjbYEQzSrBiEgietJiYaPMLD3ogaNsZBx';

async function verifyProgram() {
  console.log(`🔍 Verifying program: ${programId}`);
  console.log('='.repeat(50));

  const rpcEndpoints = [
    'https://api.devnet.solana.com',
    'https://devnet.helius-rpc.com/?api-key=90f9fe0f-400f-4368-bc82-26d2a91b1da6'
  ];

  for (const endpoint of rpcEndpoints) {
    try {
      console.log(`\n📡 Testing: ${endpoint}`);
      const connection = new Connection(endpoint, 'confirmed');
      
      const programPubkey = new PublicKey(programId);
      const accountInfo = await connection.getAccountInfo(programPubkey);
      
      if (accountInfo) {
        console.log(`✅ Program found!`);
        console.log(`   Executable: ${accountInfo.executable}`);
        console.log(`   Owner: ${accountInfo.owner.toString()}`);
        console.log(`   Data Length: ${accountInfo.data.length} bytes`);
        return true;
      } else {
        console.log(`❌ Program not found`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  return false;
}

verifyProgram().then(found => {
  if (found) {
    console.log('\n🎉 Program verification successful!');
  } else {
    console.log('\n❌ Program not found on any RPC endpoint');
    console.log('This suggests the deployment may have failed.');
  }
});
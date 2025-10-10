// Quick program verification
import { Connection, PublicKey } from '@solana/web3.js';

const programId = 'AJpR7bij67VzjbYEQzSrBiEgietJiYaPMLD3ogaNsZBx';

async function verifyProgram() {
  console.log(`🔍 Verifying program: ${programId}`);
  
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
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
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

verifyProgram();
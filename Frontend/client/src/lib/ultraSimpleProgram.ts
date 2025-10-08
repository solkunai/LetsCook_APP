import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { getSimpleConnection } from './simpleConnection';

// Program ID from our deployed program
const PROGRAM_ID = new PublicKey("Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU");

export class UltraSimpleProgramService {
  private connection: Connection;

  constructor() {
    this.connection = getSimpleConnection();
  }

  // Ultra simple test - just send a basic instruction
  async testProgramCall(wallet: any): Promise<string> {
    try {
      console.log('🧪 UltraSimpleProgram: Testing basic program call...');

      // Try a different approach - send a simple system program call first
      // Let's test if the issue is with our program or with the transaction format
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // Duplicate for testing
        ],
        programId: PROGRAM_ID,
        data: Buffer.from([0x00]), // Single byte - simplest possible
      });

      // Create transaction
      const transaction = new Transaction().add(instruction);

      // Set recent blockhash
      console.log('🔍 UltraSimpleProgram: Getting latest blockhash...');
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      console.log('📝 UltraSimpleProgram: Transaction created, sending...');
      console.log('🔍 UltraSimpleProgram: Transaction details:', {
        recentBlockhash: transaction.recentBlockhash,
        feePayer: transaction.feePayer?.toString(),
        instructions: transaction.instructions.length,
        programId: PROGRAM_ID.toString()
      });

      // Send transaction using proper wallet handling
      let signature;

      if (wallet.sendTransaction) {
        console.log('🔍 UltraSimpleProgram: Using wallet.sendTransaction...');
        console.log('🔍 UltraSimpleProgram: Wallet adapter:', wallet);
        try {
          signature = await wallet.sendTransaction(transaction, this.connection);
        } catch (walletError) {
          console.error('❌ UltraSimpleProgram: Wallet sendTransaction error:', walletError);
          throw walletError;
        }
      } else if (wallet.signTransaction && wallet.publicKey) {
        console.log('🔍 UltraSimpleProgram: Using wallet.signTransaction...');
        try {
          const signedTx = await wallet.signTransaction(transaction);
          signature = await this.connection.sendRawTransaction(signedTx.serialize());
        } catch (signError) {
          console.error('❌ UltraSimpleProgram: Sign transaction error:', signError);
          throw signError;
        }
      } else {
        throw new Error("Unsupported wallet object - no sendTransaction or signTransaction method found");
      }
      
      console.log('⏳ UltraSimpleProgram: Waiting for confirmation...');
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ UltraSimpleProgram: Test successful!', signature);
      return signature;

    } catch (error) {
      console.error('❌ UltraSimpleProgram: Error:', error);
      throw error;
    }
  }

  // Test connection to our program
  async testProgramConnection(): Promise<boolean> {
    try {
      console.log('🔍 UltraSimpleProgram: Testing connection to program...');
      
      const programInfo = await this.connection.getAccountInfo(PROGRAM_ID);
      
      if (programInfo) {
        console.log('✅ UltraSimpleProgram: Program found on devnet!', {
          programId: PROGRAM_ID.toString(),
          executable: programInfo.executable,
          owner: programInfo.owner.toString(),
          lamports: programInfo.lamports
        });
        return true;
      } else {
        console.log('❌ UltraSimpleProgram: Program not found on devnet');
        return false;
      }
    } catch (error) {
      console.error('❌ UltraSimpleProgram: Error testing connection:', error);
      return false;
    }
  }

  // Request airdrop for testing
  async requestAirdrop(wallet: any): Promise<boolean> {
    try {
      console.log('💰 UltraSimpleProgram: Requesting airdrop...');
      const signature = await this.connection.requestAirdrop(
        wallet.publicKey, 
        2 * LAMPORTS_PER_SOL
      );
      
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      const balance = await this.connection.getBalance(wallet.publicKey);
      console.log('✅ UltraSimpleProgram: Airdrop successful! New balance:', balance / LAMPORTS_PER_SOL, 'SOL');
      
      return true;
    } catch (error) {
      console.error('❌ UltraSimpleProgram: Airdrop failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const ultraSimpleProgramService = new UltraSimpleProgramService();
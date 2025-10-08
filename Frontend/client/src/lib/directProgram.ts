import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { getHeliusAPI } from './helius';

// Program ID from our deployed program
const PROGRAM_ID = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU");

// Simple instruction discriminator for our basic program
const CREATE_LAUNCH_DISCRIMINATOR = Buffer.from([0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x7a, 0x8b]);

export class DirectProgramService {
  private connection: Connection;
  private helius: any;

  constructor() {
    this.helius = getHeliusAPI();
    this.connection = this.helius.getConnection();
  }

  // Simple launch creation that works with our basic program
  async createSimpleLaunch(
    wallet: any,
    launchData: {
      name: string;
      symbol: string;
      description: string;
      totalSupply: number;
      decimals: number;
    }
  ): Promise<string> {
    try {
      console.log('🚀 DirectProgram: Creating simple launch with data:', launchData);

      // Create a simple instruction that our basic program can handle
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: this.serializeLaunchData(launchData),
      });

      // Create transaction
      const transaction = new Transaction().add(instruction);

      // Set recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      console.log('📝 DirectProgram: Transaction created, sending...');

      // Send transaction
      const signature = await wallet.sendTransaction(transaction, this.connection);
      
      console.log('⏳ DirectProgram: Waiting for confirmation...');
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ DirectProgram: Launch created successfully!', signature);
      return signature;

    } catch (error) {
      console.error('❌ DirectProgram: Error creating launch:', error);
      throw error;
    }
  }

  // Serialize launch data for our simple program
  private serializeLaunchData(data: {
    name: string;
    symbol: string;
    description: string;
    totalSupply: number;
    decimals: number;
  }): Buffer {
    // Create a simple data structure that our basic program can understand
    const buffer = Buffer.alloc(1024); // Allocate enough space
    let offset = 0;

    // Add discriminator
    CREATE_LAUNCH_DISCRIMINATOR.copy(buffer, offset);
    offset += CREATE_LAUNCH_DISCRIMINATOR.length;

    // Add name (32 bytes max)
    const nameBytes = Buffer.from(data.name.padEnd(32, '\0').slice(0, 32));
    nameBytes.copy(buffer, offset);
    offset += 32;

    // Add symbol (8 bytes max)
    const symbolBytes = Buffer.from(data.symbol.padEnd(8, '\0').slice(0, 8));
    symbolBytes.copy(buffer, offset);
    offset += 8;

    // Add total supply (8 bytes, u64)
    buffer.writeBigUInt64LE(BigInt(data.totalSupply), offset);
    offset += 8;

    // Add decimals (1 byte, u8)
    buffer.writeUInt8(data.decimals, offset);
    offset += 1;

    // Add description length and data
    const descriptionBytes = Buffer.from(data.description, 'utf8');
    buffer.writeUInt32LE(descriptionBytes.length, offset);
    offset += 4;
    descriptionBytes.copy(buffer, offset);
    offset += descriptionBytes.length;

    return buffer.slice(0, offset);
  }

  // Test connection to our program
  async testProgramConnection(): Promise<boolean> {
    try {
      console.log('🔍 DirectProgram: Testing connection to program...');
      
      // Try to get account info for our program
      const programInfo = await this.connection.getAccountInfo(PROGRAM_ID);
      
      if (programInfo) {
        console.log('✅ DirectProgram: Program found on devnet!', {
          programId: PROGRAM_ID.toString(),
          executable: programInfo.executable,
          owner: programInfo.owner.toString(),
          lamports: programInfo.lamports
        });
        return true;
      } else {
        console.log('❌ DirectProgram: Program not found on devnet');
        return false;
      }
    } catch (error) {
      console.error('❌ DirectProgram: Error testing connection:', error);
      return false;
    }
  }

  // Request airdrop for testing
  async requestAirdrop(wallet: any): Promise<boolean> {
    try {
      console.log('💰 DirectProgram: Requesting airdrop...');
      const signature = await this.connection.requestAirdrop(
        wallet.publicKey, 
        2 * LAMPORTS_PER_SOL
      );
      
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      const balance = await this.connection.getBalance(wallet.publicKey);
      console.log('✅ DirectProgram: Airdrop successful! New balance:', balance / LAMPORTS_PER_SOL, 'SOL');
      
      return true;
    } catch (error) {
      console.error('❌ DirectProgram: Airdrop failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const directProgramService = new DirectProgramService();
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

// Simple instruction discriminator for our basic program
const CREATE_LAUNCH_DISCRIMINATOR = new Uint8Array([0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x7a, 0x8b]);

export class SimpleDirectProgramService {
  private connection: Connection;

  constructor() {
    this.connection = getSimpleConnection();
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
      console.log('🚀 SimpleDirectProgram: Creating simple launch with data:', launchData);
      console.log('🔍 SimpleDirectProgram: Wallet object:', wallet);
      console.log('🔍 SimpleDirectProgram: Wallet publicKey:', wallet?.publicKey);
      console.log('🔍 SimpleDirectProgram: Wallet adapter:', wallet?.adapter);

      // Validate wallet and publicKey
      if (!wallet) {
        throw new Error('Wallet is not provided');
      }
      
      if (!wallet.publicKey) {
        throw new Error('Wallet publicKey is not available. Please connect your wallet.');
      }

      if (!wallet.adapter) {
        throw new Error('Wallet adapter is not available');
      }

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
      console.log('🔍 SimpleDirectProgram: Getting latest blockhash...');
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      console.log('📝 SimpleDirectProgram: Transaction created, sending...');
      console.log('🔍 SimpleDirectProgram: Transaction details:', {
        recentBlockhash: transaction.recentBlockhash,
        feePayer: transaction.feePayer?.toString(),
        instructions: transaction.instructions.length
      });

      // Send transaction using proper wallet handling
      console.log('🔍 SimpleDirectProgram: Sending transaction...');
      let signature;

      if (wallet.sendTransaction) {
        // For wallet-adapter-react (most setups)
        console.log('🔍 SimpleDirectProgram: Using wallet.sendTransaction...');
        signature = await wallet.sendTransaction(transaction, this.connection);
      } else if (wallet.signTransaction && wallet.publicKey) {
        // For Phantom / Solflare direct API
        console.log('🔍 SimpleDirectProgram: Using wallet.signTransaction...');
        const signedTx = await wallet.signTransaction(transaction);
        signature = await this.connection.sendRawTransaction(signedTx.serialize());
      } else {
        throw new Error("Unsupported wallet object - no sendTransaction or signTransaction method found");
      }
      
      console.log('⏳ SimpleDirectProgram: Waiting for confirmation...');
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ SimpleDirectProgram: Launch created successfully!', signature);
      return signature;

    } catch (error) {
      console.error('❌ SimpleDirectProgram: Error creating launch:', error);
      throw error;
    }
  }

  // Serialize launch data for our simple program using Uint8Array instead of Buffer
  private serializeLaunchData(data: {
    name: string;
    symbol: string;
    description: string;
    totalSupply: number;
    decimals: number;
  }): Uint8Array {
    // Create a simple data structure that our basic program can understand
    const buffer = new Uint8Array(1024); // Allocate enough space
    let offset = 0;

    // Add discriminator
    buffer.set(CREATE_LAUNCH_DISCRIMINATOR, offset);
    offset += CREATE_LAUNCH_DISCRIMINATOR.length;

    // Add name (32 bytes max)
    const nameBytes = new TextEncoder().encode(data.name.padEnd(32, '\0').slice(0, 32));
    buffer.set(nameBytes, offset);
    offset += 32;

    // Add symbol (8 bytes max)
    const symbolBytes = new TextEncoder().encode(data.symbol.padEnd(8, '\0').slice(0, 8));
    buffer.set(symbolBytes, offset);
    offset += 8;

    // Add total supply (8 bytes, u64) - little endian
    const supplyBytes = new Uint8Array(8);
    const supplyView = new DataView(supplyBytes.buffer);
    supplyView.setBigUint64(0, BigInt(data.totalSupply), true);
    buffer.set(supplyBytes, offset);
    offset += 8;

    // Add decimals (1 byte, u8)
    buffer[offset] = data.decimals;
    offset += 1;

    // Add description length and data
    const descriptionBytes = new TextEncoder().encode(data.description);
    const descLengthBytes = new Uint8Array(4);
    const descLengthView = new DataView(descLengthBytes.buffer);
    descLengthView.setUint32(0, descriptionBytes.length, true);
    buffer.set(descLengthBytes, offset);
    offset += 4;
    buffer.set(descriptionBytes, offset);
    offset += descriptionBytes.length;

    return buffer.slice(0, offset);
  }

  // Test connection to our program
  async testProgramConnection(): Promise<boolean> {
    try {
      console.log('🔍 SimpleDirectProgram: Testing connection to program...');
      
      // Try to get account info for our program
      const programInfo = await this.connection.getAccountInfo(PROGRAM_ID);
      
      if (programInfo) {
        console.log('✅ SimpleDirectProgram: Program found on devnet!', {
          programId: PROGRAM_ID.toString(),
          executable: programInfo.executable,
          owner: programInfo.owner.toString(),
          lamports: programInfo.lamports
        });
        return true;
      } else {
        console.log('❌ SimpleDirectProgram: Program not found on devnet');
        return false;
      }
    } catch (error) {
      console.error('❌ SimpleDirectProgram: Error testing connection:', error);
      return false;
    }
  }

  // Request airdrop for testing
  async requestAirdrop(wallet: any): Promise<boolean> {
    try {
      console.log('💰 SimpleDirectProgram: Requesting airdrop...');
      const signature = await this.connection.requestAirdrop(
        wallet.publicKey, 
        2 * LAMPORTS_PER_SOL
      );
      
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      const balance = await this.connection.getBalance(wallet.publicKey);
      console.log('✅ SimpleDirectProgram: Airdrop successful! New balance:', balance / LAMPORTS_PER_SOL, 'SOL');
      
      return true;
    } catch (error) {
      console.error('❌ SimpleDirectProgram: Airdrop failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const simpleDirectProgramService = new SimpleDirectProgramService();
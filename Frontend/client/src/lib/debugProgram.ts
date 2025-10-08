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
const PROGRAM_ID = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU");

export class DebugProgramService {
  private connection: Connection;

  constructor() {
    this.connection = getSimpleConnection();
  }

  // Test 1: Try a simple system program call first
  async testSystemProgram(wallet: any): Promise<string> {
    try {
      console.log('🔍 DebugProgram: Testing System Program call...');
      console.log('🔍 DebugProgram: Wallet object:', wallet);
      console.log('🔍 DebugProgram: Wallet adapter:', wallet?.adapter);

      // Create a simple system program instruction (transfer 0 SOL to self)
      const instruction = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: 0, // Transfer 0 SOL (just to test)
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      console.log('🔍 DebugProgram: Sending System Program transaction...');
      
      // Use the correct wallet method
      let signature;
      if (wallet.sendTransaction) {
        signature = await wallet.sendTransaction(transaction, this.connection);
      } else if (wallet.adapter?.sendTransaction) {
        signature = await wallet.adapter.sendTransaction(transaction, this.connection);
      } else {
        throw new Error('No sendTransaction method found on wallet or adapter');
      }
      
      console.log('⏳ DebugProgram: Waiting for confirmation...');
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ DebugProgram: System Program test successful!', signature);
      return signature;

    } catch (error) {
      console.error('❌ DebugProgram: System Program error:', error);
      throw error;
    }
  }

  // Test 2: Try our program with different instruction formats
  async testOurProgram(wallet: any): Promise<string> {
    try {
      console.log('🔍 DebugProgram: Testing our program call...');

      // Try different instruction formats
      const instructionFormats = [
        { name: 'Empty data', data: Buffer.from([]) },
        { name: 'Single byte', data: Buffer.from([0x00]) },
        { name: 'Two bytes', data: Buffer.from([0x00, 0x01]) },
        { name: 'Four bytes', data: Buffer.from([0x00, 0x01, 0x02, 0x03]) },
        { name: 'Test string', data: Buffer.from('test', 'utf8') },
      ];

      for (const format of instructionFormats) {
        try {
          console.log(`🔍 DebugProgram: Trying ${format.name}...`);
          
          const instruction = new TransactionInstruction({
            keys: [
              { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            ],
            programId: PROGRAM_ID,
            data: format.data,
          });

          const transaction = new Transaction().add(instruction);
          const { blockhash } = await this.connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = wallet.publicKey;

          console.log(`🔍 DebugProgram: Sending ${format.name} transaction...`);
          
          // Use the correct wallet method
          let signature;
          if (wallet.sendTransaction) {
            signature = await wallet.sendTransaction(transaction, this.connection);
          } else if (wallet.adapter?.sendTransaction) {
            signature = await wallet.adapter.sendTransaction(transaction, this.connection);
          } else {
            throw new Error('No sendTransaction method found on wallet or adapter');
          }
          
          console.log('⏳ DebugProgram: Waiting for confirmation...');
          await this.connection.confirmTransaction(signature, 'confirmed');
          
          console.log(`✅ DebugProgram: ${format.name} test successful!`, signature);
          return signature;
          
        } catch (error) {
          console.log(`❌ DebugProgram: ${format.name} failed:`, error);
          // Continue to next format
        }
      }
      
      throw new Error('All instruction formats failed');

    } catch (error) {
      console.error('❌ DebugProgram: Our program error:', error);
      throw error;
    }
  }

  // Test 3: Check if our program exists
  async checkProgramExists(): Promise<boolean> {
    try {
      console.log('🔍 DebugProgram: Checking if program exists...');
      const programInfo = await this.connection.getAccountInfo(PROGRAM_ID);
      
      if (programInfo) {
        console.log('✅ DebugProgram: Program found!', {
          executable: programInfo.executable,
          owner: programInfo.owner.toString(),
          lamports: programInfo.lamports,
          dataLength: programInfo.data.length
        });
        
        // Log the first few bytes of the program data to see what's actually deployed
        if (programInfo.data.length > 0) {
          const firstBytes = Array.from(programInfo.data.slice(0, 16))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
          console.log('🔍 DebugProgram: First 16 bytes of program data:', firstBytes);
        }
        
        return true;
      } else {
        console.log('❌ DebugProgram: Program not found!');
        return false;
      }
    } catch (error) {
      console.error('❌ DebugProgram: Error checking program:', error);
      throw error;
    }
  }

  // Test 4: Try calling a different program ID to see if the issue is with our program
  async testDifferentProgram(wallet: any): Promise<string> {
    try {
      console.log('🔍 DebugProgram: Testing with System Program ID...');
      
      // Try calling our program ID but with System Program instruction
      const instruction = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: 0,
      });

      // Replace the program ID with our program ID
      const customInstruction = new TransactionInstruction({
        keys: instruction.keys,
        programId: PROGRAM_ID, // Use our program ID instead of System Program
        data: instruction.data,
      });

      const transaction = new Transaction().add(customInstruction);
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      console.log('🔍 DebugProgram: Sending System Program instruction to our program...');
      
      let signature;
      if (wallet.sendTransaction) {
        signature = await wallet.sendTransaction(transaction, this.connection);
      } else if (wallet.adapter?.sendTransaction) {
        signature = await wallet.adapter.sendTransaction(transaction, this.connection);
      } else {
        throw new Error('No sendTransaction method found on wallet or adapter');
      }
      
      console.log('⏳ DebugProgram: Waiting for confirmation...');
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ DebugProgram: System Program instruction to our program successful!', signature);
      return signature;

    } catch (error) {
      console.error('❌ DebugProgram: System Program instruction to our program error:', error);
      throw error;
    }
  }

  // Test 5: Try to simulate the transaction to see what error we get
  async simulateTransaction(wallet: any): Promise<void> {
    try {
      console.log('🔍 DebugProgram: Simulating transaction...');
      
      // Create a simple instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from([0x00]),
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      console.log('🔍 DebugProgram: Simulating transaction...');
      
      // Try to simulate the transaction
      const simulation = await this.connection.simulateTransaction(transaction);
      
      console.log('🔍 DebugProgram: Simulation result:', {
        err: simulation.value.err,
        logs: simulation.value.logs,
        unitsConsumed: simulation.value.unitsConsumed
      });
      
      if (simulation.value.err) {
        console.log('❌ DebugProgram: Simulation failed:', simulation.value.err);
        
        // Log detailed error information
        if (simulation.value.err.InstructionError) {
          console.log('🔍 DebugProgram: Instruction Error Details:', simulation.value.err.InstructionError);
        }
        
        // Log all the logs from the program
        if (simulation.value.logs && simulation.value.logs.length > 0) {
          console.log('🔍 DebugProgram: Program Logs:');
          simulation.value.logs.forEach((log, index) => {
            console.log(`  ${index + 1}: ${log}`);
          });
        }
      } else {
        console.log('✅ DebugProgram: Simulation successful!');
      }

    } catch (error) {
      console.error('❌ DebugProgram: Simulation error:', error);
      throw error;
    }
  }

  // Test 6: Try different account combinations to find what the program expects
  async testAccountCombinations(wallet: any): Promise<string> {
    try {
      console.log('🔍 DebugProgram: Testing different account combinations...');
      
      // Try different account combinations
      const accountCombinations = [
        {
          name: '1 account (current)',
          keys: [
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          ]
        },
        {
          name: '2 accounts',
          keys: [
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: wallet.publicKey, isSigner: false, isWritable: false },
          ]
        },
        {
          name: '3 accounts',
          keys: [
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: wallet.publicKey, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ]
        },
        {
          name: '4 accounts',
          keys: [
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: wallet.publicKey, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
          ]
        }
      ];

      for (const combo of accountCombinations) {
        try {
          console.log(`🔍 DebugProgram: Trying ${combo.name}...`);
          
          const instruction = new TransactionInstruction({
            keys: combo.keys,
            programId: PROGRAM_ID,
            data: Buffer.from([0x00]),
          });

          const transaction = new Transaction().add(instruction);
          const { blockhash } = await this.connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = wallet.publicKey;

          // Simulate first to see if it works
          const simulation = await this.connection.simulateTransaction(transaction);
          
          if (simulation.value.err) {
            console.log(`❌ DebugProgram: ${combo.name} failed:`, simulation.value.err);
            
            // Log detailed error information for each attempt
            if (simulation.value.err.InstructionError) {
              console.log(`🔍 DebugProgram: ${combo.name} Instruction Error Details:`, simulation.value.err.InstructionError);
            }
            
            // Log program logs for each attempt
            if (simulation.value.logs && simulation.value.logs.length > 0) {
              console.log(`🔍 DebugProgram: ${combo.name} Program Logs:`);
              simulation.value.logs.forEach((log, index) => {
                console.log(`  ${index + 1}: ${log}`);
              });
            }
            
            continue;
          }
          
          console.log(`✅ DebugProgram: ${combo.name} simulation successful!`);
          
          // If simulation works, try the real transaction
          let signature;
          if (wallet.sendTransaction) {
            signature = await wallet.sendTransaction(transaction, this.connection);
          } else if (wallet.adapter?.sendTransaction) {
            signature = await wallet.adapter.sendTransaction(transaction, this.connection);
          } else {
            throw new Error('No sendTransaction method found on wallet or adapter');
          }
          
          console.log('⏳ DebugProgram: Waiting for confirmation...');
          await this.connection.confirmTransaction(signature, 'confirmed');
          
          console.log(`✅ DebugProgram: ${combo.name} transaction successful!`, signature);
          return signature;
          
        } catch (error) {
          console.log(`❌ DebugProgram: ${combo.name} failed:`, error);
          // Continue to next combination
        }
      }
      
      throw new Error('All account combinations failed');

    } catch (error) {
      console.error('❌ DebugProgram: Account combinations error:', error);
      throw error;
    }
  }

  // Test 7: Try different instruction data formats
  async testInstructionDataFormats(wallet: any): Promise<string> {
    try {
      console.log('🔍 DebugProgram: Testing different instruction data formats...');
      
      // Try different instruction data formats
      const dataFormats = [
        { name: 'Empty data', data: Buffer.from([]) },
        { name: 'Single zero', data: Buffer.from([0x00]) },
        { name: 'Single one', data: Buffer.from([0x01]) },
        { name: 'Two bytes', data: Buffer.from([0x00, 0x01]) },
        { name: 'Four bytes', data: Buffer.from([0x00, 0x01, 0x02, 0x03]) },
        { name: 'Eight bytes', data: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]) },
        { name: 'String data', data: Buffer.from('test', 'utf8') },
        { name: 'Hello world', data: Buffer.from('Hello World!', 'utf8') },
      ];

      for (const format of dataFormats) {
        try {
          console.log(`🔍 DebugProgram: Trying ${format.name}...`);
          
          // Use 2 accounts (most likely to work based on previous tests)
          const instruction = new TransactionInstruction({
            keys: [
              { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
              { pubkey: wallet.publicKey, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data: format.data,
          });

          const transaction = new Transaction().add(instruction);
          const { blockhash } = await this.connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = wallet.publicKey;

          // Simulate first to see if it works
          const simulation = await this.connection.simulateTransaction(transaction);
          
          if (simulation.value.err) {
            console.log(`❌ DebugProgram: ${format.name} failed:`, simulation.value.err);
            
            // Log detailed error information
            if (simulation.value.err.InstructionError) {
              console.log(`🔍 DebugProgram: ${format.name} Instruction Error Details:`, simulation.value.err.InstructionError);
            }
            
            // Log program logs
            if (simulation.value.logs && simulation.value.logs.length > 0) {
              console.log(`🔍 DebugProgram: ${format.name} Program Logs:`);
              simulation.value.logs.forEach((log, index) => {
                console.log(`  ${index + 1}: ${log}`);
              });
            }
            
            continue;
          }
          
          console.log(`✅ DebugProgram: ${format.name} simulation successful!`);
          
          // If simulation works, try the real transaction
          let signature;
          if (wallet.sendTransaction) {
            signature = await wallet.sendTransaction(transaction, this.connection);
          } else if (wallet.adapter?.sendTransaction) {
            signature = await wallet.adapter.sendTransaction(transaction, this.connection);
          } else {
            throw new Error('No sendTransaction method found on wallet or adapter');
          }
          
          console.log('⏳ DebugProgram: Waiting for confirmation...');
          await this.connection.confirmTransaction(signature, 'confirmed');
          
          console.log(`✅ DebugProgram: ${format.name} transaction successful!`, signature);
          return signature;
          
        } catch (error) {
          console.log(`❌ DebugProgram: ${format.name} failed:`, error);
          // Continue to next format
        }
      }
      
      throw new Error('All instruction data formats failed');

    } catch (error) {
      console.error('❌ DebugProgram: Instruction data formats error:', error);
      throw error;
    }
  }

  // Test 8: Try to create a minimal transaction with only our instruction
  async testMinimalTransaction(wallet: any): Promise<string> {
    try {
      console.log('🔍 DebugProgram: Testing minimal transaction with only our instruction...');
      
      // Create a very simple instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from([]), // Empty data
      });

      // Create transaction with ONLY our instruction
      const transaction = new Transaction();
      transaction.add(instruction);
      
      // Set recent blockhash and fee payer
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      console.log('🔍 DebugProgram: Transaction details:', {
        instructionCount: transaction.instructions.length,
        programIds: transaction.instructions.map(ix => ix.programId.toString()),
        dataLengths: transaction.instructions.map(ix => ix.data.length)
      });

      // Simulate first
      const simulation = await this.connection.simulateTransaction(transaction);
      
      if (simulation.value.err) {
        console.log('❌ DebugProgram: Minimal transaction simulation failed:', simulation.value.err);
        
        if (simulation.value.err.InstructionError) {
          console.log('🔍 DebugProgram: Instruction Error Details:', simulation.value.err.InstructionError);
        }
        
        if (simulation.value.logs && simulation.value.logs.length > 0) {
          console.log('🔍 DebugProgram: Program Logs:');
          simulation.value.logs.forEach((log, index) => {
            console.log(`  ${index + 1}: ${log}`);
          });
        }
        
        throw new Error('Minimal transaction simulation failed');
      }
      
      console.log('✅ DebugProgram: Minimal transaction simulation successful!');
      
      // Try the real transaction
      let signature;
      if (wallet.sendTransaction) {
        signature = await wallet.sendTransaction(transaction, this.connection);
      } else if (wallet.adapter?.sendTransaction) {
        signature = await wallet.adapter.sendTransaction(transaction, this.connection);
      } else {
        throw new Error('No sendTransaction method found on wallet or adapter');
      }
      
      console.log('⏳ DebugProgram: Waiting for confirmation...');
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ DebugProgram: Minimal transaction successful!', signature);
      return signature;

    } catch (error) {
      console.error('❌ DebugProgram: Minimal transaction error:', error);
      throw error;
    }
  }

  // Test 9: Try with the correct program data account
  async testWithProgramDataAccount(wallet: any): Promise<string> {
    try {
      console.log('🔍 DebugProgram: Testing with correct program data account...');
      
      // The program expects this specific program data account (updated from logs)
      const programDataAccount = new PublicKey('Cook4kWjNd33iXUys8GZRcFNDuwm2ZRqPKU2qBrrQ7pB');
      
      // Create instruction with the correct accounts
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: programDataAccount, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from([0x00]), // Single byte instruction
      });

      // Create transaction
      const transaction = new Transaction();
      transaction.add(instruction);
      
      // Set recent blockhash and fee payer
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      console.log('🔍 DebugProgram: Transaction with program data account:', {
        instructionCount: transaction.instructions.length,
        programIds: transaction.instructions.map(ix => ix.programId.toString()),
        dataLengths: transaction.instructions.map(ix => ix.data.length),
        accounts: instruction.keys.map(key => ({
          pubkey: key.pubkey.toString(),
          isSigner: key.isSigner,
          isWritable: key.isWritable
        }))
      });

      // Simulate first
      const simulation = await this.connection.simulateTransaction(transaction);
      
      if (simulation.value.err) {
        console.log('❌ DebugProgram: Program data account simulation failed:', simulation.value.err);
        
        if (simulation.value.err.InstructionError) {
          console.log('🔍 DebugProgram: Instruction Error Details:', simulation.value.err.InstructionError);
        }
        
        if (simulation.value.logs && simulation.value.logs.length > 0) {
          console.log('🔍 DebugProgram: Program Logs:');
          simulation.value.logs.forEach((log, index) => {
            console.log(`  ${index + 1}: ${log}`);
          });
        }
        
        throw new Error('Program data account simulation failed');
      }
      
      console.log('✅ DebugProgram: Program data account simulation successful!');
      
      // Try the real transaction
      let signature;
      if (wallet.sendTransaction) {
        signature = await wallet.sendTransaction(transaction, this.connection);
      } else if (wallet.adapter?.sendTransaction) {
        signature = await wallet.adapter.sendTransaction(transaction, this.connection);
      } else {
        throw new Error('No sendTransaction method found on wallet or adapter');
      }
      
      console.log('⏳ DebugProgram: Waiting for confirmation...');
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ DebugProgram: Program data account transaction successful!', signature);
      return signature;

    } catch (error) {
      console.error('❌ DebugProgram: Program data account error:', error);
      throw error;
    }
  }

  // Test 10: Try to find the correct program data account automatically
  async testFindProgramDataAccount(wallet: any): Promise<string> {
    try {
      console.log('🔍 DebugProgram: Trying to find the correct program data account...');
      
      // Get the program account info to find the program data account
      const programInfo = await this.connection.getAccountInfo(PROGRAM_ID);
      if (!programInfo) {
        throw new Error('Program not found');
      }
      
      console.log('🔍 DebugProgram: Program info:', {
        executable: programInfo.executable,
        owner: programInfo.owner.toString(),
        lamports: programInfo.lamports,
        dataLength: programInfo.data.length
      });
      
      // The program data account is typically derived from the program ID
      // Let's try to find it by looking for accounts owned by our program
      const accounts = await this.connection.getProgramAccounts(PROGRAM_ID);
      console.log('🔍 DebugProgram: Found accounts owned by program:', accounts.length);
      
      // Try each account as the program data account
      for (const account of accounts) {
        try {
          console.log(`🔍 DebugProgram: Trying account ${account.pubkey.toString()} as program data...`);
          
          const instruction = new TransactionInstruction({
            keys: [
              { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
              { pubkey: account.pubkey, isSigner: false, isWritable: false },
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
              { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data: Buffer.from([0x00]),
          });

          const transaction = new Transaction();
          transaction.add(instruction);
          
          const { blockhash } = await this.connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = wallet.publicKey;

          // Simulate to see if this account works
          const simulation = await this.connection.simulateTransaction(transaction);
          
          if (simulation.value.err) {
            console.log(`❌ DebugProgram: Account ${account.pubkey.toString()} failed:`, simulation.value.err);
            continue;
          }
          
          console.log(`✅ DebugProgram: Account ${account.pubkey.toString()} simulation successful!`);
          
          // If simulation works, try the real transaction
          let signature;
          if (wallet.sendTransaction) {
            signature = await wallet.sendTransaction(transaction, this.connection);
          } else if (wallet.adapter?.sendTransaction) {
            signature = await wallet.adapter.sendTransaction(transaction, this.connection);
          } else {
            throw new Error('No sendTransaction method found on wallet or adapter');
          }
          
          console.log('⏳ DebugProgram: Waiting for confirmation...');
          await this.connection.confirmTransaction(signature, 'confirmed');
          
          console.log(`✅ DebugProgram: Found working program data account: ${account.pubkey.toString()}`, signature);
          return signature;
          
        } catch (error) {
          console.log(`❌ DebugProgram: Account ${account.pubkey.toString()} error:`, error);
          continue;
        }
      }
      
      throw new Error('No working program data account found');

    } catch (error) {
      console.error('❌ DebugProgram: Find program data account error:', error);
      throw error;
    }
  }
}

export const debugProgramService = new DebugProgramService();
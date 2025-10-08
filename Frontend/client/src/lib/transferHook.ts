import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

// Transfer Hook Program ID (update with actual deployed program ID)
const TRANSFER_HOOK_PROGRAM_ID = new PublicKey('TransferHook1111111111111111111111111111111');

// Transfer Hook Program Types
export interface TransferHookData {
  account_type: number;
  mint: PublicKey;
  authority: PublicKey;
  hook_program: PublicKey;
  extra_account_metas: PublicKey[];
  created_at: number;
  updated_at: number;
}

export interface TransferHookConfig {
  fee_rate: number;
  fee_recipient: PublicKey;
  max_transfer_amount: number;
  whitelist: PublicKey[];
  blacklist: PublicKey[];
  custom_logic: string;
}

export enum TransferHookInstruction {
  Execute = 0,
  InitializeExtraAccountMetas = 1,
}

// Helper functions to derive PDAs
export function getTransferHookPDA(mint: PublicKey, programId: PublicKey = TRANSFER_HOOK_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [mint.toBuffer(), Buffer.from('transfer_hook')],
    programId
  );
}

export function getExtraAccountMetasPDA(mint: PublicKey, programId: PublicKey = TRANSFER_HOOK_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [mint.toBuffer(), Buffer.from('extra_account_metas')],
    programId
  );
}

// Transfer Hook Program Instructions
export async function initializeTransferHook(
  connection: Connection,
  walletPublicKey: PublicKey,
  mint: PublicKey,
  hookProgram: PublicKey,
  config: TransferHookConfig
): Promise<string> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  // Derive PDAs
  const [transferHookPDA] = getTransferHookPDA(mint);
  const [extraAccountMetasPDA] = getExtraAccountMetasPDA(mint);
  
  // Create instruction data
  const instructionData = Buffer.alloc(1000);
  let offset = 0;
  
  // Add instruction discriminator (placeholder)
  instructionData.writeUInt32LE(0x11111111, offset);
  offset += 4;
  
  // Serialize config
  instructionData.writeUInt32LE(config.fee_rate, offset);
  offset += 4;
  
  // Add fee recipient
  instructionData.set(config.fee_recipient.toBuffer(), offset);
  offset += 32;
  
  instructionData.writeBigUInt64LE(BigInt(config.max_transfer_amount), offset);
  offset += 8;
  
  // Add whitelist length and addresses
  instructionData.writeUInt32LE(config.whitelist.length, offset);
  offset += 4;
  for (const address of config.whitelist) {
    instructionData.set(address.toBuffer(), offset);
    offset += 32;
  }
  
  // Add blacklist length and addresses
  instructionData.writeUInt32LE(config.blacklist.length, offset);
  offset += 4;
  for (const address of config.blacklist) {
    instructionData.set(address.toBuffer(), offset);
    offset += 32;
  }
  
  // Add custom logic
  const customLogicBytes = Buffer.from(config.custom_logic, 'utf8');
  instructionData.writeUInt32LE(customLogicBytes.length, offset);
  offset += 4;
  instructionData.set(customLogicBytes, offset);
  offset += customLogicBytes.length;
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: transferHookPDA, isSigner: false, isWritable: true },
      { pubkey: extraAccountMetasPDA, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: hookProgram, isSigner: false, isWritable: false },
    ],
    programId: TRANSFER_HOOK_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  const signature = await connection.sendTransaction(transaction, []);
  await connection.confirmTransaction(signature);
  
  return signature;
}

export async function executeTransferHook(
  connection: Connection,
  walletPublicKey: PublicKey,
  mint: PublicKey,
  amount: number,
  sourceAccount: PublicKey,
  destinationAccount: PublicKey
): Promise<string> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  // Derive transfer hook PDA
  const [transferHookPDA] = getTransferHookPDA(mint);
  
  // Create instruction data
  const instructionData = Buffer.alloc(100);
  let offset = 0;
  
  // Add instruction discriminator (placeholder)
  instructionData.writeUInt32LE(0x22222222, offset);
  offset += 4;
  
  // Add amount
  instructionData.writeBigUInt64LE(BigInt(amount), offset);
  offset += 8;
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: sourceAccount, isSigner: false, isWritable: true },
      { pubkey: destinationAccount, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: transferHookPDA, isSigner: false, isWritable: true },
    ],
    programId: TRANSFER_HOOK_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  const signature = await connection.sendTransaction(transaction, []);
  await connection.confirmTransaction(signature);
  
  return signature;
}

export async function updateTransferHookConfig(
  connection: Connection,
  walletPublicKey: PublicKey,
  mint: PublicKey,
  config: Partial<TransferHookConfig>
): Promise<string> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  // Derive transfer hook PDA
  const [transferHookPDA] = getTransferHookPDA(mint);
  
  // Create instruction data
  const instructionData = Buffer.alloc(1000);
  let offset = 0;
  
  // Add instruction discriminator (placeholder)
  instructionData.writeUInt32LE(0x33333333, offset);
  offset += 4;
  
  // Serialize updated config fields
  if (config.fee_rate !== undefined) {
    instructionData.writeUInt32LE(config.fee_rate, offset);
    offset += 4;
  }
  
  if (config.fee_recipient) {
    instructionData.set(config.fee_recipient.toBuffer(), offset);
    offset += 32;
  }
  
  if (config.max_transfer_amount !== undefined) {
    instructionData.writeBigUInt64LE(BigInt(config.max_transfer_amount), offset);
    offset += 8;
  }
  
  if (config.whitelist) {
    instructionData.writeUInt32LE(config.whitelist.length, offset);
    offset += 4;
    for (const address of config.whitelist) {
      instructionData.set(address.toBuffer(), offset);
      offset += 32;
    }
  }
  
  if (config.blacklist) {
    instructionData.writeUInt32LE(config.blacklist.length, offset);
    offset += 4;
    for (const address of config.blacklist) {
      instructionData.set(address.toBuffer(), offset);
      offset += 32;
    }
  }
  
  if (config.custom_logic) {
    const customLogicBytes = Buffer.from(config.custom_logic, 'utf8');
    instructionData.writeUInt32LE(customLogicBytes.length, offset);
    offset += 4;
    instructionData.set(customLogicBytes, offset);
    offset += customLogicBytes.length;
  }
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: transferHookPDA, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
    ],
    programId: TRANSFER_HOOK_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  const signature = await connection.sendTransaction(transaction, []);
  await connection.confirmTransaction(signature);
  
  return signature;
}

export async function removeTransferHook(
  connection: Connection,
  walletPublicKey: PublicKey,
  mint: PublicKey
): Promise<string> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  // Derive PDAs
  const [transferHookPDA] = getTransferHookPDA(mint);
  const [extraAccountMetasPDA] = getExtraAccountMetasPDA(mint);
  
  // Create instruction data
  const instructionData = Buffer.alloc(100);
  let offset = 0;
  
  // Add instruction discriminator (placeholder)
  instructionData.writeUInt32LE(0x44444444, offset);
  offset += 4;
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: transferHookPDA, isSigner: false, isWritable: true },
      { pubkey: extraAccountMetasPDA, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
    ],
    programId: TRANSFER_HOOK_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  const signature = await connection.sendTransaction(transaction, []);
  await connection.confirmTransaction(signature);
  
  return signature;
}

// Data fetching functions
export async function fetchTransferHookData(
  connection: Connection,
  mint: PublicKey
): Promise<TransferHookData | null> {
  try {
    const [transferHookPDA] = getTransferHookPDA(mint);
    const accountInfo = await connection.getAccountInfo(transferHookPDA);
    
    if (!accountInfo) return null;
    
    // Parse transfer hook data from account
    // This is a placeholder - implement proper deserialization
    return null;
  } catch (error) {
    console.error('Error fetching transfer hook data:', error);
    return null;
  }
}

export async function fetchAllTransferHooks(
  connection: Connection
): Promise<TransferHookData[]> {
  try {
    const programAccounts = await connection.getProgramAccounts(TRANSFER_HOOK_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from([0]).toString('base64'), // Transfer hook account type
          },
        },
      ],
    });

    const transferHooks: TransferHookData[] = [];
    
    for (const { account } of programAccounts) {
      try {
        // Parse transfer hook data from account
        // This is a placeholder - implement proper deserialization
      } catch (error) {
        console.error('Error parsing transfer hook data:', error);
      }
    }
    
    return transferHooks;
  } catch (error) {
    console.error('Error fetching transfer hooks:', error);
    return [];
  }
}

export async function fetchTransferHooksByAuthority(
  connection: Connection,
  authority: PublicKey
): Promise<TransferHookData[]> {
  try {
    const programAccounts = await connection.getProgramAccounts(TRANSFER_HOOK_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from([0]).toString('base64'), // Transfer hook account type
          },
        },
        {
          memcmp: {
            offset: 1, // Authority is at offset 1
            bytes: authority.toBase58(),
          },
        },
      ],
    });

    const transferHooks: TransferHookData[] = [];
    
    for (const { account } of programAccounts) {
      try {
        // Parse transfer hook data from account
        // This is a placeholder - implement proper deserialization
      } catch (error) {
        console.error('Error parsing transfer hook data:', error);
      }
    }
    
    return transferHooks;
  } catch (error) {
    console.error('Error fetching transfer hooks by authority:', error);
    return [];
  }
}

// Utility functions
export function calculateTransferFee(amount: number, feeRate: number): number {
  return Math.floor(amount * feeRate / 10000); // feeRate is in basis points
}

export function isTransferAllowed(
  amount: number,
  maxTransferAmount: number,
  whitelist: PublicKey[],
  blacklist: PublicKey[],
  user: PublicKey
): boolean {
  // Check amount limit
  if (amount > maxTransferAmount) return false;
  
  // Check blacklist
  if (blacklist.some(addr => addr.equals(user))) return false;
  
  // Check whitelist (if whitelist exists, user must be in it)
  if (whitelist.length > 0 && !whitelist.some(addr => addr.equals(user))) return false;
  
  return true;
}

export function validateTransferHookConfig(config: TransferHookConfig): string[] {
  const errors: string[] = [];
  
  if (config.fee_rate < 0 || config.fee_rate > 10000) {
    errors.push('Fee rate must be between 0 and 10000 basis points');
  }
  
  if (config.max_transfer_amount <= 0) {
    errors.push('Max transfer amount must be greater than 0');
  }
  
  if (config.whitelist.length > 0 && config.blacklist.length > 0) {
    const intersection = config.whitelist.filter(addr => 
      config.blacklist.some(blackAddr => blackAddr.equals(addr))
    );
    if (intersection.length > 0) {
      errors.push('Addresses cannot be both whitelisted and blacklisted');
    }
  }
  
  return errors;
}

// Export constants
export { TRANSFER_HOOK_PROGRAM_ID };

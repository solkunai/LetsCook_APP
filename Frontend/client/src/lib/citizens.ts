import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

// Citizens Program ID (update with actual deployed program ID)
const CITIZENS_PROGRAM_ID = new PublicKey('Citizens1111111111111111111111111111111111');

// Citizens Program Types
export interface CitizenData {
  account_type: number;
  user: PublicKey;
  name: string;
  level: number;
  experience: number;
  missions_completed: number;
  reputation: number;
  badges: number[];
  last_mission_time: number;
  total_rewards: number;
}

export interface MissionData {
  account_type: number;
  mission_id: number;
  creator: PublicKey;
  title: string;
  description: string;
  reward_amount: number;
  reward_token: PublicKey;
  requirements: MissionRequirement[];
  status: MissionStatus;
  participants: number;
  max_participants: number;
  start_time: number;
  end_time: number;
  created_at: number;
}

export interface MissionRequirement {
  requirement_type: number;
  target_value: number;
  current_value: number;
  description: string;
}

export enum MissionStatus {
  Active = 0,
  Completed = 1,
  Cancelled = 2,
  Expired = 3,
}

export interface MissionParticipation {
  account_type: number;
  user: PublicKey;
  mission_id: number;
  status: number;
  progress: number;
  started_at: number;
  completed_at: number;
  rewards_claimed: boolean;
}

// Helper functions to derive PDAs
export function getCitizenDataPDA(user: PublicKey, programId: PublicKey = CITIZENS_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('citizen'), user.toBuffer()],
    programId
  );
}

export function getMissionDataPDA(missionId: number, programId: PublicKey = CITIZENS_PROGRAM_ID): [PublicKey, number] {
  const missionIdBuffer = Buffer.alloc(4);
  missionIdBuffer.writeUInt32LE(missionId, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('mission'), missionIdBuffer],
    programId
  );
}

export function getMissionParticipationPDA(
  user: PublicKey,
  missionId: number,
  programId: PublicKey = CITIZENS_PROGRAM_ID
): [PublicKey, number] {
  const missionIdBuffer = Buffer.alloc(4);
  missionIdBuffer.writeUInt32LE(missionId, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('participation'), user.toBuffer(), missionIdBuffer],
    programId
  );
}

// Citizens Program Instructions
export async function initializeCitizen(
  connection: Connection,
  walletPublicKey: PublicKey,
  name: string
): Promise<string> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  // Derive citizen data PDA
  const [citizenPDA] = getCitizenDataPDA(walletPublicKey);
  
  // Create instruction data
  const instructionData = Buffer.alloc(100);
  let offset = 0;
  
  // Add instruction discriminator (placeholder)
  instructionData.writeUInt32LE(0x11111111, offset);
  offset += 4;
  
  // Add name length and data
  const nameBytes = Buffer.from(name, 'utf8');
  instructionData.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  instructionData.set(nameBytes, offset);
  offset += nameBytes.length;
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: citizenPDA, isSigner: false, isWritable: true },
    ],
    programId: CITIZENS_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  const signature = await connection.sendTransaction(transaction, []);
  await connection.confirmTransaction(signature);
  
  return signature;
}

export async function startMission(
  connection: Connection,
  walletPublicKey: PublicKey,
  missionId: number
): Promise<string> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  // Derive PDAs
  const [citizenPDA] = getCitizenDataPDA(walletPublicKey);
  const [missionPDA] = getMissionDataPDA(missionId);
  const [participationPDA] = getMissionParticipationPDA(walletPublicKey, missionId);
  
  // Create instruction data
  const instructionData = Buffer.alloc(100);
  let offset = 0;
  
  // Add instruction discriminator (placeholder)
  instructionData.writeUInt32LE(0x22222222, offset);
  offset += 4;
  
  // Add mission ID
  instructionData.writeUInt32LE(missionId, offset);
  offset += 4;
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: citizenPDA, isSigner: false, isWritable: true },
      { pubkey: missionPDA, isSigner: false, isWritable: true },
      { pubkey: participationPDA, isSigner: false, isWritable: true },
    ],
    programId: CITIZENS_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  const signature = await connection.sendTransaction(transaction, []);
  await connection.confirmTransaction(signature);
  
  return signature;
}

export async function resolveMission(
  connection: Connection,
  walletPublicKey: PublicKey,
  missionId: number,
  encryptedMove: Uint8Array
): Promise<string> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  // Derive PDAs
  const [citizenPDA] = getCitizenDataPDA(walletPublicKey);
  const [missionPDA] = getMissionDataPDA(missionId);
  const [participationPDA] = getMissionParticipationPDA(walletPublicKey, missionId);
  
  // Create instruction data
  const instructionData = Buffer.alloc(100);
  let offset = 0;
  
  // Add instruction discriminator (placeholder)
  instructionData.writeUInt32LE(0x33333333, offset);
  offset += 4;
  
  // Add mission ID
  instructionData.writeUInt32LE(missionId, offset);
  offset += 4;
  
  // Add encrypted move data
  instructionData.set(encryptedMove.slice(0, 32), offset);
  offset += 32;
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: citizenPDA, isSigner: false, isWritable: true },
      { pubkey: missionPDA, isSigner: false, isWritable: true },
      { pubkey: participationPDA, isSigner: false, isWritable: true },
    ],
    programId: CITIZENS_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  const signature = await connection.sendTransaction(transaction, []);
  await connection.confirmTransaction(signature);
  
  return signature;
}

export async function betrayMission(
  connection: Connection,
  walletPublicKey: PublicKey,
  missionId: number,
  targetUser: PublicKey
): Promise<string> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  // Derive PDAs
  const [citizenPDA] = getCitizenDataPDA(walletPublicKey);
  const [targetCitizenPDA] = getCitizenDataPDA(targetUser);
  const [missionPDA] = getMissionDataPDA(missionId);
  
  // Create instruction data
  const instructionData = Buffer.alloc(100);
  let offset = 0;
  
  // Add instruction discriminator (placeholder)
  instructionData.writeUInt32LE(0x44444444, offset);
  offset += 4;
  
  // Add mission ID
  instructionData.writeUInt32LE(missionId, offset);
  offset += 4;
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: citizenPDA, isSigner: false, isWritable: true },
      { pubkey: targetCitizenPDA, isSigner: false, isWritable: true },
      { pubkey: missionPDA, isSigner: false, isWritable: true },
    ],
    programId: CITIZENS_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  const signature = await connection.sendTransaction(transaction, []);
  await connection.confirmTransaction(signature);
  
  return signature;
}

// Data fetching functions
export async function fetchCitizenData(
  connection: Connection,
  user: PublicKey
): Promise<CitizenData | null> {
  try {
    const [citizenPDA] = getCitizenDataPDA(user);
    const accountInfo = await connection.getAccountInfo(citizenPDA);
    
    if (!accountInfo) return null;
    
    // Parse citizen data from account
    // This is a placeholder - implement proper deserialization
    return null;
  } catch (error) {
    console.error('Error fetching citizen data:', error);
    return null;
  }
}

export async function fetchMissionData(
  connection: Connection,
  missionId: number
): Promise<MissionData | null> {
  try {
    const [missionPDA] = getMissionDataPDA(missionId);
    const accountInfo = await connection.getAccountInfo(missionPDA);
    
    if (!accountInfo) return null;
    
    // Parse mission data from account
    // This is a placeholder - implement proper deserialization
    return null;
  } catch (error) {
    console.error('Error fetching mission data:', error);
    return null;
  }
}

export async function fetchAllMissions(
  connection: Connection
): Promise<MissionData[]> {
  try {
    const programAccounts = await connection.getProgramAccounts(CITIZENS_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from([1]).toString('base64'), // Mission account type
          },
        },
      ],
    });

    const missions: MissionData[] = [];
    
    for (const { account } of programAccounts) {
      try {
        // Parse mission data from account
        // This is a placeholder - implement proper deserialization
      } catch (error) {
        console.error('Error parsing mission data:', error);
      }
    }
    
    return missions;
  } catch (error) {
    console.error('Error fetching missions:', error);
    return [];
  }
}

export async function fetchUserMissions(
  connection: Connection,
  user: PublicKey
): Promise<MissionParticipation[]> {
  try {
    const programAccounts = await connection.getProgramAccounts(CITIZENS_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from([2]).toString('base64'), // Participation account type
          },
        },
        {
          memcmp: {
            offset: 1,
            bytes: user.toBase58(),
          },
        },
      ],
    });

    const participations: MissionParticipation[] = [];
    
    for (const { account } of programAccounts) {
      try {
        // Parse participation data from account
        // This is a placeholder - implement proper deserialization
      } catch (error) {
        console.error('Error parsing participation data:', error);
      }
    }
    
    return participations;
  } catch (error) {
    console.error('Error fetching user missions:', error);
    return [];
  }
}

// Utility functions
export function calculateExperienceReward(missionDifficulty: number, completionTime: number): number {
  const baseReward = missionDifficulty * 100;
  const timeBonus = Math.max(0, 1000 - completionTime) / 10;
  return Math.floor(baseReward + timeBonus);
}

export function calculateReputationChange(success: boolean, betrayal: boolean): number {
  if (betrayal) return -50;
  if (success) return 25;
  return -10;
}

export function getLevelFromExperience(experience: number): number {
  return Math.floor(experience / 1000) + 1;
}

export function getRequiredExperienceForLevel(level: number): number {
  return (level - 1) * 1000;
}

// Export constants
export { CITIZENS_PROGRAM_ID };

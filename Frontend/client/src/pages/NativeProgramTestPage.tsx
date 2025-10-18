import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { LetsCookProgram, LaunchInstruction, SetNameArgs, HypeVoteArgs, PROGRAM_ID } from '../lib/nativeProgram';
import { serialize } from 'borsh';

const NativeProgramTestPage: React.FC = () => {
  const { publicKey, signTransaction, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [userName, setUserName] = useState('');
  const [voteValue, setVoteValue] = useState(1);

  // Use devnet for testing
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  const handleInit = async () => {
    if (!publicKey || !signTransaction) {
      setResult('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setResult('Initializing program...');

    try {
      // Generate new keypairs for the accounts
      const cookDataKeypair = Keypair.generate();
      const cookPdaKeypair = Keypair.generate();
      
      const transaction = new Transaction();

      // Create cook_data account
      const cookDataSpace = 200;
      const cookDataLamports = await connection.getMinimumBalanceForRentExemption(cookDataSpace);
      
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: cookDataKeypair.publicKey,
          space: cookDataSpace,
          lamports: cookDataLamports,
          programId: PROGRAM_ID,
        })
      );

      // Create cook_pda account
      const cookPdaSpace = 100;
      const cookPdaLamports = await connection.getMinimumBalanceForRentExemption(cookPdaSpace);
      
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: cookPdaKeypair.publicKey,
          space: cookPdaSpace,
          lamports: cookPdaLamports,
          programId: PROGRAM_ID,
        })
      );

      // Add the init instruction
      const initInstruction = LetsCookProgram.createInitInstruction(
        publicKey, // user
        cookDataKeypair.publicKey, // cookData
        cookPdaKeypair.publicKey, // cookPda
      );
      transaction.add(initInstruction);
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      
      // We need to add the keypair signatures for the new accounts
      signedTransaction.sign(cookDataKeypair, cookPdaKeypair);
      
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      setResult(`✅ Init successful! 
      
Cook Data Account: ${cookDataKeypair.publicKey.toString()}
Cook PDA Account: ${cookPdaKeypair.publicKey.toString()}
Signature: ${signature}

The program has been initialized successfully!`);
      
    } catch (error) {
      setResult(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSerialization = async () => {
    if (!publicKey || !signTransaction) {
      setResult('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setResult('Testing instruction serialization...');

    try {
      // Test just the instruction serialization without sending
      const setNameArgs: SetNameArgs = { name: "Test User" };
      
      // Create instruction data
      const instructionData = Buffer.alloc(1);
      instructionData.writeUInt8(LaunchInstruction.SetName, 0);
      
      // Serialize args
      const argsBuffer = Buffer.from(serialize(setNameArgs));
      const fullData = Buffer.concat([instructionData, argsBuffer]);
      
      setResult(`✅ Serialization test successful!
      
Instruction Data (hex): ${fullData.toString('hex')}
Instruction: ${LaunchInstruction.SetName}
Args: ${JSON.stringify(setNameArgs)}
Data Length: ${fullData.length} bytes

This shows the instruction is properly serialized for your native program.`);
      
    } catch (error) {
      setResult(`❌ Serialization Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetName = async () => {
    if (!publicKey || !signTransaction || !userName) {
      setResult('Please connect wallet and enter a name');
      return;
    }

    setLoading(true);
    setResult('Setting name...');

    try {
      const setNameArgs: SetNameArgs = { name: userName };
      
      const setNameInstruction = LetsCookProgram.createSetNameInstruction(
        setNameArgs,
        {
          user: publicKey,
          userData: publicKey, // Using user as placeholder
          systemProgram: new PublicKey('11111111111111111111111111111111'),
        }
      );

      const transaction = new Transaction().add(setNameInstruction);
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signedTransaction = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      setResult(`✅ Name set successfully! Signature: ${signature}`);
    } catch (error) {
      setResult(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleHypeVote = async () => {
    if (!publicKey || !signTransaction) {
      setResult('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setResult('Submitting hype vote...');

    try {
      const hypeVoteArgs: HypeVoteArgs = { vote: voteValue };
      
      const hypeVoteInstruction = LetsCookProgram.createHypeVoteInstruction(
        hypeVoteArgs,
        {
          user: publicKey,
          userData: publicKey, // Using user as placeholder
          systemProgram: new PublicKey('11111111111111111111111111111111'),
        }
      );

      const transaction = new Transaction().add(hypeVoteInstruction);
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signedTransaction = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      setResult(`✅ Hype vote submitted! Signature: ${signature}`);
    } catch (error) {
      setResult(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckTickets = async () => {
    if (!publicKey || !signTransaction) {
      setResult('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setResult('Checking tickets...');

    try {
      const checkTicketsInstruction = LetsCookProgram.createCheckTicketsInstruction({
        user: publicKey,
        userData: publicKey, // Using user as placeholder
        joinData: publicKey, // Using user as placeholder
        launchData: publicKey, // Using user as placeholder
        systemProgram: new PublicKey('11111111111111111111111111111111'),
      });

      const transaction = new Transaction().add(checkTicketsInstruction);
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signedTransaction = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      setResult(`✅ Tickets checked! Signature: ${signature}`);
    } catch (error) {
      setResult(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl">
          <h1 className="text-4xl font-bold text-white mb-2 text-center">
            🚀 LetsCook Native Program Test
          </h1>
          <p className="text-white/80 text-center mb-8">
            Test your deployed native Solana program
          </p>
          
          <div className="bg-white/5 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Program Info</h2>
            <div className="text-white/80 space-y-2">
              <p><strong>Program ID:</strong> ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ</p>
              <p><strong>Network:</strong> Devnet</p>
              <p><strong>Wallet:</strong> {connected ? publicKey?.toString() : 'Not connected'}</p>
            </div>
          </div>

          {!connected && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
              <p className="text-yellow-200 text-center">
                ⚠️ Please connect your wallet to interact with the program
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Initialize Program */}
            <div className="bg-white/5 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Initialize Program</h3>
              <p className="text-white/70 text-sm mb-4">
                Create accounts and initialize the LetsCook program
              </p>
              <button
                onClick={handleInit}
                disabled={loading || !connected}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Initializing...' : 'Initialize Program'}
              </button>
            </div>

            {/* Test Serialization */}
            <div className="bg-white/5 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Test Serialization</h3>
              <p className="text-white/70 text-sm mb-4">
                Test instruction data serialization without sending transaction
              </p>
              <button
                onClick={handleTestSerialization}
                disabled={loading || !connected}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Testing...' : 'Test Serialization'}
              </button>
            </div>

            {/* Set Name */}
            <div className="bg-white/5 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Set User Name</h3>
              <p className="text-white/70 text-sm mb-4">
                Set a display name for your account
              </p>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/50 mb-4"
              />
              <button
                onClick={handleSetName}
                disabled={loading || !connected || !userName}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Setting...' : 'Set Name'}
              </button>
            </div>

            {/* Hype Vote */}
            <div className="bg-white/5 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Hype Vote</h3>
              <p className="text-white/70 text-sm mb-4">
                Submit a hype vote (1-5)
              </p>
              <input
                type="number"
                min="1"
                max="5"
                value={voteValue}
                onChange={(e) => setVoteValue(parseInt(e.target.value))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/50 mb-4"
              />
              <button
                onClick={handleHypeVote}
                disabled={loading || !connected}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-black font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Voting...' : 'Submit Vote'}
              </button>
            </div>

            {/* Check Tickets */}
            <div className="bg-white/5 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Check Tickets</h3>
              <p className="text-white/70 text-sm mb-4">
                Check your ticket status for launches
              </p>
              <button
                onClick={handleCheckTickets}
                disabled={loading || !connected}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Checking...' : 'Check Tickets'}
              </button>
            </div>
          </div>

          {/* Result Display */}
          {result && (
            <div className="bg-white/5 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Result</h3>
              <div className="bg-black/20 rounded-lg p-4">
                <pre className="text-white/80 text-sm whitespace-pre-wrap break-words">
                  {result}
                </pre>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-white/5 rounded-xl p-6 mt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Instructions</h3>
            <div className="text-white/70 text-sm space-y-2">
              <p>1. Connect your Solana wallet (Phantom, Solflare, etc.)</p>
              <p>2. Make sure you're on Devnet</p>
              <p>3. Start with "Initialize Program" to create accounts</p>
              <p>4. Try "Test Serialization" to verify instruction format</p>
              <p>5. The other functions require proper account setup</p>
              <p>6. Check the result section for detailed information</p>
              <p>7. Use Solana Explorer to view transaction details</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NativeProgramTestPage;
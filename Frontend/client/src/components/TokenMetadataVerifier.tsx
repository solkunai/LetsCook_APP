import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Loader2, Eye, ExternalLink, Copy } from 'lucide-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { LaunchpadTokenMetadataService } from '@/lib/launchpadTokenMetadataService';
import { toast } from '@/hooks/use-toast';

interface TokenMetadataVerifierProps {
  tokenMint?: string;
  onTokenMintChange?: (mint: string) => void;
}

export const TokenMetadataVerifier: React.FC<TokenMetadataVerifierProps> = ({
  tokenMint: initialTokenMint,
  onTokenMintChange
}) => {
  const [tokenMint, setTokenMint] = useState(initialTokenMint || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    hasMetadata: boolean;
    isWalletVisible: boolean;
    displayInfo?: {
      name: string;
      symbol: string;
      image?: string;
      description?: string;
      decimals: number;
    };
    metadataUri?: string;
  } | null>(null);

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  const handleVerify = async () => {
    if (!tokenMint.trim()) {
      toast({
        title: "Token Mint Required",
        description: "Please enter a token mint address to verify.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsVerifying(true);
      setVerificationResult(null);

      const mint = new PublicKey(tokenMint.trim());
      const result = await LaunchpadTokenMetadataService.verifyLaunchedToken(connection, mint);
      
      setVerificationResult(result);

      if (result.hasMetadata && result.isWalletVisible) {
        toast({
          title: "Token Verified!",
          description: "This token will be visible in Solana wallets with proper metadata.",
        });
      } else {
        toast({
          title: "Token Issues Detected",
          description: "This token may show as 'Unknown Token' in wallets.",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Error verifying token:', error);
      toast({
        title: "Verification Failed",
        description: "Could not verify token metadata. Please check the mint address.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTokenMintChange = (value: string) => {
    setTokenMint(value);
    if (onTokenMintChange) {
      onTokenMintChange(value);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Token mint address copied to clipboard.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Token Mint Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white">
          Token Mint Address
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tokenMint}
            onChange={(e) => handleTokenMintChange(e.target.value)}
            placeholder="Enter token mint address (e.g., DFWjWGiaFRW53AG8rUnRkcucpkeRZP1aexaUyrZ4oDsz)"
            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleVerify}
            disabled={isVerifying || !tokenMint.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isVerifying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {isVerifying ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </div>

      {/* Verification Results */}
      {verificationResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">Verification Results</h3>
            {verificationResult.hasMetadata && verificationResult.isWalletVisible ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border ${
              verificationResult.hasMetadata 
                ? 'bg-green-900/30 border-green-500' 
                : 'bg-red-900/30 border-red-500'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {verificationResult.hasMetadata ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="font-medium text-white">Metadata Status</span>
              </div>
              <p className="text-sm text-gray-200">
                {verificationResult.hasMetadata 
                  ? 'Token has proper metadata' 
                  : 'Token missing metadata'
                }
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${
              verificationResult.isWalletVisible 
                ? 'bg-green-900/30 border-green-500' 
                : 'bg-red-900/30 border-red-500'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {verificationResult.isWalletVisible ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="font-medium text-white">Wallet Visibility</span>
              </div>
              <p className="text-sm text-gray-200">
                {verificationResult.isWalletVisible 
                  ? 'Will be visible in wallets' 
                  : 'May show as "Unknown Token"'
                }
              </p>
            </div>
          </div>

          {/* Token Details */}
          {verificationResult.displayInfo && (
            <div className="bg-slate-700 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-white">Token Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium text-gray-300">Name:</span>
                  <span className="ml-2 text-white">{verificationResult.displayInfo.name}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-300">Symbol:</span>
                  <span className="ml-2 text-white">{verificationResult.displayInfo.symbol}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-300">Decimals:</span>
                  <span className="ml-2 text-white">{verificationResult.displayInfo.decimals}</span>
                </div>
                {verificationResult.displayInfo.image && (
                  <div className="md:col-span-2">
                    <span className="font-medium text-gray-300">Image:</span>
                    <div className="mt-1 flex items-center gap-2">
                      <img 
                        src={verificationResult.displayInfo.image} 
                        alt="Token" 
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <a 
                        href={verificationResult.displayInfo.image}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        View Image
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata URI */}
          {verificationResult.metadataUri && (
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-white">Metadata URI</h4>
                <button
                  onClick={() => copyToClipboard(verificationResult.metadataUri!)}
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              <p className="text-sm text-gray-200 break-all">
                {verificationResult.metadataUri}
              </p>
              <a 
                href={verificationResult.metadataUri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 mt-2"
              >
                View Metadata JSON
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Recommendations */}
          {(!verificationResult.hasMetadata || !verificationResult.isWalletVisible) && (
            <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4">
              <h4 className="font-medium text-yellow-200 mb-2">Recommendations</h4>
              <ul className="text-sm text-yellow-100 space-y-1">
                <li>• Ensure your backend is using SPL Token-2022 mint interface</li>
                <li>• Verify the metadata URI is accessible and contains valid JSON</li>
                <li>• Check that the token was created with proper metadata initialization</li>
                <li>• Contact support if the issue persists</li>
              </ul>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
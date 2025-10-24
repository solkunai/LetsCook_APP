import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Upload, CheckCircle2, AlertCircle, Loader2, Eye, ExternalLink, Copy } from 'lucide-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { LaunchpadTokenMetadataService } from '@/lib/launchpadTokenMetadataService';
import { updateTokenMetadata } from '@/lib/tokenMetadataUtils';
import { toast } from '@/hooks/use-toast';

interface TokenMetadataUpdaterProps {
  tokenMint?: string;
  onTokenMintChange?: (mint: string) => void;
}

export const TokenMetadataUpdater: React.FC<TokenMetadataUpdaterProps> = ({
  tokenMint: initialTokenMint,
  onTokenMintChange
}) => {
  const [tokenMint, setTokenMint] = useState(initialTokenMint || '');
  const [isUpdating, setIsUpdating] = useState(false);
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
  
  const [updateForm, setUpdateForm] = useState({
    name: '',
    symbol: '',
    description: '',
    image: '',
    website: '',
    twitter: '',
    telegram: '',
    discord: '',
    launchType: 'instant' as 'instant' | 'raffle',
    creatorWallet: ''
  });

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

      // Pre-fill the form with existing data
      if (result.displayInfo) {
        setUpdateForm(prev => ({
          ...prev,
          name: result.displayInfo?.name || '',
          symbol: result.displayInfo?.symbol || '',
          description: result.displayInfo?.description || '',
          image: result.displayInfo?.image || '',
          creatorWallet: 'YOUR_WALLET_ADDRESS' // User should replace this
        }));
      }

      if (result.hasMetadata && result.isWalletVisible) {
        toast({
          title: "Token Verified!",
          description: "This token has proper metadata and is visible in wallets.",
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

  const handleUpdate = async () => {
    if (!tokenMint.trim()) {
      toast({
        title: "Token Mint Required",
        description: "Please enter a token mint address.",
        variant: "destructive",
      });
      return;
    }

    if (!updateForm.name || !updateForm.symbol || !updateForm.description) {
      toast({
        title: "Required Fields Missing",
        description: "Please fill in name, symbol, and description.",
        variant: "destructive",
      });
      return;
    }

    if (updateForm.creatorWallet === 'YOUR_WALLET_ADDRESS') {
      toast({
        title: "Creator Wallet Required",
        description: "Please enter the actual creator wallet address.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUpdating(true);

      const result = await updateTokenMetadata(tokenMint.trim(), updateForm);
      
      if (result.success) {
        toast({
          title: "Metadata Updated!",
          description: "Token metadata has been updated successfully.",
        });
        
        // Re-verify the token to show updated status
        await handleVerify();
      } else {
        toast({
          title: "Update Failed",
          description: result.error || "Failed to update token metadata.",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Error updating token:', error);
      toast({
        title: "Update Failed",
        description: "Could not update token metadata. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
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
        <label className="text-sm font-medium text-gray-700">
          Token Mint Address
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tokenMint}
            onChange={(e) => handleTokenMintChange(e.target.value)}
            placeholder="Enter token mint address (e.g., DFWjWGiaFRW53AG8rUnRkcucpkeRZP1aexaUyrZ4oDsz)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Current Token Status */}
      {verificationResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-lg p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Current Token Status</h3>
            {verificationResult.hasMetadata && verificationResult.isWalletVisible ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border ${
              verificationResult.hasMetadata 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {verificationResult.hasMetadata ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="font-medium">Metadata Status</span>
              </div>
              <p className="text-sm text-gray-600">
                {verificationResult.hasMetadata 
                  ? 'Token has proper metadata' 
                  : 'Token missing metadata'
                }
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${
              verificationResult.isWalletVisible 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {verificationResult.isWalletVisible ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="font-medium">Wallet Visibility</span>
              </div>
              <p className="text-sm text-gray-600">
                {verificationResult.isWalletVisible 
                  ? 'Will be visible in wallets' 
                  : 'May show as "Unknown Token"'
                }
              </p>
            </div>
          </div>

          {verificationResult.metadataUri && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">Current Metadata URI</h4>
                <button
                  onClick={() => copyToClipboard(verificationResult.metadataUri!)}
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              <p className="text-sm text-gray-600 break-all">
                {verificationResult.metadataUri}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Update Form */}
      {verificationResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-lg p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Update Token Metadata</h3>
            <RefreshCw className="w-5 h-5 text-blue-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Token Name *
              </label>
              <input
                type="text"
                value={updateForm.name}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter token name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Token Symbol *
              </label>
              <input
                type="text"
                value={updateForm.symbol}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, symbol: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter token symbol"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={updateForm.description}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Enter token description"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL
              </label>
              <input
                type="url"
                value={updateForm.image}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, image: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://gateway.pinata.cloud/ipfs/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                value={updateForm.website}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, website: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://yourwebsite.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Twitter
              </label>
              <input
                type="url"
                value={updateForm.twitter}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, twitter: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://twitter.com/yourhandle"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telegram
              </label>
              <input
                type="url"
                value={updateForm.telegram}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, telegram: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://t.me/yourgroup"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discord
              </label>
              <input
                type="url"
                value={updateForm.discord}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, discord: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://discord.gg/yourserver"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Launch Type
              </label>
              <select
                value={updateForm.launchType}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, launchType: e.target.value as 'instant' | 'raffle' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="instant">Instant Launch</option>
                <option value="raffle">Raffle Launch</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Creator Wallet Address *
              </label>
              <input
                type="text"
                value={updateForm.creatorWallet}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, creatorWallet: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter creator wallet address"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleUpdate}
              disabled={isUpdating || !updateForm.name || !updateForm.symbol || !updateForm.description}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isUpdating ? 'Updating...' : 'Update Metadata'}
            </button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Important Note</h4>
            <p className="text-sm text-yellow-700">
              This creates new metadata on IPFS. The token's on-chain metadata URI would need to be updated separately 
              through your backend program to make the changes visible in wallets.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};
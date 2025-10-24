import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Eye, CheckCircle2, AlertCircle, ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { LaunchpadTokenMetadataService } from '@/lib/launchpadTokenMetadataService';
import { TokenMetadataVerifier } from '@/components/TokenMetadataVerifier';
import { TokenMetadataUpdater } from '@/components/TokenMetadataUpdater';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';

interface TokenVerificationResult {
  mint: string;
  hasMetadata: boolean;
  isWalletVisible: boolean;
  name?: string;
  symbol?: string;
  error?: string;
}

export default function TokenVerificationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [verificationResults, setVerificationResults] = useState<TokenVerificationResult[]>([]);
  const [recentTokens, setRecentTokens] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'verify' | 'update'>('verify');

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Load recent tokens from localStorage
  useEffect(() => {
    const savedTokens = localStorage.getItem('recent_token_mints');
    if (savedTokens) {
      try {
        setRecentTokens(JSON.parse(savedTokens));
      } catch (error) {
        console.error('Error loading recent tokens:', error);
      }
    }
  }, []);

  // Save token to recent list
  const saveToRecentTokens = (tokenMint: string) => {
    const updatedTokens = [tokenMint, ...recentTokens.filter(t => t !== tokenMint)].slice(0, 10);
    setRecentTokens(updatedTokens);
    localStorage.setItem('recent_token_mints', JSON.stringify(updatedTokens));
  };

  const handleBatchVerify = async (tokenMints: string[]) => {
    if (tokenMints.length === 0) {
      toast({
        title: "No Tokens to Verify",
        description: "Please enter at least one token mint address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setVerificationResults([]);

    try {
      const results = await LaunchpadTokenMetadataService.batchVerifyTokens(connection, tokenMints);
      setVerificationResults(results);

      const successCount = results.filter(r => r.hasMetadata && r.isWalletVisible).length;
      const totalCount = results.length;

      toast({
        title: "Batch Verification Complete",
        description: `${successCount}/${totalCount} tokens have proper metadata and wallet visibility.`,
      });

    } catch (error) {
      console.error('Error in batch verification:', error);
      toast({
        title: "Verification Failed",
        description: "Could not verify tokens. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSingleVerify = (tokenMint: string) => {
    saveToRecentTokens(tokenMint);
    handleBatchVerify([tokenMint]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Token mint address copied to clipboard.",
    });
  };

  const getStatusIcon = (result: TokenVerificationResult) => {
    if (result.error) {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    if (result.hasMetadata && result.isWalletVisible) {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    return <AlertCircle className="w-5 h-5 text-yellow-500" />;
  };

  const getStatusText = (result: TokenVerificationResult) => {
    if (result.error) {
      return 'Error';
    }
    if (result.hasMetadata && result.isWalletVisible) {
      return 'Perfect';
    }
    if (result.hasMetadata) {
      return 'Has Metadata';
    }
    return 'Issues';
  };

  const getStatusColor = (result: TokenVerificationResult) => {
    if (result.error) {
      return 'text-red-600 bg-red-50 border-red-200';
    }
    if (result.hasMetadata && result.isWalletVisible) {
      return 'text-green-600 bg-green-50 border-green-200';
    }
    if (result.hasMetadata) {
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Token Metadata Manager
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Verify and update metadata for your launched tokens. Ensure they are visible in Solana wallets.
              This tool works with SPL Token-2022 metadata interface used by Let's Cook launchpad.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center">
            <div className="bg-white rounded-lg p-1 border border-gray-200">
              <button
                onClick={() => setActiveTab('verify')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === 'verify'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Verify Tokens
              </button>
              <button
                onClick={() => setActiveTab('update')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === 'update'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Update Metadata
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'verify' ? (
            <>
              {/* Single Token Verification */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Verify Single Token
                </h2>
                <TokenMetadataVerifier onTokenMintChange={handleSingleVerify} />
              </div>
            </>
          ) : (
            <>
              {/* Token Metadata Updater */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Update Token Metadata
                </h2>
                <TokenMetadataUpdater />
              </div>
            </>
          )}

          {/* Recent Tokens - Only show in verify tab */}
          {recentTokens.length > 0 && activeTab === 'verify' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Recent Tokens
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentTokens.map((tokenMint, index) => (
                  <button
                    key={index}
                    onClick={() => handleSingleVerify(tokenMint)}
                    className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-mono text-sm text-gray-600 break-all">
                      {tokenMint.slice(0, 8)}...{tokenMint.slice(-8)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Click to verify</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Batch Verification Results - Only show in verify tab */}
          {verificationResults.length > 0 && activeTab === 'verify' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Verification Results
                </h2>
                <div className="text-sm text-gray-500">
                  {verificationResults.length} token{verificationResults.length !== 1 ? 's' : ''} verified
                </div>
              </div>

              <div className="space-y-3">
                {verificationResults.map((result, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-4 rounded-lg border ${getStatusColor(result)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(result)}
                        <div>
                          <div className="font-medium">
                            {result.name || 'Unknown Token'} ({result.symbol || 'UNK'})
                          </div>
                          <div className="font-mono text-sm opacity-75">
                            {result.mint.slice(0, 8)}...{result.mint.slice(-8)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {getStatusText(result)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(result.mint)}
                          className="p-1 hover:bg-black hover:bg-opacity-10 rounded"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={`https://explorer.solana.com/address/${result.mint}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-black hover:bg-opacity-10 rounded"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>

                    {result.error && (
                      <div className="mt-2 text-sm opacity-75">
                        Error: {result.error}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Information Panel */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              How Token Metadata Works
            </h3>
            <div className="space-y-3 text-blue-800">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 mt-0.5 text-blue-600" />
                <div>
                  <strong>SPL Token-2022:</strong> Your backend uses SPL Token-2022 with built-in metadata interface
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 mt-0.5 text-blue-600" />
                <div>
                  <strong>Pinata IPFS:</strong> Metadata JSON is stored on IPFS via Pinata for permanent access
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 mt-0.5 text-blue-600" />
                <div>
                  <strong>Wallet Visibility:</strong> Tokens with proper metadata appear correctly in Solana wallets
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 mt-0.5 text-blue-600" />
                <div>
                  <strong>If Issues:</strong> Check that your backend properly initialized the token with metadata
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
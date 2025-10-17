import React, { useState, useEffect } from 'react';
import { ipfsMetadataService } from '@/lib/ipfsMetadataService';
import { Trash2, RefreshCw, Database, Image, BarChart3 } from 'lucide-react';

interface CacheStats {
  memoryCache: { size: number; keys: string[] };
  localCache: { count: number };
}

export const ImageCacheManager: React.FC = () => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const cacheStats = await ipfsMetadataService.getCacheStats();
      setStats(cacheStats);
    } catch (error) {
      console.error('❌ Error fetching cache stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearExpiredCache = async () => {
    try {
      setLoading(true);
      await ipfsMetadataService.clearExpiredCache();
      await fetchStats();
    } catch (error) {
      console.error('❌ Error clearing expired cache:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAllCache = async () => {
    try {
      setLoading(true);
      await ipfsMetadataService.clearAllCaches();
      await fetchStats();
    } catch (error) {
      console.error('❌ Error clearing all cache:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (!stats) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="flex items-center space-x-2 text-slate-400">
          <BarChart3 className="w-4 h-4" />
          <span>Loading cache stats...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Database className="w-5 h-5" />
          <span>Image Cache Manager</span>
        </h3>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="flex items-center space-x-2 text-slate-300 mb-1">
            <Image className="w-4 h-4" />
            <span className="text-sm">Memory Cache</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.memoryCache.size}</div>
          <div className="text-xs text-slate-500">URLs cached</div>
        </div>

        <div className="bg-slate-800 rounded-lg p-3">
          <div className="flex items-center space-x-2 text-slate-300 mb-1">
            <Database className="w-4 h-4" />
            <span className="text-sm">Local Cache</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.localCache.count}</div>
          <div className="text-xs text-slate-500">Images stored</div>
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={clearExpiredCache}
          disabled={loading}
          className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Expired</span>
        </button>
        
        <button
          onClick={clearAllCache}
          disabled={loading}
          className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear All</span>
        </button>
      </div>

      {stats.memoryCache.keys.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Cached URLs:</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {stats.memoryCache.keys.slice(0, 10).map((key, index) => (
              <div key={index} className="text-xs text-slate-500 font-mono bg-slate-800 rounded px-2 py-1">
                {key.slice(0, 20)}...
              </div>
            ))}
            {stats.memoryCache.keys.length > 10 && (
              <div className="text-xs text-slate-500">
                ... and {stats.memoryCache.keys.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageCacheManager;
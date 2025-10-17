import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { marketDataService, PriceHistory } from '@/lib/marketDataService';

interface PriceData {
  timestamp: number;
  price: number;
  volume: number;
}

interface PriceChartProps {
  tokenMint: string;
  initialPrice: number;
  className?: string;
}

const PriceChart: React.FC<PriceChartProps> = ({ 
  tokenMint, 
  initialPrice, 
  className = '' 
}) => {
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [currentPrice, setCurrentPrice] = useState(initialPrice);
  const [priceChange, setPriceChange] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d'>('24h');
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate mock data as fallback
  const generateMockData = (timeframe: string) => {
    const now = Date.now();
    const intervals = {
      '1h': 60 * 60 * 1000, // 1 hour
      '24h': 24 * 60 * 60 * 1000, // 24 hours
      '7d': 7 * 24 * 60 * 60 * 1000 // 7 days
    };
    
    const interval = intervals[timeframe as keyof typeof intervals];
    const dataPoints = timeframe === '1h' ? 60 : timeframe === '24h' ? 24 : 7;
    const step = interval / dataPoints;
    
    const data: PriceData[] = [];
    let currentPrice = initialPrice;
    
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = now - (dataPoints - i) * step;
      // Simulate price movement with some volatility
      const volatility = 0.05; // 5% volatility
      const change = (Math.random() - 0.5) * volatility;
      currentPrice = currentPrice * (1 + change);
      
      data.push({
        timestamp,
        price: Math.max(currentPrice, initialPrice * 0.1), // Don't go below 10% of initial price
        volume: Math.random() * 1000 + 100 // Random volume between 100-1100
      });
    }
    
    return data;
  };

  // Fetch real blockchain price data
  const fetchPriceData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('📊 Fetching real blockchain price data for:', tokenMint);
      
      // Get real price history from blockchain
      const blockchainData = await marketDataService.getPriceHistory(tokenMint, timeframe);
      
      // Convert to our format
      const formattedData: PriceData[] = blockchainData.map(point => ({
        timestamp: point.timestamp,
        price: point.price,
        volume: point.volume
      }));
      
      setPriceData(formattedData);
      
      if (formattedData.length > 0) {
        const latestPrice = formattedData[formattedData.length - 1].price;
        setCurrentPrice(latestPrice);
        setPriceChange(((latestPrice - initialPrice) / initialPrice) * 100);
      }
      
      console.log('✅ Real blockchain price data loaded:', formattedData.length, 'points');
    } catch (error) {
      console.error('❌ Error fetching blockchain price data:', error);
      setError('Failed to load price data from blockchain');
      
      // Fallback to mock data
      console.log('🔄 Using fallback mock data');
      const mockData = generateMockData(timeframe);
      setPriceData(mockData);
      
      if (mockData.length > 0) {
        const latestPrice = mockData[mockData.length - 1].price;
        setCurrentPrice(latestPrice);
        setPriceChange(((latestPrice - initialPrice) / initialPrice) * 100);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Draw chart
  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas || priceData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Find min and max prices
    const prices = priceData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const padding = priceRange * 0.1; // 10% padding

    // Draw grid lines
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw price line
    ctx.strokeStyle = priceChange >= 0 ? '#10b981' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();

    priceData.forEach((point, index) => {
      const x = (width / (priceData.length - 1)) * index;
      const y = height - ((point.price - minPrice + padding) / (priceRange + padding * 2)) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw area under curve
    ctx.fillStyle = priceChange >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, height);
    
    priceData.forEach((point, index) => {
      const x = (width / (priceData.length - 1)) * index;
      const y = height - ((point.price - minPrice + padding) / (priceRange + padding * 2)) * height;
      ctx.lineTo(x, y);
    });
    
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Draw price points
    ctx.fillStyle = priceChange >= 0 ? '#10b981' : '#ef4444';
    priceData.forEach((point, index) => {
      const x = (width / (priceData.length - 1)) * index;
      const y = height - ((point.price - minPrice + padding) / (priceRange + padding * 2)) * height;
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  // Auto-refresh data
  useEffect(() => {
    fetchPriceData();
    
    // Set up auto-refresh every 30 seconds
    intervalRef.current = setInterval(fetchPriceData, 30000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeframe, tokenMint]);

  // Redraw chart when data changes
  useEffect(() => {
    drawChart();
  }, [priceData]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      drawChart();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [priceData]);

  const formatPrice = (price: number | undefined) => {
    if (price === undefined || price === null || isNaN(price)) {
      return '0.000000';
    }
    
    if (price < 0.01) {
      return price.toFixed(6);
    } else if (price < 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(2);
    }
  };

  const formatTimeframe = (tf: string) => {
    switch (tf) {
      case '1h': return '1 Hour';
      case '24h': return '24 Hours';
      case '7d': return '7 Days';
      default: return tf;
    }
  };

  return (
    <div className={`bg-slate-900 rounded-2xl border border-slate-800 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white mb-2 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-400" />
            Real-time Price Chart
            {error && (
              <span className="ml-2 text-xs text-yellow-400">
                (Using fallback data)
              </span>
            )}
          </h3>
          <div className="flex items-center space-x-4">
            <div className="text-2xl font-bold text-white">
              {formatPrice(currentPrice)} SOL
            </div>
            <div className={`flex items-center text-sm ${
              (priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {(priceChange || 0) >= 0 ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              {Math.abs(priceChange || 0).toFixed(2)}%
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-800 rounded-lg p-1">
            {(['1h', '24h', '7d'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  timeframe === tf
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          
          <button
            onClick={fetchPriceData}
            disabled={isLoading}
            className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-slate-400">
              <Activity className="w-5 h-5 animate-pulse" />
              <span>Loading blockchain data...</span>
            </div>
          </div>
        ) : (
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={800}
              height={256}
              className="w-full h-64 bg-slate-800/50 rounded-lg"
            />
            
            {/* Chart overlay info */}
            <div className="absolute top-4 left-4 text-xs text-slate-400">
              <div>Timeframe: {formatTimeframe(timeframe)}</div>
              <div>Data Points: {priceData.length}</div>
              <div>Source: {error ? 'Fallback Data' : 'Blockchain'}</div>
            </div>
            
            {/* Price range info */}
            {priceData.length > 0 && (
              <div className="absolute top-4 right-4 text-xs text-slate-400 text-right">
                <div>High: {formatPrice(Math.max(...priceData.map(d => d.price)))} SOL</div>
                <div>Low: {formatPrice(Math.min(...priceData.map(d => d.price)))} SOL</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart Stats */}
      {priceData.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-slate-400">Volume (24h)</div>
            <div className="text-white font-semibold">
              {priceData.reduce((sum, d) => sum + d.volume, 0).toFixed(0)} SOL
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-slate-400">Price Change</div>
            <div className={`font-semibold ${
              (priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {(priceChange || 0) >= 0 ? '+' : ''}{(priceChange || 0).toFixed(2)}%
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-slate-400">Market Cap</div>
            <div className="text-white font-semibold">
              ${((currentPrice || 0) * 1000000).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 text-sm">
            ⚠️ {error}. Showing simulated data instead.
          </p>
        </div>
      )}
    </div>
  );
};

export default PriceChart;
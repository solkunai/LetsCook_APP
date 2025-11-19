/**
 * Pump.fun Style Progress Bar
 * 
 * Shows progress to Raydium graduation with animations
 * [██████░░░░░░░░] 36% to Raydium
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, Target, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface DegenProgressBarProps {
  solCollected?: number;
  solReserves?: number; // Alternative prop name (in lamports)
  graduationGoal: number; // In lamports (e.g., 30_000_000_000 = 30 SOL)
  isGraduated?: boolean;
  className?: string;
}

export const DegenProgressBar: React.FC<DegenProgressBarProps> = ({
  solCollected,
  solReserves,
  graduationGoal = 30_000_000_000, // Default: 30 SOL in lamports
  isGraduated = false,
  className = '',
}) => {
  // Use solReserves (in lamports) if provided, otherwise use solCollected (in SOL)
  // Convert to SOL for display
  // Handle null/undefined cases properly - ensure we always have a valid number
  const solReservesNum = typeof solReserves === 'number' && !isNaN(solReserves) ? solReserves : 0;
  const solCollectedNum = typeof solCollected === 'number' && !isNaN(solCollected) ? solCollected : 0;
  
  const solCollectedInSOL = solReservesNum > 0 
    ? solReservesNum / 1e9 
    : solCollectedNum;
  
  const graduationGoalNum = typeof graduationGoal === 'number' && !isNaN(graduationGoal) ? graduationGoal : 30_000_000_000;
  const graduationGoalInSOL = graduationGoalNum / 1e9;
  
  const progress = isGraduated 
    ? 100 
    : Math.min(100, (solCollectedInSOL / graduationGoalInSOL) * 100);
  const remaining = Math.max(0, graduationGoalInSOL - solCollectedInSOL);
  const isComplete = isGraduated || progress >= 100;
  
  return (
    <Card className={`bg-gradient-to-r from-yellow-500/10 via-slate-800/50 to-slate-800/50 border-yellow-500/20 ${className}`}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-semibold">Progress to Raydium</span>
            </div>
            {isComplete ? (
              <div className="flex items-center gap-2 text-green-400">
                <Target className="w-4 h-4" />
                <span className="text-sm font-semibold">Goal Reached! 🎉</span>
              </div>
            ) : (
              <div className="text-slate-400 text-sm">
                {remaining.toFixed(2)} SOL remaining
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-400">
                {solCollectedInSOL.toFixed(2)} / {graduationGoalInSOL.toFixed(2)} SOL collected
              </span>
              <span className="text-yellow-400 font-semibold">
                {progress.toFixed(1)}%
              </span>
            </div>
            
            {/* Animated Progress Bar */}
            <div className="relative w-full h-6 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 relative"
              >
                {/* Shimmer effect */}
                <motion.div
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: "linear",
                  }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                />
              </motion.div>
              
              {/* Progress indicator */}
              {progress > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute right-0 top-0 h-full w-1 bg-yellow-400 shadow-lg shadow-yellow-400/50"
                  style={{ right: `${100 - progress}%` }}
                />
              )}
            </div>
            
            {/* Visual Progress Blocks */}
            <div className="flex gap-1">
              {Array.from({ length: 20 }).map((_, i) => {
                const blockProgress = (i + 1) * 5; // Each block = 5%
                const isFilled = progress >= blockProgress;
                const isActive = progress >= blockProgress - 5 && progress < blockProgress;
                
                return (
                  <motion.div
                    key={i}
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{
                      scale: isFilled ? 1 : isActive ? 0.9 : 0.8,
                      opacity: isFilled ? 1 : isActive ? 0.7 : 0.3,
                    }}
                    className={`h-2 flex-1 rounded ${
                      isFilled
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                        : isActive
                        ? 'bg-yellow-500/50'
                        : 'bg-slate-700'
                    }`}
                  />
                );
              })}
            </div>
          </div>
          
          {/* Milestone Indicators */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {[25, 50, 75].map((milestone) => (
              <div
                key={milestone}
                className={`text-center p-2 rounded ${
                  progress >= milestone
                    ? 'bg-green-500/20 border border-green-500/50'
                    : 'bg-slate-800/50 border border-slate-700'
                }`}
              >
                <div className={`text-xs font-semibold ${
                  progress >= milestone ? 'text-green-400' : 'text-slate-400'
                }`}>
                  {milestone}%
                </div>
                {progress >= milestone && (
                  <Zap className="w-3 h-3 text-green-400 mx-auto mt-1" />
                )}
              </div>
            ))}
          </div>
          
          {/* Status Message */}
          {isComplete ? (
            <div className="mt-4 p-3 bg-green-500/20 rounded-lg border border-green-500/50">
              <div className="flex items-center gap-2 text-green-400">
                <Target className="w-4 h-4" />
                <span className="text-sm font-semibold">
                  🎉 Graduation threshold reached! Raydium pool will be created.
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
              <div className="text-xs text-slate-400">
                💡 Once {graduationGoalInSOL.toFixed(2)} SOL is collected, the token will graduate to Raydium with permanent liquidity.
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};


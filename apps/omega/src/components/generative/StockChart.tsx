'use client';

import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useEffect, useState } from 'react';

interface StockChartProps {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  data?: number[];
  isLoading?: boolean;
}

export function StockChart({
  symbol,
  price,
  change,
  changePercent,
  data = [],
  isLoading = false,
}: StockChartProps) {
  const [animatedData, setAnimatedData] = useState<number[]>([]);
  const isPositive = change >= 0;

  useEffect(() => {
    // Animate data points
    if (data.length > 0) {
      const interval = setInterval(() => {
        setAnimatedData(prev => {
          if (prev.length < data.length) {
            return data.slice(0, prev.length + 1);
          }
          clearInterval(interval);
          return prev;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 p-6 shadow-xl border border-gray-200/50 dark:border-gray-800/50">
        <div className="space-y-4">
          <div className="h-4 w-16 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse"></div>
          <div className="h-8 w-24 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse"></div>
          <div className="h-32 w-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...(animatedData.length > 0 ? animatedData : [100]));
  const minValue = Math.min(...(animatedData.length > 0 ? animatedData : [0]));
  const range = maxValue - minValue || 1;

  return (
    <div className="group relative rounded-2xl bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-200/50 dark:border-gray-800/50 hover:scale-[1.02]">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-gray-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-700 to-gray-900 dark:from-slate-300 dark:to-gray-100 bg-clip-text text-transparent">
              {symbol}
            </h2>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                ${price.toFixed(2)}
              </span>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                isPositive 
                  ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700' 
                  : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700'
              }`}>
                {isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="font-semibold">
                  {isPositive ? '+' : ''}{change.toFixed(2)}
                </span>
                <span className="text-sm">
                  ({Math.abs(changePercent).toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
          
          <div className={`p-3 rounded-xl shadow-lg ${
            isPositive 
              ? 'bg-gradient-to-br from-emerald-400 to-green-500' 
              : 'bg-gradient-to-br from-red-400 to-rose-500'
          }`}>
            <DollarSign className="h-8 w-8 text-white" />
          </div>
        </div>

        {animatedData.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-white/50 dark:bg-gray-800/30 backdrop-blur-sm">
            <svg className="h-32 w-full" viewBox={`0 0 ${animatedData.length * 10} 100`} preserveAspectRatio="none">
              {/* Gradient definition */}
              <defs>
                <linearGradient id={`gradient-${symbol}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0" />
                </linearGradient>
              </defs>
              
              {/* Area fill */}
              <polygon
                fill={`url(#gradient-${symbol})`}
                points={`0,100 ${animatedData
                  .map((value, index) => {
                    const x = index * 10;
                    const y = 100 - ((value - minValue) / range) * 100;
                    return `${x},${y}`;
                  })
                  .join(' ')} ${(animatedData.length - 1) * 10},100`}
                className="transition-all duration-300"
              />
              
              {/* Line */}
              <polyline
                fill="none"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={animatedData
                  .map((value, index) => {
                    const x = index * 10;
                    const y = 100 - ((value - minValue) / range) * 100;
                    return `${x},${y}`;
                  })
                  .join(' ')}
                className="transition-all duration-300 filter drop-shadow-sm"
              />
              
              {/* Data points */}
              {animatedData.map((value, index) => {
                const x = index * 10;
                const y = 100 - ((value - minValue) / range) * 100;
                return (
                  <g key={index}>
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill="white"
                      stroke={isPositive ? '#10b981' : '#ef4444'}
                      strokeWidth="2"
                      className="transition-all duration-300"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r="8"
                      fill={isPositive ? '#10b981' : '#ef4444'}
                      fillOpacity="0.2"
                      className="animate-pulse"
                    />
                  </g>
                );
              })}
            </svg>
            
            <div className="mt-3 flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>1D</span>
              <span>1W</span>
              <span>1M</span>
              <span>3M</span>
              <span>1Y</span>
              <span>ALL</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
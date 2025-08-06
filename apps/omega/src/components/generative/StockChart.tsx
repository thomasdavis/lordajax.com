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
      <div className="animate-pulse rounded-lg border bg-card p-6">
        <div className="h-4 w-16 bg-muted rounded mb-4" />
        <div className="h-8 w-24 bg-muted rounded mb-2" />
        <div className="h-32 w-full bg-muted rounded" />
      </div>
    );
  }

  const maxValue = Math.max(...(animatedData.length > 0 ? animatedData : [100]));
  const minValue = Math.min(...(animatedData.length > 0 ? animatedData : [0]));
  const range = maxValue - minValue || 1;

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{symbol}</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold">${price.toFixed(2)}</span>
            <span
              className={`flex items-center text-sm font-medium ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(2)}%)
            </span>
          </div>
        </div>
        
        <DollarSign className="h-8 w-8 text-muted-foreground" />
      </div>

      {animatedData.length > 0 && (
        <div className="mt-6">
          <svg className="h-32 w-full" viewBox={`0 0 ${animatedData.length * 10} 100`}>
            <polyline
              fill="none"
              stroke={isPositive ? '#10b981' : '#ef4444'}
              strokeWidth="2"
              points={animatedData
                .map((value, index) => {
                  const x = index * 10;
                  const y = 100 - ((value - minValue) / range) * 100;
                  return `${x},${y}`;
                })
                .join(' ')}
              className="transition-all duration-300"
            />
            
            {animatedData.map((value, index) => {
              const x = index * 10;
              const y = 100 - ((value - minValue) / range) * 100;
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="2"
                  fill={isPositive ? '#10b981' : '#ef4444'}
                  className="animate-pulse"
                />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
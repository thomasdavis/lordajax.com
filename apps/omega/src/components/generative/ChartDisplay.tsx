'use client';

import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartDisplayProps {
  config: any;
  isLoading?: boolean;
}

export function ChartDisplay({ config, isLoading = false }: ChartDisplayProps) {
  const chartRef = useRef<ChartJS>(null);

  useEffect(() => {
    // Trigger animation on mount
    if (chartRef.current) {
      chartRef.current.update('active');
    }
  }, [config]);

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border bg-card p-6">
        <div className="h-8 w-48 bg-muted rounded mb-4" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (!config || !config.data) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
        No chart data available
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-card via-card to-secondary/10 p-6 shadow-lg hover:shadow-xl transition-shadow">
      <div className="h-[400px] w-full">
        <Chart
          ref={chartRef}
          type={config.type}
          data={config.data}
          options={{
            ...config.options,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              ...config.options?.plugins,
              legend: {
                ...config.options?.plugins?.legend,
                labels: {
                  ...config.options?.plugins?.legend?.labels,
                  color: 'rgb(var(--foreground))',
                  font: {
                    ...config.options?.plugins?.legend?.labels?.font,
                    family: 'system-ui, -apple-system, sans-serif',
                  },
                },
              },
              title: {
                ...config.options?.plugins?.title,
                color: 'rgb(var(--foreground))',
                font: {
                  ...config.options?.plugins?.title?.font,
                  family: 'system-ui, -apple-system, sans-serif',
                },
              },
            },
            scales: config.options?.scales ? {
              ...config.options.scales,
              y: config.options.scales.y ? {
                ...config.options.scales.y,
                ticks: {
                  ...config.options.scales.y.ticks,
                  color: 'rgb(var(--muted-foreground))',
                },
                grid: {
                  ...config.options.scales.y.grid,
                  color: 'rgba(var(--border), 0.2)',
                },
              } : undefined,
              x: config.options.scales.x ? {
                ...config.options.scales.x,
                ticks: {
                  ...config.options.scales.x.ticks,
                  color: 'rgb(var(--muted-foreground))',
                },
                grid: {
                  ...config.options.scales.x.grid,
                  color: 'rgba(var(--border), 0.2)',
                },
              } : undefined,
            } : undefined,
          }}
        />
      </div>
    </div>
  );
}
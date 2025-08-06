'use client';

import { Cloud, CloudRain, Sun, Wind, Droplets, Thermometer } from 'lucide-react';

interface WeatherCardProps {
  city: string;
  temperature: number;
  units: 'celsius' | 'fahrenheit';
  condition: string;
  humidity: number;
  windSpeed: number;
  isLoading?: boolean;
}

export function WeatherCard({
  city,
  temperature,
  units,
  condition,
  humidity,
  windSpeed,
  isLoading = false,
}: WeatherCardProps) {
  const getWeatherIcon = () => {
    const lowerCondition = condition.toLowerCase();
    if (lowerCondition.includes('rain')) return <CloudRain className="h-12 w-12" />;
    if (lowerCondition.includes('cloud')) return <Cloud className="h-12 w-12" />;
    if (lowerCondition.includes('sun') || lowerCondition.includes('clear')) return <Sun className="h-12 w-12" />;
    return <Cloud className="h-12 w-12" />;
  };

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border bg-card p-6">
        <div className="h-4 w-24 bg-muted rounded mb-4" />
        <div className="h-12 w-20 bg-muted rounded mb-2" />
        <div className="h-3 w-32 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{city}</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold">
              {temperature}°{units === 'celsius' ? 'C' : 'F'}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{condition}</p>
        </div>
        
        <div className="text-blue-600 dark:text-blue-400">
          {getWeatherIcon()}
        </div>
      </div>
      
      <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Humidity</p>
            <p className="text-sm font-medium">{humidity}%</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Wind className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Wind Speed</p>
            <p className="text-sm font-medium">{windSpeed} mph</p>
          </div>
        </div>
      </div>
    </div>
  );
}
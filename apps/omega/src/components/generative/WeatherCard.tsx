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
      <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 shadow-xl border border-blue-200/50 dark:border-blue-800/50">
        <div className="space-y-4">
          <div className="h-4 w-28 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse"></div>
          <div className="h-12 w-24 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse"></div>
          <div className="h-3 w-32 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 border border-blue-200/50 dark:border-blue-800/50 hover:scale-[1.02]">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {city}
            </h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-5xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                {temperature}°
              </span>
              <span className="text-xl font-medium text-gray-600 dark:text-gray-400">
                {units === 'celsius' ? 'C' : 'F'}
              </span>
            </div>
            <p className="mt-2 text-lg font-medium text-gray-700 dark:text-gray-300">{condition}</p>
          </div>
          
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 text-white shadow-lg">
            {getWeatherIcon()}
          </div>
        </div>
        
        <div className="mt-6 h-px bg-gradient-to-r from-transparent via-blue-300 dark:via-blue-700 to-transparent"></div>
        
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 text-white">
              <Droplets className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Humidity</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{humidity}%</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
            <div className="p-2 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 text-white">
              <Wind className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Wind Speed</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{windSpeed} mph</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
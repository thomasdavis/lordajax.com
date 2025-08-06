import { tool } from 'ai';
import { z } from 'zod';

// Mock weather data for demonstration
const mockWeatherData: Record<string, any> = {
  'new york': { temp: 72, condition: 'Partly Cloudy', humidity: 65, wind: 8 },
  'london': { temp: 59, condition: 'Rainy', humidity: 80, wind: 12 },
  'tokyo': { temp: 68, condition: 'Clear', humidity: 55, wind: 5 },
  'sydney': { temp: 77, condition: 'Sunny', humidity: 70, wind: 10 },
  'paris': { temp: 64, condition: 'Overcast', humidity: 75, wind: 7 },
};

export const weatherTool = tool({
  description: 'Get current weather information for a city',
  inputSchema: z.object({
    city: z.string().describe('Name of the city'),
    units: z.enum(['celsius', 'fahrenheit']).default('fahrenheit').describe('Temperature units'),
  }),
  execute: async ({ city, units }) => {
    try {
      const normalizedCity = city.toLowerCase();
      
      // In a real app, this would call a weather API
      // For now, we'll use mock data or generate random data
      let weatherData = mockWeatherData[normalizedCity];
      
      if (!weatherData) {
        // Generate random weather for unknown cities
        weatherData = {
          temp: Math.floor(Math.random() * 40) + 50,
          condition: ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Clear'][Math.floor(Math.random() * 5)],
          humidity: Math.floor(Math.random() * 40) + 40,
          wind: Math.floor(Math.random() * 20) + 5,
        };
      }
      
      // Convert temperature if needed
      const temperature = units === 'celsius' 
        ? Math.round((weatherData.temp - 32) * 5/9)
        : weatherData.temp;
      
      return {
        city: city,
        temperature,
        units,
        condition: weatherData.condition,
        humidity: weatherData.humidity,
        windSpeed: weatherData.wind,
        timestamp: new Date().toISOString(),
        formatted: `${city}: ${temperature}°${units === 'celsius' ? 'C' : 'F'}, ${weatherData.condition}, Humidity: ${weatherData.humidity}%, Wind: ${weatherData.wind} mph`,
      };
    } catch (error) {
      return {
        error: `Failed to get weather: ${error instanceof Error ? error.message : 'Unknown error'}`,
        city,
      };
    }
  },
});
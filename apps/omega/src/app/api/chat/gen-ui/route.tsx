import { streamText, createStreamableUI } from 'ai/rsc';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { WeatherCard } from '@/components/generative/WeatherCard';
import { StockChart } from '@/components/generative/StockChart';
import { ProgressIndicator } from '@/components/generative/ProgressIndicator';

export const maxDuration = 30;

const requestSchema = z.object({
  messages: z.array(z.any()),
  model: z.string().default('gpt-4o'),
});

// Server component that streams UI
async function generateWeatherUI(city: string) {
  'use server';
  
  const ui = createStreamableUI(
    <WeatherCard
      city={city}
      temperature={0}
      units="fahrenheit"
      condition="Loading..."
      humidity={0}
      windSpeed={0}
      isLoading={true}
    />
  );

  // Simulate fetching weather data
  setTimeout(() => {
    ui.update(
      <WeatherCard
        city={city}
        temperature={72}
        units="fahrenheit"
        condition="Partly Cloudy"
        humidity={65}
        windSpeed={8}
      />
    );
    ui.done();
  }, 1000);

  return ui.value;
}

async function generateStockUI(symbol: string) {
  'use server';
  
  const ui = createStreamableUI(
    <StockChart
      symbol={symbol}
      price={0}
      change={0}
      changePercent={0}
      isLoading={true}
    />
  );

  // Simulate streaming stock data
  const prices = [150, 152, 151, 153, 155, 154, 156, 158, 157, 159];
  let currentPrice = 150;
  
  prices.forEach((price, index) => {
    setTimeout(() => {
      const change = price - 150;
      const changePercent = (change / 150) * 100;
      
      ui.update(
        <StockChart
          symbol={symbol}
          price={price}
          change={change}
          changePercent={changePercent}
          data={prices.slice(0, index + 1)}
        />
      );
      
      if (index === prices.length - 1) {
        ui.done();
      }
    }, index * 300);
  });

  return ui.value;
}

async function generateProgressUI(taskName: string, steps: number) {
  'use server';
  
  const stepData = Array.from({ length: steps }, (_, i) => ({
    id: `step-${i}`,
    title: `Step ${i + 1}`,
    description: `Processing ${taskName} - part ${i + 1}`,
    status: 'pending' as const,
    progress: 0,
  }));

  const ui = createStreamableUI(
    <ProgressIndicator
      title={taskName}
      steps={stepData}
      isStreaming={true}
    />
  );

  // Simulate progress updates
  stepData.forEach((step, index) => {
    setTimeout(() => {
      // Update to in-progress
      stepData[index].status = 'in-progress';
      ui.update(
        <ProgressIndicator
          title={taskName}
          steps={[...stepData]}
        />
      );

      // Simulate progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 20;
        stepData[index].progress = progress;
        
        if (progress >= 100) {
          clearInterval(progressInterval);
          stepData[index].status = 'completed';
          stepData[index].progress = undefined;
        }
        
        ui.update(
          <ProgressIndicator
            title={taskName}
            steps={[...stepData]}
          />
        );
        
        if (index === stepData.length - 1 && progress >= 100) {
          ui.done();
        }
      }, 200);
    }, index * 1500);
  });

  return ui.value;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model } = requestSchema.parse(body);

    const result = streamText({
      model: openai(model),
      messages,
      tools: {
        showWeather: {
          description: 'Show weather information for a city',
          parameters: z.object({
            city: z.string().describe('City name'),
          }),
          generate: async ({ city }) => {
            return {
              display: await generateWeatherUI(city),
              text: `Showing weather for ${city}`,
            };
          },
        },
        showStock: {
          description: 'Show stock price chart',
          parameters: z.object({
            symbol: z.string().describe('Stock symbol'),
          }),
          generate: async ({ symbol }) => {
            return {
              display: await generateStockUI(symbol),
              text: `Displaying stock chart for ${symbol}`,
            };
          },
        },
        showProgress: {
          description: 'Show task progress',
          parameters: z.object({
            taskName: z.string().describe('Task name'),
            steps: z.number().min(1).max(10).describe('Number of steps'),
          }),
          generate: async ({ taskName, steps }) => {
            return {
              display: await generateProgressUI(taskName, steps),
              text: `Tracking progress for ${taskName}`,
            };
          },
        },
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Gen UI error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate UI' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
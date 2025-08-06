import { tool } from 'ai';
import { z } from 'zod';

export const chartGeneratorTool = tool({
  description: 'Generate chart configuration based on user requirements',
  inputSchema: z.object({
    type: z.enum(['line', 'bar', 'pie', 'doughnut', 'radar', 'scatter', 'bubble', 'polarArea'])
      .describe('Type of chart to generate'),
    title: z.string().describe('Chart title'),
    labels: z.array(z.string()).describe('Labels for the data points'),
    datasets: z.array(z.object({
      label: z.string().describe('Dataset label'),
      data: z.array(z.number()).describe('Numeric data values'),
      backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
      borderColor: z.union([z.string(), z.array(z.string())]).optional(),
      borderWidth: z.number().optional(),
      fill: z.boolean().optional(),
      tension: z.number().optional(),
    })).describe('Datasets to display'),
    options: z.object({
      responsive: z.boolean().default(true),
      maintainAspectRatio: z.boolean().default(false),
      animation: z.boolean().default(true),
      scales: z.any().optional(),
      plugins: z.any().optional(),
    }).optional(),
  }),
  execute: async ({ type, title, labels, datasets, options }) => {
    console.log('[Chart Generator] Creating chart:', { type, title });
    
    // Generate random colors if not provided
    const generateColors = (count: number, opacity: number = 1) => {
      const colors = [
        `rgba(255, 99, 132, ${opacity})`,
        `rgba(54, 162, 235, ${opacity})`,
        `rgba(255, 206, 86, ${opacity})`,
        `rgba(75, 192, 192, ${opacity})`,
        `rgba(153, 102, 255, ${opacity})`,
        `rgba(255, 159, 64, ${opacity})`,
        `rgba(199, 199, 199, ${opacity})`,
        `rgba(83, 102, 255, ${opacity})`,
        `rgba(255, 99, 255, ${opacity})`,
        `rgba(99, 255, 132, ${opacity})`,
      ];
      return colors.slice(0, count);
    };
    
    // Process datasets with default colors
    const processedDatasets = datasets.map((dataset, index) => {
      const dataCount = dataset.data.length;
      const isPieChart = ['pie', 'doughnut', 'polarArea'].includes(type);
      
      return {
        ...dataset,
        backgroundColor: dataset.backgroundColor || (
          isPieChart 
            ? generateColors(dataCount, 0.6)
            : generateColors(1, 0.5)[index % 10]
        ),
        borderColor: dataset.borderColor || (
          isPieChart
            ? generateColors(dataCount, 1)
            : generateColors(1, 1)[index % 10]
        ),
        borderWidth: dataset.borderWidth ?? 2,
        fill: dataset.fill ?? (type === 'line' ? false : true),
        tension: dataset.tension ?? 0.1,
      };
    });
    
    // Build chart configuration
    const chartConfig = {
      type,
      data: {
        labels,
        datasets: processedDatasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1000,
        },
        plugins: {
          legend: {
            position: 'top' as const,
          },
          title: {
            display: true,
            text: title,
            font: {
              size: 16,
              weight: 'bold' as const,
            },
          },
          tooltip: {
            mode: 'index' as const,
            intersect: false,
          },
          ...options?.plugins,
        },
        scales: type !== 'pie' && type !== 'doughnut' && type !== 'polarArea' ? {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)',
            },
          },
          x: {
            grid: {
              color: 'rgba(0, 0, 0, 0.1)',
            },
          },
          ...options?.scales,
        } : undefined,
        ...options,
      },
    };
    
    return {
      success: true,
      chartConfig,
      summary: `Generated ${type} chart with ${datasets.length} dataset(s) and ${labels.length} labels`,
      componentType: 'chart', // Signal to render as chart component
    };
  },
});
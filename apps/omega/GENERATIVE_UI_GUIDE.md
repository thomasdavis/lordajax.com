# Generative UI Tools Guide

This guide explains how to create generative UI tools that render interactive components directly in the chat interface using AI SDK v5.

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Step-by-Step Tutorial](#step-by-step-tutorial)
4. [Example: Chart Generator](#example-chart-generator)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

## Overview

Generative UI tools allow the AI to generate and render interactive React components directly in the chat. Instead of just returning text or data, these tools can create rich visual experiences like charts, forms, interactive widgets, and more.

### Key Benefits
- **Rich Visualizations**: Display data as charts, graphs, or custom visualizations
- **Interactive Components**: Create forms, sliders, buttons that users can interact with
- **Dynamic Content**: Generate UI based on user requests and data
- **Seamless Integration**: Components render inline within chat messages

## Architecture

The generative UI system consists of four main parts:

```
User Request → AI Tool → Component Config → React Component → Rendered UI
```

1. **Tool Definition** (`/src/lib/ai/tools/`): Defines the tool's parameters and execution logic
2. **Component** (`/src/components/generative/`): The React component that renders the UI
3. **Message Renderer** (`/src/components/chat/ChatMessage.tsx`): Detects and renders components
4. **Integration**: Connecting everything together

## Step-by-Step Tutorial

### Step 1: Create the Tool Definition

Create a new file in `/src/lib/ai/tools/` for your tool:

```typescript
// src/lib/ai/tools/my-component-tool.ts
import { tool } from 'ai';
import { z } from 'zod';

export const myComponentTool = tool({
  description: 'Generate a custom component based on user requirements',
  
  // Define input parameters using Zod schema
  inputSchema: z.object({
    title: z.string().describe('Component title'),
    data: z.any().describe('Data to display'),
    options: z.object({
      // Add any configuration options
      theme: z.enum(['light', 'dark']).optional(),
      interactive: z.boolean().optional(),
    }).optional(),
  }),
  
  // Execute function that returns the component configuration
  execute: async ({ title, data, options }) => {
    console.log('[MyComponent Tool] Generating component:', title);
    
    // Process the data and generate configuration
    const componentConfig = {
      title,
      data,
      options: {
        theme: options?.theme || 'light',
        interactive: options?.interactive ?? true,
      },
    };
    
    return {
      success: true,
      componentConfig,
      componentType: 'myComponent', // IMPORTANT: Identifies this as a UI component
      summary: `Generated ${title} component`,
    };
  },
});
```

### Step 2: Create the React Component

Create the component in `/src/components/generative/`:

```typescript
// src/components/generative/MyComponent.tsx
'use client';

import { useState, useEffect } from 'react';

interface MyComponentProps {
  config: {
    title: string;
    data: any;
    options?: {
      theme?: 'light' | 'dark';
      interactive?: boolean;
    };
  };
  isLoading?: boolean;
}

export function MyComponent({ config, isLoading = false }: MyComponentProps) {
  const [state, setState] = useState(config.data);
  
  useEffect(() => {
    // Add any initialization logic
    console.log('Component mounted with config:', config);
  }, [config]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border bg-card p-6">
        <div className="h-8 w-48 bg-muted rounded mb-4" />
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }
  
  // Error state
  if (!config || !config.data) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
        No data available
      </div>
    );
  }
  
  // Main render
  return (
    <div className={`rounded-xl border bg-gradient-to-br from-card to-secondary/10 p-6 shadow-lg 
      ${config.options?.theme === 'dark' ? 'dark' : ''}`}>
      
      <h3 className="text-lg font-bold mb-4">{config.title}</h3>
      
      <div className="space-y-4">
        {/* Render your component content here */}
        <pre className="text-sm">
          {JSON.stringify(state, null, 2)}
        </pre>
        
        {config.options?.interactive && (
          <button
            onClick={() => setState({ ...state, clicked: true })}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Interact
          </button>
        )}
      </div>
    </div>
  );
}
```

### Step 3: Register the Tool

Add your tool to the exports in `/src/lib/ai/tools/index.ts`:

```typescript
// src/lib/ai/tools/index.ts
export { myComponentTool } from './my-component-tool';

import { myComponentTool } from './my-component-tool';
// ... other imports

export const allTools = {
  // ... existing tools
  myComponent: myComponentTool,
};
```

### Step 4: Update ChatMessage Component

Modify `/src/components/chat/ChatMessage.tsx` to render your component:

```typescript
// Add dynamic import at the top
const MyComponent = dynamic(
  () => import('@/components/generative/MyComponent').then(mod => mod.MyComponent),
  { 
    ssr: false,
    loading: () => <div className="h-32 animate-pulse bg-muted rounded-xl" />
  }
);

// In the tool output rendering section, add your component case:
{tool.output.componentType === 'myComponent' && tool.output.componentConfig ? (
  <div className="space-y-2">
    <div className="flex items-center gap-2 font-medium text-green-600">
      <YourIcon className="h-4 w-4" />
      <span>Generated Component</span>
    </div>
    <MyComponent config={tool.output.componentConfig} />
  </div>
) : (
  // ... existing output rendering
)}
```

### Step 5: Enable the Tool

Add your tool to the enabled tools in `/src/components/chat/ChatInterface.tsx`:

```typescript
const [chatSettings, setChatSettings] = useState({
  // ... other settings
  enabledTools: [
    // ... existing tools
    'myComponent',
  ],
});
```

## Example: Chart Generator

Here's how the chart generator was implemented:

### 1. Tool Definition (`chart-generator.ts`)

```typescript
export const chartGeneratorTool = tool({
  description: 'Generate chart configuration based on user requirements',
  inputSchema: z.object({
    type: z.enum(['line', 'bar', 'pie', 'doughnut', 'radar']),
    title: z.string(),
    labels: z.array(z.string()),
    datasets: z.array(z.object({
      label: z.string(),
      data: z.array(z.number()),
      // ... styling options
    })),
  }),
  execute: async ({ type, title, labels, datasets }) => {
    // Generate colors and process data
    const chartConfig = {
      type,
      data: { labels, datasets: processedDatasets },
      options: { /* Chart.js options */ },
    };
    
    return {
      success: true,
      chartConfig,
      componentType: 'chart', // Identifies as chart component
      summary: `Generated ${type} chart`,
    };
  },
});
```

### 2. Component (`ChartDisplay.tsx`)

```typescript
export function ChartDisplay({ config, isLoading }: ChartDisplayProps) {
  const chartRef = useRef<ChartJS>(null);
  
  if (isLoading) return <LoadingState />;
  if (!config) return <ErrorState />;
  
  return (
    <div className="rounded-xl border p-6">
      <Chart
        ref={chartRef}
        type={config.type}
        data={config.data}
        options={config.options}
      />
    </div>
  );
}
```

### 3. Integration in ChatMessage

```typescript
{tool.output.componentType === 'chart' && tool.output.chartConfig ? (
  <ChartDisplay config={tool.output.chartConfig} />
) : (
  // Regular output
)}
```

## Best Practices

### 1. Tool Design
- **Clear Purpose**: Each tool should have a single, well-defined purpose
- **Smart Defaults**: Provide sensible defaults for optional parameters
- **Data Inference**: Help the AI by inferring missing data when reasonable
- **Error Handling**: Always validate inputs and handle errors gracefully

### 2. Component Design
- **Loading States**: Always include loading animations
- **Error States**: Handle missing or invalid data gracefully
- **Responsive**: Ensure components work on all screen sizes
- **Theme Support**: Respect light/dark mode preferences
- **Accessibility**: Include proper ARIA labels and keyboard navigation

### 3. Performance
- **Dynamic Imports**: Use Next.js dynamic imports to avoid SSR issues
- **Lazy Loading**: Load heavy libraries only when needed
- **Memoization**: Use React.memo for expensive components
- **Optimization**: Minimize re-renders with proper dependency arrays

### 4. Styling
- **Consistent Theme**: Use the design system tokens (colors, spacing, etc.)
- **Animations**: Add subtle animations for better UX
- **Gradients**: Use gradients to make components visually appealing
- **Dark Mode**: Ensure components look good in both themes

## Common Component Types

### 1. Data Visualization
- Charts (line, bar, pie, scatter)
- Graphs (network, tree, flow)
- Maps (geographic, heat maps)
- Gauges and meters

### 2. Interactive Forms
- Dynamic forms with validation
- Surveys and questionnaires
- Configuration wizards
- File uploaders

### 3. Media Components
- Image galleries
- Video players
- Audio visualizers
- 3D model viewers

### 4. Data Tables
- Sortable tables
- Filterable grids
- Pivot tables
- Spreadsheet-like interfaces

### 5. Games and Simulations
- Mini-games
- Physics simulations
- Interactive tutorials
- Code playgrounds

## Troubleshooting

### Component Not Rendering
1. Check that `componentType` is set in the tool's return value
2. Verify the component is properly imported in ChatMessage
3. Ensure dynamic import is configured correctly
4. Check browser console for errors

### SSR Issues
- Use dynamic imports with `ssr: false` for client-only components
- Wrap browser-only APIs in useEffect
- Check for window/document references

### Data Not Updating
- Ensure proper key props for re-rendering
- Check useEffect dependencies
- Verify state updates are immutable

### Styling Issues
- Import required CSS for third-party libraries
- Check CSS module scoping
- Verify Tailwind classes are not purged

## Advanced Features

### 1. Two-Way Data Binding
Allow components to send data back to the chat:

```typescript
interface InteractiveComponentProps {
  config: any;
  onUpdate?: (data: any) => void;
}

// In component
<button onClick={() => onUpdate?.(newData)}>
  Update
</button>
```

### 2. Real-Time Updates
Use WebSockets or polling for live data:

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    fetchLatestData().then(setData);
  }, 5000);
  return () => clearInterval(interval);
}, []);
```

### 3. Component Composition
Combine multiple components:

```typescript
export const dashboardTool = tool({
  execute: async ({ widgets }) => {
    return {
      componentType: 'dashboard',
      widgets: widgets.map(w => ({
        type: w.type,
        config: generateConfig(w),
      })),
    };
  },
});
```

### 4. State Persistence
Save component state to database:

```typescript
const saveState = async (state: any) => {
  await fetch('/api/component-state', {
    method: 'POST',
    body: JSON.stringify({ componentId, state }),
  });
};
```

## Testing

### Unit Tests
```typescript
describe('MyComponentTool', () => {
  it('should generate correct config', async () => {
    const result = await myComponentTool.execute({
      title: 'Test',
      data: { value: 42 },
    });
    expect(result.componentType).toBe('myComponent');
    expect(result.componentConfig.title).toBe('Test');
  });
});
```

### Component Tests
```typescript
describe('MyComponent', () => {
  it('should render with config', () => {
    const { getByText } = render(
      <MyComponent config={mockConfig} />
    );
    expect(getByText('Test Title')).toBeInTheDocument();
  });
});
```

## Conclusion

Generative UI tools transform the chat experience from text-based to rich, interactive interfaces. By following this guide, you can create any type of component that the AI can generate on demand.

Key takeaways:
1. Tools define what to generate
2. Components handle the rendering
3. ChatMessage connects them together
4. Always include loading and error states
5. Make components interactive when appropriate
6. Follow the design system for consistency

Happy building! 🚀
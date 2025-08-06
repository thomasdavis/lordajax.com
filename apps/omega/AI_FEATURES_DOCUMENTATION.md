# AI Features Documentation - Advanced ChatGPT Clone

## Overview

This application is a sophisticated ChatGPT clone built with the latest AI SDK v5, featuring streaming text, tools, generative UI, and multi-step agentic workflows. It demonstrates advanced patterns for building AI-powered applications.

## Core Technologies

- **AI SDK v5**: Latest version with streaming, tools, and RSC support
- **Next.js 15**: App Router with server components
- **OpenAI GPT-4o**: Latest model for generation
- **Prisma + SQLite**: Database persistence with adapter pattern
- **Zod**: Runtime type validation for tools and API
- **React Server Components**: For streaming UI generation

## Architecture

### 1. Database Layer

#### Adapter Pattern
```typescript
// src/lib/db/types.ts
export interface DatabaseAdapter {
  createChat(input: CreateChatInput): Promise<Chat>;
  getChat(id: string): Promise<ChatWithMessages | null>;
  createMessage(input: CreateMessageInput): Promise<Message>;
  // ... other methods
}
```

The adapter pattern allows switching between different database implementations without changing application code. Currently uses Prisma with SQLite, but can easily switch to PostgreSQL, MongoDB, or other databases.

#### Schema Design
- **Chat**: Stores conversation metadata, settings, system prompts
- **Message**: Individual messages with role, content, tool calls/results
- **Tool**: Tool definitions with parameters as JSON
- **UserPreferences**: User-specific settings

### 2. AI Integration Layer

#### Master Prompt System
```typescript
// src/lib/ai/prompts.ts
export const SYSTEM_PROMPTS = {
  default: MASTER_PROMPT,
  creative: `${MASTER_PROMPT} + creative instructions`,
  analytical: `${MASTER_PROMPT} + analytical instructions`,
  coding: `${MASTER_PROMPT} + coding instructions`,
  learning: `${MASTER_PROMPT} + educational instructions`,
};
```

Different modes optimize the AI's behavior for specific tasks:
- **Default**: Balanced, general-purpose assistant
- **Creative**: Enhanced imagination and unconventional thinking
- **Analytical**: Data-driven, systematic analysis
- **Coding**: Clean code with best practices
- **Learning**: Educational with examples and exercises

### 3. Streaming Architecture

#### Text Streaming
```typescript
const result = streamText({
  model: openai(model),
  messages: convertToCoreMessages(messages),
  temperature,
  maxTokens,
  tools,
  toolChoice: 'auto',
});

return result.toDataStreamResponse();
```

The AI SDK handles:
- Token-by-token streaming
- Backpressure management
- Error recovery
- Tool invocation streaming

#### Stream Data Protocol
```typescript
const data = new StreamData();
data.append({
  chatId: chat.id,
  model,
  timestamp: new Date().toISOString(),
});
```

Additional metadata sent alongside the stream for client-side processing.

### 4. Tools System

#### Tool Definition Pattern
```typescript
export const calculatorTool = tool({
  description: 'Perform mathematical calculations',
  parameters: z.object({
    expression: z.string().describe('Mathematical expression'),
  }),
  execute: async ({ expression }) => {
    // Tool implementation
    return { result, formatted };
  },
});
```

#### Available Tools

1. **Calculator**: Safe math expression evaluation
2. **Weather**: Location-based weather (mock data for demo)
3. **Code Runner**: Sandboxed JavaScript execution
4. **DateTime**: Date/time operations and calculations
5. **Knowledge Base**: Store/retrieve information

#### Dynamic Tools
```typescript
const createDynamicTool = tool({
  description: 'Create a new tool dynamically',
  parameters: z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.any()),
    code: z.string(),
  }),
  execute: async ({ name, code }) => {
    const func = new Function('parameters', code);
    // Store and execute dynamically
  },
});
```

Tools can be created on-the-fly based on user requirements.

#### Prepare Steps
```typescript
const dataAnalysisTool = tool({
  parameters: z.object({ data: z.array(z.number()) }),
  experimental_prepareStep: async ({ data }) => {
    // Validate and clean data before execution
    const cleanData = data.filter(n => !isNaN(n));
    return { data: cleanData, metadata: {...} };
  },
  execute: async ({ data, metadata }) => {
    // Execute with prepared data
  },
});
```

Prepare steps allow data validation and transformation before tool execution.

### 5. Generative UI

#### Server-Side UI Generation
```typescript
async function generateWeatherUI(city: string) {
  const ui = createStreamableUI(
    <WeatherCard city={city} isLoading={true} />
  );
  
  // Fetch data and update UI
  setTimeout(() => {
    ui.update(<WeatherCard city={city} temperature={72} />);
    ui.done();
  }, 1000);
  
  return ui.value;
}
```

#### Streaming UI Updates
Components stream from server to client with progressive updates:
1. Initial loading state
2. Partial data updates
3. Final complete state

#### Available UI Components
- **WeatherCard**: Animated weather display
- **StockChart**: Real-time stock price visualization
- **ProgressIndicator**: Multi-step progress tracking

### 6. Multi-Step Workflows

#### Workflow Tool
```typescript
const workflowTool = tool({
  parameters: z.object({
    steps: z.array(z.object({
      action: z.string(),
      params: z.any(),
      condition: z.string().optional(),
    })),
  }),
  execute: async ({ steps }) => {
    for (const step of steps) {
      if (step.condition && !evaluateCondition(step.condition)) {
        continue; // Skip step
      }
      // Execute step with context from previous steps
    }
  },
});
```

Supports:
- Conditional execution
- Context passing between steps
- Error handling and recovery
- Progress tracking

### 7. Client-Server Data Flow

#### Request Schema
```typescript
const requestSchema = z.object({
  messages: z.array(messageSchema),
  chatId: z.string().optional(),
  model: z.string().default('gpt-4o'),
  temperature: z.number(),
  systemPromptMode: z.enum(['default', 'creative', ...]),
  enabledTools: z.array(z.string()),
  userData: z.any(), // Extra client data
});
```

#### Response Handling
```typescript
useChat({
  api: '/api/chat',
  body: {
    ...chatSettings,
    userData: { userId, preferences },
  },
  onResponse: (response) => {
    // Handle streaming response
  },
});
```

### 8. Advanced Features

#### Tool Chaining
```typescript
const result = streamText({
  tools,
  maxSteps: 10, // Allow multiple tool calls
  experimental_continueSteps: true, // Auto-continue after tools
});
```

The AI can chain multiple tools together to solve complex problems.

#### Telemetry
```typescript
experimental_telemetry: {
  isEnabled: true,
  functionId: 'chat-completion',
  metadata: { chatId, userId, model },
}
```

Track usage, performance, and errors for monitoring.

#### Error Recovery
```typescript
getErrorMessage: (error) => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
```

Graceful error handling with user-friendly messages.

## Usage Examples

### Basic Chat
```typescript
const { messages, handleSubmit } = useChat({
  api: '/api/chat',
});
```

### With Tools
```typescript
const settings = {
  enabledTools: ['calculator', 'weather'],
  model: 'gpt-4o',
  temperature: 0.7,
};
```

### Dynamic Tool Creation
```typescript
// AI creates a custom tool based on user needs
"Create a tool that converts currencies"
// AI generates tool definition and code
```

### Generative UI
```typescript
// User asks for weather
"What's the weather in New York?"
// Returns interactive weather component
```

## Performance Optimizations

1. **Database Indexing**: Indexes on chatId, userId, createdAt
2. **Stream Buffering**: Efficient token streaming
3. **Component Memoization**: Prevent unnecessary re-renders
4. **Tool Caching**: Cache tool results when appropriate
5. **Connection Pooling**: Database connection reuse

## Security Considerations

1. **Sandboxed Code Execution**: Limited globals in code runner
2. **Input Validation**: Zod schemas for all inputs
3. **Rate Limiting**: Prevent abuse (implement in production)
4. **API Key Management**: Environment variables
5. **SQL Injection Prevention**: Prisma parameterized queries

## Development Workflow

### Adding New Tools
1. Create tool file in `src/lib/ai/tools/`
2. Define parameters with Zod schema
3. Implement execute function
4. Add to tools index
5. Enable in chat settings

### Creating UI Components
1. Create component in `src/components/generative/`
2. Support loading and streaming states
3. Add to gen-ui route
4. Test progressive updates

### Database Changes
1. Update Prisma schema
2. Run migration: `npx prisma migrate dev`
3. Update adapter interface
4. Implement adapter methods

## Testing Strategies

### Tool Testing
```typescript
// Test tool in isolation
const result = await calculatorTool.execute({
  expression: "2 + 2"
});
expect(result.result).toBe(4);
```

### Stream Testing
```typescript
// Test streaming response
const stream = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ messages }),
});
const reader = stream.body.getReader();
// Process chunks
```

## Production Considerations

1. **Environment Variables**: Use proper secrets management
2. **Database**: Migrate to PostgreSQL or PlanetScale
3. **Caching**: Implement Redis for tool results
4. **Monitoring**: Add OpenTelemetry or Datadog
5. **Error Tracking**: Integrate Sentry
6. **Rate Limiting**: Implement per-user limits
7. **Authentication**: Add auth provider
8. **Deployment**: Use Vercel or similar

## Troubleshooting

### Common Issues

1. **Stream Not Working**: Check API route returns proper stream response
2. **Tools Not Executing**: Verify tool registration and enablement
3. **Database Errors**: Check migrations and connection string
4. **Type Errors**: Ensure Zod schemas match actual data

### Debug Mode
```typescript
// Enable verbose logging
process.env.DEBUG = 'ai:*';
```

## Future Enhancements

1. **Voice Input/Output**: Speech-to-text and TTS
2. **File Uploads**: Process documents and images
3. **Collaborative Chat**: Multi-user conversations
4. **Plugin System**: User-installable tools
5. **Fine-tuning**: Custom model training
6. **Analytics Dashboard**: Usage statistics
7. **Export/Import**: Chat history management

## References

- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Prisma Documentation](https://www.prisma.io/docs)
- [OpenAI API](https://platform.openai.com/docs)
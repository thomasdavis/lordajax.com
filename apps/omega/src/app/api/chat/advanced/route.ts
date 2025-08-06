import { streamText, convertToModelMessages, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSystemPrompt } from '@/lib/ai/prompts';
import { allTools } from '@/lib/ai/tools';

export const maxDuration = 30;

// Dynamic tool that creates other tools on the fly
const createDynamicTool = tool({
  description: 'Create a new tool dynamically based on requirements',
  inputSchema: z.object({
    name: z.string().describe('Name of the new tool'),
    description: z.string().describe('What the tool does'),
    parameters: z.record(z.any()).describe('Parameters the tool accepts'),
    code: z.string().describe('JavaScript code to execute'),
  }),
  execute: async ({ name, description, parameters, code }) => {
    try {
      // Create a function from the code
      const func = new Function('parameters', code);
      
      // Store the tool definition (in production, save to database)
      const toolDefinition = {
        name,
        description,
        parameters,
        code,
        createdAt: new Date().toISOString(),
      };
      
      return {
        success: true,
        message: `Tool "${name}" created successfully`,
        definition: toolDefinition,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create tool',
      };
    }
  },
});

// Tool with prepare step for complex operations
const dataAnalysisTool = tool({
  description: 'Analyze data with preparation step',
  inputSchema: z.object({
    data: z.array(z.number()).describe('Array of numbers to analyze'),
    operations: z.array(z.enum(['mean', 'median', 'mode', 'stddev', 'min', 'max', 'sum'])),
  }),
  experimental_prepareStep: async ({ data, operations }) => {
    // Prepare step: validate and transform data
    console.log('Preparing data analysis...');
    
    // Remove invalid values
    const cleanData = data.filter(n => !isNaN(n) && isFinite(n));
    
    if (cleanData.length === 0) {
      throw new Error('No valid data to analyze');
    }
    
    // Return prepared parameters
    return {
      data: cleanData,
      operations,
      metadata: {
        originalCount: data.length,
        cleanedCount: cleanData.length,
        removedCount: data.length - cleanData.length,
      },
    };
  },
  execute: async ({ data, operations, metadata }) => {
    const results: Record<string, number> = {};
    
    for (const op of operations) {
      switch (op) {
        case 'mean':
          results.mean = data.reduce((a, b) => a + b, 0) / data.length;
          break;
        case 'median':
          const sorted = [...data].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          results.median = sorted.length % 2 
            ? sorted[mid] 
            : (sorted[mid - 1] + sorted[mid]) / 2;
          break;
        case 'min':
          results.min = Math.min(...data);
          break;
        case 'max':
          results.max = Math.max(...data);
          break;
        case 'sum':
          results.sum = data.reduce((a, b) => a + b, 0);
          break;
        case 'stddev':
          const mean = data.reduce((a, b) => a + b, 0) / data.length;
          const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
          results.stddev = Math.sqrt(variance);
          break;
      }
    }
    
    return {
      results,
      metadata,
      summary: `Analyzed ${data.length} values with ${operations.length} operations`,
    };
  },
});

// Multi-step workflow tool
const workflowTool = tool({
  description: 'Execute a multi-step workflow',
  inputSchema: z.object({
    steps: z.array(z.object({
      action: z.string(),
      params: z.any(),
      condition: z.string().optional(),
    })),
  }),
  execute: async ({ steps }) => {
    const results: any[] = [];
    let context: any = {};
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Check condition if present
      if (step.condition) {
        try {
          const conditionFunc = new Function('context', `return ${step.condition}`);
          if (!conditionFunc(context)) {
            results.push({
              step: i + 1,
              action: step.action,
              skipped: true,
              reason: 'Condition not met',
            });
            continue;
          }
        } catch (error) {
          results.push({
            step: i + 1,
            action: step.action,
            error: 'Invalid condition',
          });
          continue;
        }
      }
      
      // Execute step
      try {
        // Simulate step execution
        const result = {
          step: i + 1,
          action: step.action,
          params: step.params,
          executed: true,
          timestamp: new Date().toISOString(),
        };
        
        results.push(result);
        
        // Update context for next steps
        context[`step${i + 1}`] = result;
      } catch (error) {
        results.push({
          step: i + 1,
          action: step.action,
          error: error instanceof Error ? error.message : 'Step failed',
        });
        break;
      }
    }
    
    return {
      workflow: 'completed',
      totalSteps: steps.length,
      executedSteps: results.filter(r => r.executed).length,
      results,
    };
  },
});

const requestSchema = z.object({
  messages: z.array(z.any()),
  chatId: z.string().optional(),
  model: z.string().default('gpt-4o'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().optional(),
  systemPromptMode: z.enum(['default', 'creative', 'analytical', 'coding', 'learning']).default('default'),
  enabledTools: z.array(z.string()).optional(),
  enableDynamicTools: z.boolean().default(false),
  userData: z.any().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      messages, 
      chatId, 
      model, 
      temperature, 
      maxTokens,
      systemPromptMode,
      enabledTools,
      enableDynamicTools,
      userData,
    } = requestSchema.parse(body);

    // Get or create chat
    let chat;
    if (chatId) {
      chat = await db.getChat(chatId);
      if (!chat) {
        return new Response('Chat not found', { status: 404 });
      }
    } else {
      chat = await db.createChat({
        title: 'Advanced Chat',
        model,
        temperature,
        maxTokens,
        systemPrompt: getSystemPrompt(systemPromptMode),
        metadata: { ...userData, advanced: true },
      });
    }

    // Build tools object
    let tools = enabledTools 
      ? Object.fromEntries(
          Object.entries(allTools).filter(([key]) => enabledTools.includes(key))
        )
      : allTools;
    
    // Add advanced tools
    if (enableDynamicTools) {
      tools = {
        ...tools,
        createDynamicTool,
        dataAnalysis: dataAnalysisTool,
        workflow: workflowTool,
      };
    }

    // Stream the response with advanced features
    const result = streamText({
      model: openai(model),
      messages: [
        {
          role: 'system',
          content: chat.systemPrompt || getSystemPrompt(systemPromptMode),
        },
        ...convertToModelMessages(messages),
      ],
      temperature,
      maxTokens,
      tools,
      toolChoice: 'auto',
      maxSteps: 10, // Allow multiple tool calls
      experimental_continueSteps: true, // Continue after tool calls
      onStepFinish: async ({ text, toolCalls, toolResults, finishReason, usage }) => {
        console.log('Step finished:', { 
          hasText: !!text, 
          toolCalls: toolCalls?.length || 0,
          finishReason 
        });
        
        // Save to database
        if (text || toolCalls) {
          await db.createMessage({
            chatId: chat.id,
            role: 'assistant',
            content: text,
            toolCalls: toolCalls || undefined,
            toolResults: toolResults || undefined,
            metadata: { usage, finishReason },
          });
        }
      },
    });

    // Return the stream response directly (AI SDK v5 pattern)
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Advanced chat error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request', 
        details: error.errors 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
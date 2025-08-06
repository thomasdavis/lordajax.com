import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db } from '@/lib/db';
import { getSystemPrompt } from '@/lib/ai/prompts';
import { allTools } from '@/lib/ai/tools';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    console.log('=== Chat API Request ===');
    console.log('Body:', JSON.stringify(body, null, 2));
    
    const messages: UIMessage[] = body.messages || [];
    const chatId = body.chatId;
    const model = body.model || 'gpt-4o';
    const temperature = body.temperature || 0.7;
    const maxTokens = body.maxTokens;
    const systemPromptMode = body.systemPromptMode || 'default';
    const enabledTools = body.enabledTools;
    const userData = body.userData;
    
    console.log('Messages:', messages);
    console.log('Model:', model);
    console.log('Enabled Tools:', enabledTools);

    // Get or create chat
    let chat;
    if (chatId) {
      chat = await db.getChat(chatId);
      if (!chat) {
        return new Response('Chat not found', { status: 404 });
      }
    } else {
      // Create new chat
      chat = await db.createChat({
        title: messages[0]?.content?.slice(0, 100) || 'New Chat',
        model,
        temperature,
        maxTokens,
        systemPrompt: getSystemPrompt(systemPromptMode),
        metadata: userData,
      });
    }

    // Save user message to database
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      const userMessage = messages[messages.length - 1];
      await db.createMessage({
        chatId: chat.id,
        role: 'user',
        content: userMessage.content,
        metadata: userData,
      });
    }

    // Filter tools based on enabledTools
    const tools = enabledTools 
      ? Object.fromEntries(
          Object.entries(allTools).filter(([key]) => enabledTools.includes(key))
        )
      : allTools;
    
    console.log('Available tools:', Object.keys(tools));
    console.log('Tool definitions:', tools);

    console.log('System prompt:', chat.systemPrompt || getSystemPrompt(systemPromptMode));
    console.log('Converted messages:', convertToModelMessages(messages));
    
    // Stream the response
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
      onStepFinish: async ({ text, toolCalls, toolResults, finishReason, usage }) => {
        console.log('[Step Finished]', {
          hasText: !!text,
          toolCalls: toolCalls?.length || 0,
          toolResults: toolResults?.length || 0,
          finishReason,
        });
        
        // Save assistant response to database
        if (text) {
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
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'chat-completion',
        metadata: {
          chatId: chat.id,
          userId: userData?.userId,
          model,
        },
      },
    });

    // Return the stream response directly (AI SDK v5 pattern)
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
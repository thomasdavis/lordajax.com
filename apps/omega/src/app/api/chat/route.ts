import { streamText, convertToModelMessages, generateText, type UIMessage } from 'ai';
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
      // Create new chat with a generated title
      const firstMessage = messages[messages.length - 1];
      let title = 'New Chat';
      
      // Generate a smart title based on the first message
      if (firstMessage && typeof firstMessage.content === 'string') {
        try {
          const { text: generatedTitle } = await generateText({
            model: openai('gpt-4o'),
            messages: [
              {
                role: 'system',
                content: 'Generate a short, descriptive title (max 40 chars) for a conversation that starts with this message. Return only the title, no quotes or punctuation. Be creative and specific.',
              },
              {
                role: 'user',
                content: firstMessage.content.slice(0, 500),
              },
            ],
            temperature: 0.7,
            maxTokens: 20,
          });
          
          title = generatedTitle.slice(0, 40) || firstMessage.content.slice(0, 40);
          console.log('Generated title:', title);
        } catch (error) {
          console.error('Failed to generate title:', error);
          // Fallback to first message excerpt
          title = firstMessage.content.slice(0, 40) + (firstMessage.content.length > 40 ? '...' : '');
        }
      }
      
      chat = await db.createChat({
        title,
        model,
        temperature,
        maxTokens,
        systemPrompt: getSystemPrompt(systemPromptMode),
        metadata: userData,
      });
      
      console.log('Created new chat:', chat.id, 'with title:', title);
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
          textContent: text,
          toolCalls: toolCalls?.length || 0,
          toolResults: toolResults?.length || 0,
          finishReason,
        });
        
        // Save assistant response to database
        if (text || toolCalls || toolResults) {
          await db.createMessage({
            chatId: chat.id,
            role: 'assistant',
            content: text || '',
            toolCalls: toolCalls || undefined,
            toolResults: toolResults || undefined,
            metadata: { usage, finishReason },
          });
        }
      },
      maxSteps: 5, // Allow the AI to make multiple tool calls if needed
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

    // Return the stream response directly
    return result.toDataStreamResponse();
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
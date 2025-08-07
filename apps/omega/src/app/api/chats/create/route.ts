import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

// POST /api/chats/create - Create a new chat with optional first message
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      firstMessage, 
      model = 'gpt-4o', 
      temperature = 0.7,
      systemPromptMode = 'default'
    } = body;
    
    let title = 'New Chat';
    
    // Generate a smart title based on the first message if provided
    if (firstMessage) {
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
              content: firstMessage.slice(0, 500),
            },
          ],
          temperature: 0.7,
          maxTokens: 20,
        });
        
        title = generatedTitle.slice(0, 40) || firstMessage.slice(0, 40);
      } catch (error) {
        console.error('Failed to generate title:', error);
        // Fallback to first message excerpt
        title = firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '...' : '');
      }
    }
    
    // Create the chat
    const chat = await prisma.chat.create({
      data: {
        title,
        model,
        temperature,
        systemPrompt: body.systemPrompt,
        metadata: body.metadata,
      },
    });
    
    console.log('Created new chat:', chat.id, 'with title:', title);
    
    return NextResponse.json({ 
      id: chat.id,
      title: chat.title,
    });
  } catch (error) {
    console.error('Failed to create chat:', error);
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

// POST /api/chats/[chatId]/generate-title - Generate a title for the chat
export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const chat = await prisma.chat.findUnique({
      where: { id: params.chatId },
      include: {
        messages: {
          take: 5,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Don't regenerate if already has a custom title
    if (chat.title && chat.title !== 'New Chat') {
      return NextResponse.json({ title: chat.title });
    }

    // Generate title from first few messages
    const messageText = chat.messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n')
      .slice(0, 500);

    const { text: title } = await generateText({
      model: openai('gpt-4o'),
      messages: [
        {
          role: 'system',
          content: 'Generate a short, descriptive title (max 50 chars) for this conversation. Return only the title, no quotes or punctuation.',
        },
        {
          role: 'user',
          content: messageText,
        },
      ],
      temperature: 0.5,
      maxTokens: 20,
    });

    // Update chat with generated title
    const updatedChat = await prisma.chat.update({
      where: { id: params.chatId },
      data: { title: title.slice(0, 50) },
    });

    return NextResponse.json({ title: updatedChat.title });
  } catch (error) {
    console.error('Failed to generate title:', error);
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 }
    );
  }
}
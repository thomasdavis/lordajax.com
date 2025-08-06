import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/chats - List all chats
export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { messages: true }
        }
      }
    });

    return NextResponse.json(chats);
  } catch (error) {
    console.error('Failed to fetch chats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}

// POST /api/chats - Create a new chat
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const chat = await prisma.chat.create({
      data: {
        title: body.title || 'New Chat',
        userId: body.userId,
        systemPrompt: body.systemPrompt,
        model: body.model || 'gpt-4o',
        temperature: body.temperature || 0.7,
        metadata: body.metadata || {},
      },
    });

    return NextResponse.json(chat);
  } catch (error) {
    console.error('Failed to create chat:', error);
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    );
  }
}
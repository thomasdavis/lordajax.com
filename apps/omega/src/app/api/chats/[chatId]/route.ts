import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/chats/[chatId] - Get a specific chat with messages
export async function GET(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const chat = await prisma.chat.findUnique({
      where: { id: params.chatId },
      include: {
        messages: {
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

    return NextResponse.json(chat);
  } catch (error) {
    console.error('Failed to fetch chat:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat' },
      { status: 500 }
    );
  }
}

// PATCH /api/chats/[chatId] - Update chat
export async function PATCH(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const body = await request.json();
    
    const chat = await prisma.chat.update({
      where: { id: params.chatId },
      data: {
        title: body.title,
        systemPrompt: body.systemPrompt,
        model: body.model,
        temperature: body.temperature,
        metadata: body.metadata,
      },
    });

    return NextResponse.json(chat);
  } catch (error) {
    console.error('Failed to update chat:', error);
    return NextResponse.json(
      { error: 'Failed to update chat' },
      { status: 500 }
    );
  }
}

// DELETE /api/chats/[chatId] - Delete chat
export async function DELETE(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    await prisma.chat.delete({
      where: { id: params.chatId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete chat:', error);
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 }
    );
  }
}
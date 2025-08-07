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
    console.log('Attempting to delete chat:', params.chatId);
    
    // First check if the chat exists
    const existingChat = await prisma.chat.findUnique({
      where: { id: params.chatId },
    });
    
    if (!existingChat) {
      console.log('Chat not found:', params.chatId);
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    // Delete the chat (messages will be cascade deleted)
    await prisma.chat.delete({
      where: { id: params.chatId },
    });
    
    console.log('Chat deleted successfully:', params.chatId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to delete chat', details: errorMessage },
      { status: 500 }
    );
  }
}
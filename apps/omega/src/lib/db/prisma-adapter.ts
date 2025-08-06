import { PrismaClient } from '@prisma/client';
import type { 
  DatabaseAdapter, 
  CreateChatInput, 
  CreateMessageInput, 
  UpdateChatInput,
  ChatWithMessages 
} from './types';

const prisma = new PrismaClient();

export class PrismaAdapter implements DatabaseAdapter {
  // Chat operations
  async createChat(input: CreateChatInput) {
    return await prisma.chat.create({
      data: input,
    });
  }

  async getChat(id: string) {
    return await prisma.chat.findUnique({
      where: { id },
      include: { messages: true },
    });
  }

  async getChatWithMessages(id: string): Promise<ChatWithMessages | null> {
    return await prisma.chat.findUnique({
      where: { id },
      include: { 
        messages: {
          orderBy: { createdAt: 'asc' }
        } 
      },
    });
  }

  async updateChat(id: string, input: UpdateChatInput) {
    return await prisma.chat.update({
      where: { id },
      data: input,
    });
  }

  async deleteChat(id: string) {
    await prisma.chat.delete({
      where: { id },
    });
  }

  async listChats(userId?: string, limit = 20) {
    return await prisma.chat.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  // Message operations
  async createMessage(input: CreateMessageInput) {
    return await prisma.message.create({
      data: input,
    });
  }

  async getMessages(chatId: string, limit = 100) {
    return await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async deleteMessage(id: string) {
    await prisma.message.delete({
      where: { id },
    });
  }

  // Tool operations
  async createTool(tool: any) {
    return await prisma.tool.create({
      data: tool,
    });
  }

  async getTool(id: string) {
    return await prisma.tool.findUnique({
      where: { id },
    });
  }

  async getToolByName(name: string) {
    return await prisma.tool.findUnique({
      where: { name },
    });
  }

  async listTools(category?: string) {
    return await prisma.tool.findMany({
      where: category ? { category } : { enabled: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateTool(id: string, tool: any) {
    return await prisma.tool.update({
      where: { id },
      data: tool,
    });
  }

  async deleteTool(id: string) {
    await prisma.tool.delete({
      where: { id },
    });
  }

  // User preferences
  async getUserPreferences(userId: string) {
    return await prisma.userPreferences.findUnique({
      where: { userId },
    });
  }

  async updateUserPreferences(userId: string, preferences: any) {
    return await prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, ...preferences },
      update: preferences,
    });
  }
}

// Export singleton instance
export const db = new PrismaAdapter();
import { Chat, Message, Tool, UserPreferences } from '@prisma/client';

export type { Chat, Message, Tool, UserPreferences };

export interface ChatWithMessages extends Chat {
  messages: Message[];
}

export interface CreateChatInput {
  title?: string;
  userId?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: any;
}

export interface CreateMessageInput {
  chatId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string | null;
  toolCalls?: any;
  toolResults?: any;
  metadata?: any;
}

export interface UpdateChatInput {
  title?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: any;
}

export interface DatabaseAdapter {
  // Chat operations
  createChat(input: CreateChatInput): Promise<Chat>;
  getChat(id: string): Promise<ChatWithMessages | null>;
  getChatWithMessages(id: string): Promise<ChatWithMessages | null>;
  updateChat(id: string, input: UpdateChatInput): Promise<Chat>;
  deleteChat(id: string): Promise<void>;
  listChats(userId?: string, limit?: number): Promise<Chat[]>;
  
  // Message operations
  createMessage(input: CreateMessageInput): Promise<Message>;
  getMessages(chatId: string, limit?: number): Promise<Message[]>;
  deleteMessage(id: string): Promise<void>;
  
  // Tool operations
  createTool(tool: Omit<Tool, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tool>;
  getTool(id: string): Promise<Tool | null>;
  getToolByName(name: string): Promise<Tool | null>;
  listTools(category?: string): Promise<Tool[]>;
  updateTool(id: string, tool: Partial<Tool>): Promise<Tool>;
  deleteTool(id: string): Promise<void>;
  
  // User preferences
  getUserPreferences(userId: string): Promise<UserPreferences | null>;
  updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences>;
}
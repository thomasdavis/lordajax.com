'use client';

import useSWR from 'swr';
import { useChatStore } from '@/store/chatStore';
import { useEffect } from 'react';
import type { Message } from 'ai';

interface Chat {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    messages: number;
  };
}

interface ChatWithMessages extends Chat {
  messages: any[];
}

export function useChats() {
  const { data, error, isLoading, mutate } = useSWR<Chat[]>('/api/chats', {
    refreshInterval: 5000, // Poll every 5 seconds for updates
  });
  
  const setChats = useChatStore((state) => state.setChats);
  const chats = useChatStore((state) => state.chats);
  
  useEffect(() => {
    if (data) {
      setChats(data);
    }
  }, [data, setChats]);
  
  const refreshChats = () => mutate();
  
  return {
    chats: chats || data || [],
    isLoading,
    error,
    refreshChats,
  };
}

export function useChat(chatId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ChatWithMessages>(
    chatId ? `/api/chats/${chatId}` : null,
    {
      refreshInterval: 0, // No auto-refresh for individual chat
    }
  );
  
  const updateChat = useChatStore((state) => state.updateChat);
  const setActiveMessages = useChatStore((state) => state.setActiveMessages);
  
  useEffect(() => {
    if (data && chatId) {
      updateChat(chatId, data);
      
      // Convert database messages to UI messages
      const uiMessages: Message[] = data.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content || '',
        createdAt: new Date(msg.createdAt),
        ...(msg.toolCalls && { toolCalls: msg.toolCalls }),
        ...(msg.toolResults && { toolResults: msg.toolResults }),
      }));
      
      setActiveMessages(uiMessages);
    }
  }, [data, chatId, updateChat, setActiveMessages]);
  
  const refreshChat = () => mutate();
  
  return {
    chat: data,
    isLoading,
    error,
    refreshChat,
  };
}

export function useCreateChat() {
  const addChat = useChatStore((state) => state.addChat);
  const setCurrentChatId = useChatStore((state) => state.setCurrentChatId);
  const setIsCreatingChat = useChatStore((state) => state.setIsCreatingChat);
  
  const createChat = async (title?: string) => {
    setIsCreatingChat(true);
    
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create chat');
      }
      
      const newChat = await response.json();
      addChat(newChat);
      setCurrentChatId(newChat.id);
      
      return newChat;
    } catch (error) {
      console.error('Failed to create chat:', error);
      throw error;
    } finally {
      setIsCreatingChat(false);
    }
  };
  
  return { createChat };
}

export function useDeleteChat() {
  const deleteChat = useChatStore((state) => state.deleteChat);
  
  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete chat');
      }
      
      deleteChat(chatId);
      
      return true;
    } catch (error) {
      console.error('Failed to delete chat:', error);
      throw error;
    }
  };
  
  return { deleteChat: handleDeleteChat };
}

export function useChatMessages() {
  const activeMessages = useChatStore((state) => state.activeMessages);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const setActiveMessages = useChatStore((state) => state.setActiveMessages);
  const currentChatId = useChatStore((state) => state.currentChatId);
  const incrementMessageCount = useChatStore((state) => state.incrementMessageCount);
  
  return {
    messages: activeMessages,
    addMessage: (message: Message) => {
      addMessage(message);
      if (currentChatId) {
        incrementMessageCount(currentChatId);
      }
    },
    updateMessage,
    setMessages: setActiveMessages,
    clearMessages: () => setActiveMessages([]),
  };
}
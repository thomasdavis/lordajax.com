'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCreateChat, useChats } from '@/hooks/useChats';
import { useChatStore } from '@/store/chatStore';
import { ChatInterface } from './ChatInterface';

interface ChatLayoutProps {
  chatId?: string;
}

export function ChatLayout({ chatId: initialChatId }: ChatLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { createChat } = useCreateChat();
  const { chats, isLoading } = useChats();
  const currentChatId = useChatStore((state) => state.currentChatId);
  const setCurrentChatId = useChatStore((state) => state.setCurrentChatId);
  const isCreatingChat = useChatStore((state) => state.isCreatingChat);
  
  // Set current chat ID from props
  useEffect(() => {
    if (initialChatId) {
      setCurrentChatId(initialChatId);
    }
  }, [initialChatId, setCurrentChatId]);
  
  // Auto-create empty chat when landing on home page
  useEffect(() => {
    const createEmptyChat = async () => {
      // Only create if we're on the home page, not loading, and not already creating
      if (pathname === '/' && !isLoading && !isCreatingChat && !currentChatId) {
        try {
          const newChat = await createChat();
          router.push(`/chat/${newChat.id}`);
        } catch (error) {
          console.error('Failed to create initial chat:', error);
        }
      }
    };
    
    // Small delay to ensure everything is loaded
    const timer = setTimeout(createEmptyChat, 100);
    return () => clearTimeout(timer);
  }, [pathname, isLoading, isCreatingChat, currentChatId, createChat, router]);
  
  return <ChatInterface chatId={currentChatId || initialChatId} />;
}
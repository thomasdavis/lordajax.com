import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Message } from 'ai';

interface Chat {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    messages: number;
  };
  messages?: Message[];
}

interface ChatStore {
  currentChatId: string | null;
  chats: Chat[];
  activeMessages: Message[];
  isCreatingChat: boolean;
  
  setCurrentChatId: (id: string | null) => void;
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  updateChat: (id: string, updates: Partial<Chat>) => void;
  deleteChat: (id: string) => void;
  setActiveMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setIsCreatingChat: (isCreating: boolean) => void;
  incrementMessageCount: (chatId: string) => void;
  
  getChatById: (id: string) => Chat | undefined;
  getCurrentChat: () => Chat | undefined;
}

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set, get) => ({
    currentChatId: null,
    chats: [],
    activeMessages: [],
    isCreatingChat: false,
    
    setCurrentChatId: (id) => set({ currentChatId: id }),
    
    setChats: (chats) => set({ chats }),
    
    addChat: (chat) => set((state) => ({
      chats: [chat, ...state.chats],
    })),
    
    updateChat: (id, updates) => set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === id ? { ...chat, ...updates } : chat
      ),
    })),
    
    deleteChat: (id) => set((state) => ({
      chats: state.chats.filter((chat) => chat.id !== id),
      currentChatId: state.currentChatId === id ? null : state.currentChatId,
    })),
    
    setActiveMessages: (messages) => set({ activeMessages: messages }),
    
    addMessage: (message) => set((state) => ({
      activeMessages: [...state.activeMessages, message],
    })),
    
    updateMessage: (id, updates) => set((state) => ({
      activeMessages: state.activeMessages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    })),
    
    setIsCreatingChat: (isCreating) => set({ isCreatingChat: isCreating }),
    
    incrementMessageCount: (chatId) => set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              _count: {
                ...chat._count,
                messages: chat._count.messages + 1,
              },
              updatedAt: new Date().toISOString(),
            }
          : chat
      ),
    })),
    
    getChatById: (id) => get().chats.find((chat) => chat.id === id),
    
    getCurrentChat: () => {
      const state = get();
      return state.currentChatId ? state.getChatById(state.currentChatId) : undefined;
    },
  }))
);
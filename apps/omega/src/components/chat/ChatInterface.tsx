'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatSettings } from './ChatSettings';
import { cn } from '@/lib/utils';
import { Bot, Menu, Plus, History, Settings, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Message } from 'ai';

interface ChatInterfaceProps {
  chatId?: string;
  className?: string;
  showSidebar?: boolean;
}

export function ChatInterface({ 
  chatId: initialChatId, 
  className,
  showSidebar = true 
}: ChatInterfaceProps) {
  const router = useRouter();
  const [chatId, setChatId] = useState(initialChatId);
  const [sidebarOpen, setSidebarOpen] = useState(showSidebar);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [chatSettings, setChatSettings] = useState({
    model: 'gpt-4o',
    temperature: 0.7,
    systemPromptMode: 'default' as const,
    enabledTools: ['calculator', 'weather', 'datetime', 'knowledgeBase', 'chartGenerator'],
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  
  const {
    messages,
    sendMessage,
    isLoading,
    error,
    reload,
    stop,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: {
        ...chatSettings,
        chatId,
      },
    }),
    onResponse: async (response) => {
      console.log('Chat response received:', response);
      
      // Get chat ID from response headers if it's a new chat
      const newChatId = response.headers.get('X-Chat-Id');
      if (newChatId && !chatId) {
        setChatId(newChatId);
        router.push(`/chat/${newChatId}`);
        
        // Generate title after first exchange
        setTimeout(async () => {
          try {
            await fetch(`/api/chats/${newChatId}/generate-title`, {
              method: 'POST',
            });
            // Refresh chat history
            const historyResponse = await fetch('/api/chats');
            if (historyResponse.ok) {
              const chats = await historyResponse.json();
              setChatHistory(chats);
            }
          } catch (error) {
            console.error('Failed to generate title:', error);
          }
        }, 2000);
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });
  
  // Load chat history
  useEffect(() => {
    const loadChatHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const response = await fetch('/api/chats');
        if (response.ok) {
          const chats = await response.json();
          setChatHistory(chats);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    
    loadChatHistory();
  }, [chatId]);

  // Load existing chat messages if chatId is provided
  useEffect(() => {
    const loadChat = async () => {
      if (!chatId || hasInitialized.current) return;
      
      try {
        const response = await fetch(`/api/chats/${chatId}`);
        if (response.ok) {
          const chat = await response.json();
          
          // Convert database messages to UI messages
          const uiMessages: Message[] = chat.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content || '',
            createdAt: new Date(msg.createdAt),
            ...(msg.toolCalls && { toolCalls: msg.toolCalls }),
            ...(msg.toolResults && { toolResults: msg.toolResults }),
          }));
          
          setMessages(uiMessages);
          hasInitialized.current = true;
        }
      } catch (error) {
        console.error('Failed to load chat:', error);
      }
    };
    
    loadChat();
  }, [chatId, setMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewChat = () => {
    router.push('/');
  };

  const handleDeleteChat = async (deleteChatId: string) => {
    try {
      const response = await fetch(`/api/chats/${deleteChatId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Refresh chat history
        const historyResponse = await fetch('/api/chats');
        if (historyResponse.ok) {
          const chats = await historyResponse.json();
          setChatHistory(chats);
        }
        
        // If deleting current chat, go home
        if (deleteChatId === chatId) {
          router.push('/');
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const handleSendMessage = (message: string, attachments?: File[]) => {
    console.log('[ChatInterface] Sending message:', message);
    sendMessage({ 
      text: message,
    });
    console.log('[ChatInterface] Message sent, current messages:', messages);
  };

  const handleSettingsChange = (newSettings: typeof chatSettings) => {
    setChatSettings(newSettings);
  };

  return (
    <div className={cn('flex h-screen bg-background', className)}>
      {/* Sidebar */}
      {showSidebar && (
        <div
          className={cn(
            'flex w-64 flex-col border-r bg-gradient-to-b from-secondary/50 to-background transition-all duration-300 shadow-lg',
            !sidebarOpen && 'w-0 overflow-hidden'
          )}
        >
          <div className="flex items-center justify-between p-4 border-b backdrop-blur-sm bg-background/50">
            <h2 className="font-bold text-lg bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
              Chats
            </h2>
            <button
              onClick={handleNewChat}
              className="rounded-xl p-2 hover:bg-primary/10 transition-colors group"
              title="New chat"
            >
              <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {isLoadingHistory ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-xl bg-muted/30" />
                  ))}
                </div>
              ) : chatHistory.length > 0 ? (
                chatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    className={cn(
                      "group relative rounded-xl p-3 hover:bg-primary/10 transition-all cursor-pointer",
                      chat.id === chatId && "bg-primary/10 border border-primary/20"
                    )}
                    onClick={() => router.push(`/chat/${chat.id}`)}
                  >
                    <div className="pr-8">
                      <div className="font-medium text-sm truncate">
                        {chat.title || 'Untitled Chat'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {chat._count.messages} messages · {new Date(chat.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChat(chat.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 transition-all"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-xl p-4 text-sm text-muted-foreground bg-muted/30 border border-border/50">
                  <History className="h-4 w-4 mb-2 opacity-50" />
                  No previous chats
                </div>
              )}
            </div>
          </div>
          
          <div className="border-t p-4 bg-background/50 backdrop-blur-sm">
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl p-3 hover:bg-primary/10 transition-all group"
            >
              <Settings className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-sm font-medium">Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-gradient-to-r from-background via-secondary/30 to-background backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {showSidebar && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded-xl p-2 hover:bg-primary/10 transition-all group"
              >
                <Menu className="h-5 w-5 group-hover:scale-110 transition-transform" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <h1 className="font-bold text-xl bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
                AI Assistant
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary">
              {chatSettings.model}
            </span>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-xl p-2 hover:bg-primary/10 transition-all group"
            >
              <Settings className="h-5 w-5 group-hover:rotate-90 transition-transform" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-background via-background to-secondary/20">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center max-w-2xl">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent blur-2xl opacity-20 animate-pulse"></div>
                  <Bot className="relative mx-auto h-16 w-16 text-primary animate-bounce" />
                </div>
                <h2 className="mt-6 text-2xl font-bold bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
                  Start a conversation
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Ask me anything or try one of the tools below
                </p>
                
                {/* Quick action cards */}
                <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                  {[
                    { icon: '🧮', text: 'Calculator', example: 'What\'s 2 + 2?' },
                    { icon: '☁️', text: 'Weather', example: 'Weather in NYC' },
                    { icon: '📅', text: 'Date/Time', example: 'Current time' },
                    { icon: '💻', text: 'Code', example: 'Run JavaScript' },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(item.example)}
                      className="p-4 rounded-xl bg-card hover:bg-primary/10 border border-border hover:border-primary/50 transition-all group"
                    >
                      <div className="text-2xl mb-2 group-hover:scale-125 transition-transform">{item.icon}</div>
                      <div className="text-sm font-medium">{item.text}</div>
                      <div className="text-xs text-muted-foreground mt-1">{item.example}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="pb-32">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id || index}
                  message={message}
                  isStreaming={isLoading && index === messages.length - 1}
                />
              ))}
              
              {error && (
                <div className="mx-4 mt-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                  Error: {error.message}
                  <button
                    onClick={() => reload()}
                    className="ml-2 underline"
                  >
                    Retry
                  </button>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSubmit={handleSendMessage}
          isLoading={isLoading}
          className="sticky bottom-0"
        />
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <ChatSettings
          settings={chatSettings}
          onChange={handleSettingsChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
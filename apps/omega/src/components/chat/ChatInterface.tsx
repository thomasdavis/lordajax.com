'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatSettings } from './ChatSettings';
import { cn } from '@/lib/utils';
import { Bot, Menu, Plus, History, Settings, Trash2, Sparkles } from 'lucide-react';
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
        console.log('New chat created with ID:', newChatId);
        setChatId(newChatId);
        
        // Immediately update the URL
        router.push(`/chat/${newChatId}`);
        
        // Immediately refresh chat history to show the new chat in sidebar
        try {
          const historyResponse = await fetch('/api/chats');
          if (historyResponse.ok) {
            const chats = await historyResponse.json();
            setChatHistory(chats);
            console.log('Chat history updated with new chat');
          }
        } catch (error) {
          console.error('Failed to refresh chat history:', error);
        }
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
    // Add confirmation dialog
    const confirmDelete = window.confirm('Are you sure you want to delete this chat? This action cannot be undone.');
    
    if (!confirmDelete) {
      return;
    }
    
    try {
      console.log('Deleting chat:', deleteChatId);
      const response = await fetch(`/api/chats/${deleteChatId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        console.log('Chat deleted successfully');
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
      } else {
        const error = await response.json();
        console.error('Delete failed:', error);
        alert('Failed to delete chat. Please try again.');
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      alert('An error occurred while deleting the chat. Please try again.');
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
    <div className={cn('flex h-screen bg-gray-50 dark:bg-gray-900', className)}>
      {/* Sidebar */}
      {showSidebar && (
        <div
          className={cn(
            'flex w-72 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300',
            !sidebarOpen && 'w-0 overflow-hidden'
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
              Chat History
            </h2>
            <button
              onClick={handleNewChat}
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="New chat"
            >
              <Plus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-2">
              {isLoadingHistory ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                  ))}
                </div>
              ) : chatHistory.length > 0 ? (
                chatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    className={cn(
                      "group relative rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer",
                      chat.id === chatId && "bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800"
                    )}
                    onClick={() => router.push(`/chat/${chat.id}`)}
                  >
                    <div className="pr-8">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                        {chat.title || 'New Chat'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {chat._count.messages} messages · {new Date(chat.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChat(chat.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-all"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-lg p-4 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50">
                  <History className="h-4 w-4 mb-2 opacity-50" />
                  No previous chats
                </div>
              )}
            </div>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            >
              <Settings className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {showSidebar && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-gray-100">
                  AI Assistant
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Powered by {chatSettings.model}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Online</span>
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 w-fit shadow-xl">
                  <Bot className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Start a conversation
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  I'm here to help! Ask me anything or choose from the suggestions below.
                </p>
                <div className="grid gap-3 text-left">
                  {[
                    { icon: '💡', text: 'Explain quantum computing in simple terms' },
                    { icon: '📝', text: 'Help me write a professional email' },
                    { icon: '🎨', text: 'Generate creative ideas for a birthday party' },
                    { icon: '📊', text: 'Analyze this data and create a chart' },
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(suggestion.text)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">{suggestion.icon}</span>
                      <span className="text-gray-700 dark:text-gray-300">{suggestion.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1 py-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={isLoading && message === messages[messages.length - 1]}
                />
              ))}
              {error && (
                <div className="mx-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-600 dark:text-red-400">
                  {error.message}
                  <button
                    onClick={() => reload()}
                    className="ml-2 underline hover:no-underline"
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
          placeholder="Type your message..."
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
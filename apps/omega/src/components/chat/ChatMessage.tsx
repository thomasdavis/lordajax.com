'use client';

import { type Message } from 'ai';
import { User, Bot, Wrench, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  console.log('[ChatMessage] Rendering message:', message);
  
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isTool = message.role === 'tool';
  
  // Extract text content from parts or use content directly
  const getMessageText = () => {
    if (typeof message.content === 'string') {
      return message.content;
    }
    if (message.parts && Array.isArray(message.parts)) {
      return message.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
    }
    return '';
  };

  const messageText = getMessageText();

  return (
    <div
      className={cn(
        'group relative flex gap-4 p-6 transition-all hover:bg-secondary/20',
        isUser && 'bg-gradient-to-r from-transparent via-primary/5 to-transparent',
        isAssistant && 'bg-gradient-to-r from-transparent via-secondary/30 to-transparent',
        isTool && 'bg-gradient-to-r from-transparent via-accent/20 to-transparent'
      )}
    >
      <div className={cn(
        "flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-xl shadow-lg transition-all group-hover:scale-110",
        isUser && "bg-gradient-to-br from-primary to-accent",
        isAssistant && "bg-gradient-to-br from-secondary to-muted border border-border",
        isTool && "bg-gradient-to-br from-orange-500 to-yellow-500"
      )}>
        {isUser && <User className="h-5 w-5 text-white" />}
        {isAssistant && <Bot className="h-5 w-5 text-foreground" />}
        {isTool && <Wrench className="h-5 w-5 text-white" />}
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {messageText && (
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {messageText}
            </ReactMarkdown>
          )}
          
          {isStreaming && !messageText && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
            </div>
          )}
        </div>
        
        {/* Handle tool invocations from parts */}
        {message.parts && message.parts.some((p: any) => p.type === 'tool-call' || p.type === 'tool-result') && (
          <div className="space-y-2">
            {message.parts
              .filter((part: any) => part.type === 'tool-call')
              .map((invocation: any, index: number) => (
              <div
                key={index}
                className="rounded-lg border bg-background/50 p-3 text-sm"
              >
                <div className="flex items-center gap-2 font-medium">
                  <Wrench className="h-3 w-3" />
                  {invocation.toolName || 'Tool'}
                </div>
                
                {invocation.args && (
                  <div className="mt-2">
                    <pre className="overflow-x-auto text-xs">
                      {JSON.stringify(invocation.args, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
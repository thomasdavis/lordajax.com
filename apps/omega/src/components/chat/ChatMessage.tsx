'use client';

import { type Message } from 'ai';
import { User, Bot, Wrench, AlertCircle, CheckCircle, BarChart, Sparkles, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import dynamic from 'next/dynamic';

// Dynamically import ChartDisplay to avoid SSR issues
const ChartDisplay = dynamic(
  () => import('@/components/generative/ChartDisplay').then(mod => mod.ChartDisplay),
  { 
    ssr: false,
    loading: () => <div className="h-64 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" />
  }
);

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  console.log('[ChatMessage] Rendering message:', {
    role: message.role,
    content: message.content,
    parts: message.parts,
    id: message.id
  });
  
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isTool = message.role === 'tool';
  
  // Extract text content from parts or use content directly
  const getMessageText = () => {
    if (typeof message.content === 'string') {
      return message.content;
    }
    if (message.parts && Array.isArray(message.parts)) {
      // First check for text parts
      const textParts = message.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text || '')
        .join('');
      
      if (textParts) return textParts;
      
      // If no text, check for tool outputs (the new format uses type: 'tool-[toolname]')
      const toolParts = message.parts.filter((part: any) => 
        part.type?.startsWith('tool-') && part.output
      );
      
      if (toolParts.length > 0) {
        return toolParts.map((part: any) => {
          const output = part.output;
          if (output.formatted) return output.formatted;
          if (output.result !== undefined) return `The answer is ${output.result}`;
          if (typeof output === 'string') return output;
          return JSON.stringify(output, null, 2);
        }).join('\n');
      }
      
      // Fallback for tool-result type
      const toolResults = message.parts.filter((part: any) => part.type === 'tool-result');
      if (toolResults.length > 0) {
        return toolResults.map((part: any) => {
          if (part.result?.formatted) return part.result.formatted;
          if (part.result?.result !== undefined) return `Result: ${part.result.result}`;
          return JSON.stringify(part.result || part, null, 2);
        }).join('\n');
      }
      
      return '';
    }
    return '';
  };

  const messageText = getMessageText();

  return (
    <div
      className={cn(
        'group relative flex gap-4 px-4 sm:px-6 lg:px-8 py-6 transition-all',
        isUser && 'justify-end',
        !isUser && 'justify-start'
      )}
    >
      {!isUser && (
        <div className={cn(
          "flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-2xl shadow-lg transition-all group-hover:scale-105",
          isAssistant && "bg-gradient-to-br from-violet-500 to-purple-600",
          isTool && "bg-gradient-to-br from-amber-500 to-orange-600"
        )}>
          {isAssistant && <Sparkles className="h-5 w-5 text-white" />}
          {isTool && <Activity className="h-5 w-5 text-white" />}
        </div>
      )}
      
      <div className={cn(
        "relative max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]",
        isUser && "order-1"
      )}>
        <div className={cn(
          "rounded-2xl px-5 py-3.5 shadow-sm transition-all",
          isUser && "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg",
          isAssistant && "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
          isTool && "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800"
        )}>
          {!isUser && (
            <div className={cn(
              "mb-2 text-xs font-semibold tracking-wide uppercase",
              isAssistant && "text-violet-600 dark:text-violet-400",
              isTool && "text-amber-600 dark:text-amber-400"
            )}>
              {isAssistant ? "Assistant" : "Tool Result"}
            </div>
          )}
          
          <div className={cn(
            'prose prose-sm max-w-none',
            isUser && 'prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
            !isUser && 'dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0'
          )}>
            {messageText ? (
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="relative group">
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs text-gray-400 font-mono">{match[1]}</span>
                        </div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          className="!mt-2 !mb-2 rounded-lg !bg-gray-900"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="space-y-1">{children}</ol>,
                }}
              >
                {messageText}
              </ReactMarkdown>
            ) : (
              <span className="text-gray-500 dark:text-gray-400 italic">No content</span>
            )}
          </div>
          
          {isStreaming && !messageText && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-violet-600 dark:bg-violet-400" />
              <div className="h-2 w-2 animate-pulse rounded-full bg-violet-600 dark:bg-violet-400 [animation-delay:0.2s]" />
              <div className="h-2 w-2 animate-pulse rounded-full bg-violet-600 dark:bg-violet-400 [animation-delay:0.4s]" />
            </div>
          )}
        </div>
        
        {/* Handle tool invocations and results from parts */}
        {message.parts && message.parts.some((p: any) => 
          p.type === 'tool-call' || 
          p.type === 'tool-result' || 
          p.type?.startsWith('tool-')
        ) && (
          <div className="space-y-3 mt-3">
            {/* Tool executions (new format: tool-[toolname]) */}
            {message.parts
              .filter((part: any) => part.type?.startsWith('tool-') && part.type !== 'tool-call' && part.type !== 'tool-result')
              .map((tool: any, index: number) => {
                const toolName = tool.type.replace('tool-', '');
                return (
                  <div key={`tool-${index}`} className="space-y-2">
                    {/* Tool Input */}
                    {tool.input && (
                      <div className="rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800 p-4">
                        <div className="flex items-center gap-2 font-medium text-violet-600 dark:text-violet-400">
                          <Wrench className="h-4 w-4" />
                          <span>Using: {toolName}</span>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          <pre className="overflow-x-auto font-mono">
                            {JSON.stringify(tool.input, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                    
                    {/* Tool Output */}
                    {tool.output && (
                      <>
                        {/* Check if this is a chart output */}
                        {tool.output.componentType === 'chart' && tool.output.chartConfig ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                              <BarChart className="h-4 w-4" />
                              <span>Generated Chart</span>
                            </div>
                            <ChartDisplay config={tool.output.chartConfig} />
                          </div>
                        ) : (
                          <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
                            <div className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle className="h-4 w-4" />
                              <span>Result from {toolName}</span>
                            </div>
                            <div className="mt-2 text-sm">
                              {tool.output.formatted ? (
                                <p className="text-gray-800 dark:text-gray-200 font-medium">{tool.output.formatted}</p>
                              ) : tool.output.result !== undefined ? (
                                <p className="text-gray-800 dark:text-gray-200 font-medium">Result: {tool.output.result}</p>
                              ) : (
                                <pre className="overflow-x-auto text-xs font-mono text-gray-600 dark:text-gray-400">
                                  {JSON.stringify(tool.output, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            
            {/* Legacy Tool Calls */}
            {message.parts
              .filter((part: any) => part.type === 'tool-call')
              .map((call: any, index: number) => (
              <div
                key={`call-${index}`}
                className="rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800 p-4"
              >
                <div className="flex items-center gap-2 font-medium text-violet-600 dark:text-violet-400">
                  <Wrench className="h-4 w-4" />
                  <span>Using: {call.toolName || 'Tool'}</span>
                </div>
                
                {call.args && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    <pre className="overflow-x-auto font-mono">
                      {JSON.stringify(call.args, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
            
            {/* Tool Results */}
            {message.parts
              .filter((part: any) => part.type === 'tool-result')
              .map((result: any, index: number) => (
              <div
                key={`result-${index}`}
                className="rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800 p-4"
              >
                <div className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>Result</span>
                </div>
                
                <div className="mt-2 text-sm">
                  {result.result && (
                    <div>
                      {typeof result.result === 'object' ? (
                        result.result.formatted ? (
                          <p className="font-medium text-gray-800 dark:text-gray-200">{result.result.formatted}</p>
                        ) : (
                          <pre className="overflow-x-auto text-xs font-mono text-gray-600 dark:text-gray-400">
                            {JSON.stringify(result.result, null, 2)}
                          </pre>
                        )
                      ) : (
                        <p className="text-gray-800 dark:text-gray-200">{result.result}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
          <User className="h-5 w-5 text-white" />
        </div>
      )}
    </div>
  );
}
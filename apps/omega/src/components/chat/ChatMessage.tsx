'use client';

import { type Message } from 'ai';
import { User, Bot, Wrench, AlertCircle, CheckCircle, BarChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import dynamic from 'next/dynamic';

// Dynamically import ChartDisplay to avoid SSR issues
const ChartDisplay = dynamic(
  () => import('@/components/generative/ChartDisplay').then(mod => mod.ChartDisplay),
  { 
    ssr: false,
    loading: () => <div className="h-64 animate-pulse bg-muted rounded-xl" />
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
                      <div className="rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 p-4">
                        <div className="flex items-center gap-2 font-medium text-primary">
                          <Wrench className="h-4 w-4" />
                          <span>Using: {toolName}</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          <pre className="overflow-x-auto">
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
                            <div className="flex items-center gap-2 font-medium text-green-600 dark:text-green-400">
                              <BarChart className="h-4 w-4" />
                              <span>Generated Chart</span>
                            </div>
                            <ChartDisplay config={tool.output.chartConfig} />
                          </div>
                        ) : (
                          <div className="rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 p-4">
                            <div className="flex items-center gap-2 font-medium text-green-600 dark:text-green-400">
                              <CheckCircle className="h-4 w-4" />
                              <span>Result from {toolName}</span>
                            </div>
                            <div className="mt-2 text-sm font-mono">
                              {tool.output.formatted ? (
                                <p className="text-lg">{tool.output.formatted}</p>
                              ) : tool.output.result !== undefined ? (
                                <p className="text-lg">Result: {tool.output.result}</p>
                              ) : (
                                <pre className="overflow-x-auto text-xs">
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
                className="rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 p-4"
              >
                <div className="flex items-center gap-2 font-medium text-primary">
                  <Wrench className="h-4 w-4" />
                  <span>Using: {call.toolName || 'Tool'}</span>
                </div>
                
                {call.args && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <pre className="overflow-x-auto">
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
                className="rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 p-4"
              >
                <div className="flex items-center gap-2 font-medium text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>Result</span>
                </div>
                
                <div className="mt-2 text-sm">
                  {result.result && (
                    <div>
                      {typeof result.result === 'object' ? (
                        result.result.formatted ? (
                          <p className="font-mono">{result.result.formatted}</p>
                        ) : (
                          <pre className="overflow-x-auto text-xs">
                            {JSON.stringify(result.result, null, 2)}
                          </pre>
                        )
                      ) : (
                        <p>{result.result}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
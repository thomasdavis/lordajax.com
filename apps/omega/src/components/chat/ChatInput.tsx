'use client';

import { useRef, useState, KeyboardEvent } from 'react';
import { Send, Paperclip, Mic, StopCircle, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSubmit: (message: string, attachments?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({ 
  onSubmit, 
  isLoading = false, 
  placeholder = 'Type a message...',
  className 
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSubmit(input, attachments.length > 0 ? attachments : undefined);
      setInput('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // TODO: Implement actual recording logic
  };

  // Auto-resize textarea
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className={cn('border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900', className)}>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm"
            >
              <Paperclip className="h-3 w-3 text-gray-500" />
              <span className="max-w-[200px] truncate text-gray-700 dark:text-gray-300">{file.name}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className="relative px-4 py-3">
        <div className={cn(
          "relative flex items-end gap-2 rounded-2xl border-2 transition-all",
          isFocused 
            ? "border-violet-500 shadow-lg shadow-violet-500/20" 
            : "border-gray-200 dark:border-gray-700",
          isLoading && "opacity-50 pointer-events-none"
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className="flex-1 max-h-[200px] resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          
          <div className="flex items-center gap-1 pb-3 pr-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="rounded-lg p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-all"
              title="Attach files"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            
            <button
              onClick={toggleRecording}
              disabled={isLoading}
              className="rounded-lg p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-all"
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? (
                <StopCircle className="h-4 w-4 text-red-500 animate-pulse" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
            
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
            
            <button
              onClick={handleSubmit}
              disabled={isLoading || !input.trim()}
              className={cn(
                "rounded-lg p-2 transition-all",
                input.trim() && !isLoading
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:shadow-lg hover:scale-105 shadow-md"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
              )}
              title="Send message"
            >
              {isLoading ? (
                <Sparkles className="h-4 w-4 animate-pulse" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {isFocused && (
          <div className="absolute -bottom-6 left-4 text-xs text-gray-400 dark:text-gray-500">
            Press Enter to send, Shift+Enter for new line
          </div>
        )}
      </div>
    </div>
  );
}
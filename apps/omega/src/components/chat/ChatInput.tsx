'use client';

import { useRef, useState, KeyboardEvent } from 'react';
import { Send, Paperclip, Settings, Mic, StopCircle } from 'lucide-react';
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
    <div className={cn('border-t bg-gradient-to-t from-secondary/30 to-background backdrop-blur-sm', className)}>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 p-4 pb-0">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm border border-primary/20 animate-fadeIn"
            >
              <Paperclip className="h-3 w-3 text-primary" />
              <span className="max-w-[200px] truncate font-medium">{file.name}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex items-end gap-3 p-4">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className="max-h-[200px] w-full resize-none rounded-2xl border-2 border-border bg-card px-4 py-3 pr-12 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/20 disabled:opacity-50 transition-all"
          />
          <div className="absolute right-2 bottom-2 flex gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="rounded-xl p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50 transition-all"
              title="Attach files"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            
            <button
              onClick={toggleRecording}
              disabled={isLoading}
              className="rounded-xl p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50 transition-all"
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? (
                <StopCircle className="h-4 w-4 text-red-500 animate-pulse" />
              ) : (
                <Mic className="h-4 w-4" />
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
        
        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          className="rounded-2xl bg-gradient-to-r from-primary to-accent p-3 text-primary-foreground hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:scale-100 transition-all shadow-md"
          title="Send message"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
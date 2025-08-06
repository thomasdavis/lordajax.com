'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

interface ChatSettingsProps {
  settings: {
    model: string;
    temperature: number;
    systemPromptMode: 'default' | 'creative' | 'analytical' | 'coding' | 'learning';
    enabledTools: string[];
  };
  onChange: (settings: any) => void;
  onClose: () => void;
}

const availableModels = [
  { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

const availableTools = [
  { value: 'calculator', label: 'Calculator', description: 'Perform mathematical calculations' },
  { value: 'weather', label: 'Weather', description: 'Get weather information' },
  { value: 'codeRunner', label: 'Code Runner', description: 'Execute JavaScript code' },
  { value: 'datetime', label: 'Date & Time', description: 'Date and time operations' },
  { value: 'knowledgeBase', label: 'Knowledge Base', description: 'Store and retrieve information' },
  { value: 'chartGenerator', label: 'Chart Generator', description: 'Create visual charts and graphs' },
];

const promptModes = [
  { value: 'default', label: 'Default', description: 'Balanced assistant' },
  { value: 'creative', label: 'Creative', description: 'More imaginative responses' },
  { value: 'analytical', label: 'Analytical', description: 'Data-driven analysis' },
  { value: 'coding', label: 'Coding', description: 'Programming assistant' },
  { value: 'learning', label: 'Learning', description: 'Educational explanations' },
];

export function ChatSettings({ settings, onChange, onClose }: ChatSettingsProps) {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    onChange(localSettings);
    onClose();
  };

  const toggleTool = (tool: string) => {
    setLocalSettings(prev => ({
      ...prev,
      enabledTools: prev.enabledTools.includes(tool)
        ? prev.enabledTools.filter(t => t !== tool)
        : [...prev.enabledTools, tool],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-background p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chat Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Model Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Model
            </label>
            <select
              value={localSettings.model}
              onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value })}
              className="w-full rounded-lg border bg-background px-3 py-2"
            >
              {availableModels.map(model => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>

          {/* Temperature */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Temperature: {localSettings.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={localSettings.temperature}
              onChange={(e) => setLocalSettings({ 
                ...localSettings, 
                temperature: parseFloat(e.target.value) 
              })}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Precise</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>

          {/* System Prompt Mode */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Assistant Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {promptModes.map(mode => (
                <button
                  key={mode.value}
                  onClick={() => setLocalSettings({ 
                    ...localSettings, 
                    systemPromptMode: mode.value as any 
                  })}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    localSettings.systemPromptMode === mode.value
                      ? 'border-primary bg-primary/10'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="font-medium">{mode.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {mode.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Enabled Tools */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Enabled Tools
            </label>
            <div className="space-y-2">
              {availableTools.map(tool => (
                <label
                  key={tool.value}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={localSettings.enabledTools.includes(tool.value)}
                    onChange={() => toggleTool(tool.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{tool.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {tool.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { WeatherCard } from '@/components/generative/WeatherCard';
import { StockChart } from '@/components/generative/StockChart';
import { ProgressIndicator } from '@/components/generative/ProgressIndicator';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatSettings } from '@/components/chat/ChatSettings';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ShowcasePage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatSettings, setChatSettings] = useState({
    model: 'gpt-4o',
    temperature: 0.7,
    systemPromptMode: 'default' as const,
    enabledTools: ['calculator', 'weather', 'datetime'],
  });

  const sampleMessage = {
    id: '1',
    role: 'assistant' as const,
    content: 'Here\'s a sample response with **markdown** support:\n\n```javascript\nconst greeting = "Hello, World!";\nconsole.log(greeting);\n```\n\nI can help you with various tasks using my tools.',
    toolInvocations: [
      {
        toolName: 'calculator',
        state: 'result',
        result: { result: 42, expression: '21 * 2', formatted: '21 * 2 = 42' },
      },
    ],
  };

  const progressSteps = [
    { id: '1', title: 'Initialize project', status: 'completed' as const },
    { id: '2', title: 'Install dependencies', status: 'completed' as const },
    { id: '3', title: 'Configure database', status: 'in-progress' as const, progress: 60 },
    { id: '4', title: 'Set up authentication', status: 'pending' as const },
    { id: '5', title: 'Deploy to production', status: 'pending' as const },
  ];

  const stockData = [100, 102, 101, 104, 108, 107, 109, 112, 111, 115];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Chat
            </Link>
            <h1 className="text-3xl font-bold">Component Showcase</h1>
          </div>
        </div>

        <div className="space-y-12">
          {/* Generative UI Components */}
          <section>
            <h2 className="mb-6 text-2xl font-semibold">Generative UI Components</h2>
            
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-medium">Weather Card</h3>
                <WeatherCard
                  city="San Francisco"
                  temperature={68}
                  units="fahrenheit"
                  condition="Partly Cloudy"
                  humidity={65}
                  windSpeed={12}
                />
              </div>

              <div>
                <h3 className="mb-3 text-lg font-medium">Stock Chart</h3>
                <StockChart
                  symbol="AAPL"
                  price={185.50}
                  change={3.25}
                  changePercent={1.78}
                  data={stockData}
                />
              </div>

              <div>
                <h3 className="mb-3 text-lg font-medium">Progress Indicator</h3>
                <ProgressIndicator
                  title="Deployment Progress"
                  steps={progressSteps}
                />
              </div>

              <div>
                <h3 className="mb-3 text-lg font-medium">Loading States</h3>
                <div className="space-y-4">
                  <WeatherCard
                    city="Loading..."
                    temperature={0}
                    units="celsius"
                    condition=""
                    humidity={0}
                    windSpeed={0}
                    isLoading={true}
                  />
                  <StockChart
                    symbol="..."
                    price={0}
                    change={0}
                    changePercent={0}
                    isLoading={true}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Chat Components */}
          <section>
            <h2 className="mb-6 text-2xl font-semibold">Chat Components</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-lg font-medium">Chat Message</h3>
                <div className="rounded-lg border">
                  <ChatMessage message={sampleMessage} />
                  <ChatMessage
                    message={{
                      id: '2',
                      role: 'user',
                      content: 'Can you help me calculate something?',
                    }}
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-medium">Chat Input</h3>
                <div className="rounded-lg border">
                  <ChatInput
                    onSubmit={(message) => alert(`Message: ${message}`)}
                    placeholder="Type a message to test the input..."
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-medium">Settings Modal</h3>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
                >
                  Open Settings Modal
                </button>
              </div>
            </div>
          </section>

          {/* Tool Examples */}
          <section>
            <h2 className="mb-6 text-2xl font-semibold">Available Tools</h2>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { name: 'Calculator', description: 'Perform mathematical calculations', icon: '🧮' },
                { name: 'Weather', description: 'Get weather information for cities', icon: '☁️' },
                { name: 'Code Runner', description: 'Execute JavaScript code safely', icon: '💻' },
                { name: 'DateTime', description: 'Date and time operations', icon: '📅' },
                { name: 'Knowledge Base', description: 'Store and retrieve information', icon: '📚' },
                { name: 'Dynamic Tools', description: 'Create custom tools on the fly', icon: '🔧' },
              ].map((tool) => (
                <div
                  key={tool.name}
                  className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow"
                >
                  <div className="mb-2 text-2xl">{tool.icon}</div>
                  <h3 className="font-semibold">{tool.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Features */}
          <section>
            <h2 className="mb-6 text-2xl font-semibold">Key Features</h2>
            
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6">
                <h3 className="mb-3 text-lg font-semibold">Streaming</h3>
                <ul className="space-y-2 text-sm">
                  <li>✓ Token-by-token text streaming</li>
                  <li>✓ Tool execution streaming</li>
                  <li>✓ UI component streaming</li>
                  <li>✓ Progress updates in real-time</li>
                </ul>
              </div>

              <div className="rounded-lg border bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-6">
                <h3 className="mb-3 text-lg font-semibold">Database</h3>
                <ul className="space-y-2 text-sm">
                  <li>✓ SQLite with Prisma ORM</li>
                  <li>✓ Adapter pattern for flexibility</li>
                  <li>✓ Chat history persistence</li>
                  <li>✓ Tool result caching</li>
                </ul>
              </div>

              <div className="rounded-lg border bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-6">
                <h3 className="mb-3 text-lg font-semibold">AI Features</h3>
                <ul className="space-y-2 text-sm">
                  <li>✓ Multiple AI modes</li>
                  <li>✓ Dynamic tool creation</li>
                  <li>✓ Multi-step workflows</li>
                  <li>✓ Prepare steps for validation</li>
                </ul>
              </div>

              <div className="rounded-lg border bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 p-6">
                <h3 className="mb-3 text-lg font-semibold">Developer Experience</h3>
                <ul className="space-y-2 text-sm">
                  <li>✓ TypeScript with Zod validation</li>
                  <li>✓ Component isolation</li>
                  <li>✓ Comprehensive documentation</li>
                  <li>✓ Hot module replacement</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>

      {settingsOpen && (
        <ChatSettings
          settings={chatSettings}
          onChange={setChatSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
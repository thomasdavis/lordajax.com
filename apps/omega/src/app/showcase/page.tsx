'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings, Home, Search, Heart, Upload, Download, Bell, Shield, Zap, TrendingUp, User, Award } from 'lucide-react';
import { WeatherCard } from '@/components/generative/WeatherCard';
import { StockChart } from '@/components/generative/StockChart';
import { ProgressIndicator } from '@/components/generative/ProgressIndicator';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatSettings } from '@/components/chat/ChatSettings';

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-16">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to Chat
          </Link>
          <h1 className="text-7xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">Component Style Guide</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">A comprehensive guide to all UI components and design patterns</p>
        </div>

        {/* Typography Section */}
        <section className="mb-20">
          <h2 className="text-4xl font-bold mb-10 pb-4 border-b border-gray-200 dark:border-gray-700">Typography</h2>
          
          <div className="space-y-12">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Headings</h3>
              <div className="space-y-4 bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
                <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100">Heading 1 - 6xl Bold</h1>
                <h2 className="text-5xl font-bold text-gray-900 dark:text-gray-100">Heading 2 - 5xl Bold</h2>
                <h3 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Heading 3 - 4xl Bold</h3>
                <h4 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Heading 4 - 3xl Bold</h4>
                <h5 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Heading 5 - 2xl Bold</h5>
                <h6 className="text-xl font-bold text-gray-900 dark:text-gray-100">Heading 6 - xl Bold</h6>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Body Text</h3>
              <div className="space-y-4 bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
                <p className="text-lg text-gray-700 dark:text-gray-300">Large paragraph text for emphasis and readability in key sections.</p>
                <p className="text-base text-gray-700 dark:text-gray-300">Regular paragraph text used for standard body content throughout the application.</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Small paragraph text for secondary information and captions.</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">Extra small text for labels and minor details.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Colors Section */}
        <section className="mb-20">
          <h2 className="text-4xl font-bold mb-10 pb-4 border-b border-gray-200 dark:border-gray-700">Colors</h2>
          
          <div className="space-y-12">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Brand Colors</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
                  <p className="font-bold text-lg">Primary</p>
                  <p className="text-sm opacity-90">Main brand color</p>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-lg">
                  <p className="font-bold text-lg">Secondary</p>
                  <p className="text-sm opacity-90">Supporting brand color</p>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                  <p className="font-bold text-lg">Accent</p>
                  <p className="text-sm opacity-90">Highlight color</p>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 text-white shadow-lg">
                  <p className="font-bold text-lg">Neutral</p>
                  <p className="text-sm opacity-90">Neutral tone</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Semantic Colors</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-xl bg-gradient-to-br from-blue-400 to-blue-500 text-white shadow-lg">
                  <p className="font-bold text-lg">Info</p>
                  <p className="text-sm opacity-90">Informational</p>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg">
                  <p className="font-bold text-lg">Success</p>
                  <p className="text-sm opacity-90">Positive feedback</p>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-lg">
                  <p className="font-bold text-lg">Warning</p>
                  <p className="text-sm opacity-90">Caution needed</p>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-red-400 to-red-500 text-white shadow-lg">
                  <p className="font-bold text-lg">Error</p>
                  <p className="text-sm opacity-90">Error state</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Buttons Section */}
        <section className="mb-20">
          <h2 className="text-4xl font-bold mb-10 pb-4 border-b border-gray-200 dark:border-gray-700">Buttons</h2>
          
          <div className="space-y-12">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Variants</h3>
              <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
                <button className="px-6 py-2.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-colors">Default</button>
                <button className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors shadow-md hover:shadow-lg">Primary</button>
                <button className="px-6 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-medium transition-colors shadow-md hover:shadow-lg">Secondary</button>
                <button className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-md hover:shadow-lg">Accent</button>
                <button className="px-6 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors">Info</button>
                <button className="px-6 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors">Success</button>
                <button className="px-6 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition-colors">Warning</button>
                <button className="px-6 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">Error</button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Outlined</h3>
              <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
                <button className="px-6 py-2.5 rounded-lg border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-medium transition-colors">Default</button>
                <button className="px-6 py-2.5 rounded-lg border-2 border-purple-600 hover:bg-purple-600 text-purple-600 hover:text-white font-medium transition-all">Primary</button>
                <button className="px-6 py-2.5 rounded-lg border-2 border-pink-600 hover:bg-pink-600 text-pink-600 hover:text-white font-medium transition-all">Secondary</button>
                <button className="px-6 py-2.5 rounded-lg border-2 border-blue-600 hover:bg-blue-600 text-blue-600 hover:text-white font-medium transition-all">Accent</button>
                <button className="px-6 py-2.5 rounded-lg border-2 border-blue-500 hover:bg-blue-500 text-blue-500 hover:text-white font-medium transition-all">Info</button>
                <button className="px-6 py-2.5 rounded-lg border-2 border-green-500 hover:bg-green-500 text-green-500 hover:text-white font-medium transition-all">Success</button>
                <button className="px-6 py-2.5 rounded-lg border-2 border-yellow-500 hover:bg-yellow-500 text-yellow-500 hover:text-white font-medium transition-all">Warning</button>
                <button className="px-6 py-2.5 rounded-lg border-2 border-red-500 hover:bg-red-500 text-red-500 hover:text-white font-medium transition-all">Error</button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Sizes</h3>
              <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
                <button className="px-3 py-1 text-xs rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors">Extra Small</button>
                <button className="px-4 py-1.5 text-sm rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors">Small</button>
                <button className="px-6 py-2.5 text-base rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors">Medium</button>
                <button className="px-8 py-3 text-lg rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors">Large</button>
              </div>
            </div>
          </div>
        </section>

        {/* Form Elements Section */}
        <section className="mb-20">
          <h2 className="text-4xl font-bold mb-10 pb-4 border-b border-gray-200 dark:border-gray-700">Form Elements</h2>
          
          <div className="space-y-12">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Text Inputs</h3>
              <div className="space-y-4 bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
                <input type="text" placeholder="Default input" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                <input type="text" placeholder="Primary input" className="w-full px-4 py-2 border-2 border-purple-500 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                <input type="text" placeholder="Secondary input" className="w-full px-4 py-2 border-2 border-pink-500 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all" />
                <input type="text" placeholder="Accent input" className="w-full px-4 py-2 border-2 border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                <input type="text" placeholder="Ghost input" className="w-full px-4 py-2 bg-gray-50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all" />
                <input type="text" placeholder="Disabled input" className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 cursor-not-allowed" disabled />
              </div>
            </div>
          </div>
        </section>

        {/* Feedback Components Section */}
        <section className="mb-20">
          <h2 className="text-4xl font-bold mb-10 pb-4 border-b border-gray-200 dark:border-gray-700">Feedback Components</h2>
          
          <div className="space-y-12">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Alerts</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-gray-100 border border-gray-300 rounded-lg">
                  <Bell className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-700">Default alert message</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-300 rounded-lg">
                  <Bell className="h-5 w-5 text-blue-600" />
                  <span className="text-blue-700">Info: New update available</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-300 rounded-lg">
                  <Shield className="h-5 w-5 text-green-600" />
                  <span className="text-green-700">Success: Your changes have been saved</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  <span className="text-yellow-700">Warning: Please verify your email</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-300 rounded-lg">
                  <Shield className="h-5 w-5 text-red-600" />
                  <span className="text-red-700">Error: Something went wrong</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Badges</h3>
              <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">Default</span>
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">Primary</span>
                <span className="px-2 py-1 text-xs font-medium bg-pink-100 text-pink-700 rounded-full">Secondary</span>
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Accent</span>
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Info</span>
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Success</span>
                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Warning</span>
                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Error</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Loading States</h3>
              <div className="flex flex-wrap items-center gap-6 bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></span>
                <span className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent"></span>
                <span className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent"></span>
                <span className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Progress</h3>
              <div className="space-y-4 bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-gray-600 h-2 rounded-full" style={{width: '0%'}}></div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{width: '25%'}}></div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-pink-600 h-2 rounded-full" style={{width: '50%'}}></div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{width: '75%'}}></div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{width: '100%'}}></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Data Display Section */}
        <section className="mb-20">
          <h2 className="text-4xl font-bold mb-10 pb-4 border-b border-gray-200 dark:border-gray-700">Data Display</h2>
          
          <div className="space-y-12">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Cards</h3>
              <div className="grid gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-bold mb-2">Card Title</h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">This is a basic card with some content inside.</p>
                  <div className="flex justify-end">
                    <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">Action</button>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex">
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-8 flex items-center justify-center">
                    <Award className="h-24 w-24 text-white" />
                  </div>
                  <div className="p-6 flex-1">
                    <h2 className="text-xl font-bold mb-2">Horizontal Card</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">Cards can also be displayed horizontally.</p>
                    <div className="flex justify-end">
                      <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">Learn More</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-500">Total Revenue</p>
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                  <p className="text-3xl font-bold text-purple-600">$89,400</p>
                  <p className="text-sm text-gray-500 mt-1">21% more than last month</p>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-500">New Users</p>
                    <User className="h-6 w-6 text-pink-600" />
                  </div>
                  <p className="text-3xl font-bold text-pink-600">4,200</p>
                  <p className="text-sm text-gray-500 mt-1">↗︎ 400 (22%)</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Tables</h3>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">1</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">John Doe</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">Developer</td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Active</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm"><button className="text-purple-600 hover:text-purple-900">Edit</button></td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">2</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">Jane Smith</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">Designer</td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Active</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm"><button className="text-purple-600 hover:text-purple-900">Edit</button></td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">3</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">Bob Johnson</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">Manager</td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Away</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm"><button className="text-purple-600 hover:text-purple-900">Edit</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Custom Components Section */}
        <section className="mb-20">
          <h2 className="text-4xl font-bold mb-10 pb-4 border-b border-gray-200 dark:border-gray-700">Custom AI Components</h2>
          
          <div className="space-y-12">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Weather Card</h3>
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
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Stock Chart</h3>
              <StockChart
                symbol="AAPL"
                price={185.50}
                change={3.25}
                changePercent={1.78}
                data={stockData}
              />
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Progress Indicator</h3>
              <ProgressIndicator
                title="Deployment Progress"
                steps={progressSteps}
              />
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6">Chat Interface</h3>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                <ChatMessage message={sampleMessage} />
                <ChatMessage
                  message={{
                    id: '2',
                    role: 'user',
                    content: 'Can you help me calculate something?',
                  }}
                />
                <div className="border-t">
                  <ChatInput
                    onSubmit={(message) => alert(`Message: ${message}`)}
                    placeholder="Type a message..."
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Modal for Settings */}
        {settingsOpen && (
          <ChatSettings
            settings={chatSettings}
            onChange={setChatSettings}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
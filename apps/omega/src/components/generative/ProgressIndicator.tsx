'use client';

import { CheckCircle, Circle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Step {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  progress?: number;
}

interface ProgressIndicatorProps {
  steps: Step[];
  title?: string;
  isStreaming?: boolean;
}

export function ProgressIndicator({ 
  steps, 
  title = 'Progress',
  isStreaming = false 
}: ProgressIndicatorProps) {
  const [visibleSteps, setVisibleSteps] = useState<Step[]>([]);

  useEffect(() => {
    // Animate steps appearing one by one
    if (isStreaming) {
      steps.forEach((step, index) => {
        setTimeout(() => {
          setVisibleSteps(prev => [...prev.slice(0, index), step]);
        }, index * 200);
      });
    } else {
      setVisibleSteps(steps);
    }
  }, [steps, isStreaming]);

  const getStepIcon = (status: Step['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'in-progress':
        return <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStepColor = (status: Step['status']) => {
    switch (status) {
      case 'completed':
        return 'from-emerald-500 to-green-600';
      case 'in-progress':
        return 'from-violet-500 to-purple-600';
      case 'error':
        return 'from-red-500 to-rose-600';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  const completedCount = visibleSteps.filter(s => s.status === 'completed').length;
  const overallProgress = (completedCount / Math.max(visibleSteps.length, 1)) * 100;

  return (
    <div className="group relative rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 border border-indigo-200/50 dark:border-indigo-800/50">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="relative">
        {title && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {title}
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {Math.round(overallProgress)}%
              </span>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          {visibleSteps.map((step, index) => (
            <div
              key={step.id}
              className={`relative flex gap-4 p-4 rounded-xl transition-all duration-300 ${
                step.status === 'in-progress' 
                  ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800' 
                  : 'bg-white/50 dark:bg-gray-800/30 backdrop-blur-sm'
              }`}
              style={{
                animation: isStreaming ? 'fadeIn 0.3s ease-out forwards' : undefined,
                animationDelay: isStreaming ? `${index * 0.1}s` : undefined,
              }}
            >
              {/* Step indicator */}
              <div className="flex-shrink-0">
                <div className={`p-2 rounded-lg ${
                  step.status === 'completed' ? 'bg-gradient-to-br from-emerald-400 to-green-500' :
                  step.status === 'in-progress' ? 'bg-gradient-to-br from-violet-400 to-purple-500' :
                  step.status === 'error' ? 'bg-gradient-to-br from-red-400 to-rose-500' :
                  'bg-gradient-to-br from-gray-300 to-gray-400'
                } shadow-md`}>
                  <div className="text-white">
                    {getStepIcon(step.status)}
                  </div>
                </div>
              </div>
              
              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className={`font-semibold ${
                    step.status === 'completed' ? 'text-gray-500 dark:text-gray-400 line-through' : 
                    step.status === 'in-progress' ? 'text-violet-700 dark:text-violet-300' :
                    step.status === 'error' ? 'text-red-700 dark:text-red-300' :
                    'text-gray-700 dark:text-gray-300'
                  }`}>
                    {step.title}
                  </p>
                  {step.progress !== undefined && step.status === 'in-progress' && (
                    <span className="px-2 py-1 text-xs font-semibold bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-full">
                      {step.progress}%
                    </span>
                  )}
                </div>
                
                {step.description && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {step.description}
                  </p>
                )}
                
                {step.progress !== undefined && step.status === 'in-progress' && (
                  <div className="mt-3 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-300"
                      style={{ width: `${step.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
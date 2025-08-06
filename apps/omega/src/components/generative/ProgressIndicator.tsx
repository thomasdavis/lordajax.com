'use client';

import { CheckCircle, Circle, Clock } from 'lucide-react';
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
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 animate-spin text-blue-600" />;
      case 'error':
        return <Circle className="h-5 w-5 text-red-600" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      {title && <h3 className="mb-4 text-lg font-semibold">{title}</h3>}
      
      <div className="space-y-4">
        {visibleSteps.map((step, index) => (
          <div
            key={step.id}
            className="flex gap-3 opacity-0 animate-fadeIn"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex-shrink-0 pt-0.5">
              {getStepIcon(step.status)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={`font-medium ${
                  step.status === 'completed' ? 'text-muted-foreground line-through' : ''
                }`}>
                  {step.title}
                </p>
                {step.progress !== undefined && step.status === 'in-progress' && (
                  <span className="text-sm text-muted-foreground">
                    {step.progress}%
                  </span>
                )}
              </div>
              
              {step.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
              )}
              
              {step.progress !== undefined && step.status === 'in-progress' && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${step.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
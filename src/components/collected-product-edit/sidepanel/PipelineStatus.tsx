'use client';

import { Badge } from '@/components/ui/badge';
import { PIPELINE_STEPS } from '../types';

interface PipelineStatusProps {
  status: string;
}

export function PipelineStatus({ status }: PipelineStatusProps) {
  const currentStepIdx = PIPELINE_STEPS.findIndex(s => s.key === status);

  const getStepStyle = (stepIndex: number) => {
    if (stepIndex < currentStepIdx) return 'bg-green-500';
    if (stepIndex === currentStepIdx) return 'bg-blue-500';
    return 'bg-gray-200';
  };

  const getStepLabelStyle = (stepIndex: number) => {
    if (stepIndex <= currentStepIdx) return 'text-gray-900 font-medium';
    return 'text-gray-400';
  };

  const getStatusColor = () => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-700 border-green-200';
      case 'error': return 'bg-red-100 text-red-700 border-red-200';
      case 'ready': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'discarded': return 'bg-gray-100 text-gray-500 border-gray-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">管线状态</h4>
        <Badge variant="outline" className={`text-xs ${getStatusColor()}`}>
          {status}
        </Badge>
      </div>

      <div className="space-y-2">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full ${getStepStyle(i)} transition-colors`}
              />
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  className={`w-0.5 h-5 ${i < currentStepIdx ? 'bg-green-300' : 'bg-gray-200'}`}
                />
              )}
            </div>
            <span className={`text-sm ${getStepLabelStyle(i)}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

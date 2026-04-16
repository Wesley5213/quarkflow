'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface LogEntry {
  time: string;
  message: string;
  type: 'success' | 'error' | 'working' | 'info';
}

interface LogPanelProps {
  logs: LogEntry[];
  isRunning: boolean;
  totalTime: string;
}

export function LogPanel({ logs, isRunning, totalTime }: LogPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 运行时自动展开
  useEffect(() => {
    if (isRunning) setIsOpen(true);
  }, [isRunning]);

  return (
    <Card className="bg-slate-800/20 border-slate-700/20 overflow-hidden mt-4">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              isRunning ? 'bg-orange-400 animate-pulse' : logs.length > 0 ? 'bg-green-400' : 'bg-slate-500'
            )}
          />
          <span className="text-sm font-semibold text-slate-200">执行日志</span>
          {totalTime && (
            <span className="text-xs text-slate-500 font-mono ml-2">
              {isRunning ? '运行中' : '完成'} · {totalTime}
            </span>
          )}
        </div>
        <span className={cn('text-slate-500 text-xs transition-transform', isOpen && 'rotate-180')}>
          ▼
        </span>
      </button>

      {/* Log Body */}
      <div
        className={cn(
          'px-5 pb-4 max-h-[280px] overflow-y-auto border-t border-slate-700/10',
          !isOpen && 'hidden'
        )}
      >
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 py-1.5 animate-in fade-in duration-300">
            <div
              className={cn(
                'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                log.type === 'success' && 'bg-green-400',
                log.type === 'error' && 'bg-red-400',
                log.type === 'working' && 'bg-orange-400 animate-pulse',
                log.type === 'info' && 'bg-slate-500'
              )}
            />
            <span className="text-xs text-slate-500 font-mono min-w-[40px] flex-shrink-0">
              {log.time}
            </span>
            <span className="text-xs text-slate-300 leading-relaxed">{log.message}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

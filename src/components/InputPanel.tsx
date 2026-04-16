'use client';

import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StyleSelector } from './StyleSelector';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ParsedLink } from '@/lib/parser';

interface InputPanelProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  onClear: () => void;
  isRunning: boolean;
  mode: 'full' | 'saveOnly';
  onModeChange: (mode: 'full' | 'saveOnly') => void;
  style: string;
  onStyleChange: (style: string) => void;
  links: ParsedLink[];
}

export function InputPanel({
  value,
  onChange,
  onGenerate,
  onClear,
  isRunning,
  mode,
  onModeChange,
  style,
  onStyleChange,
  links,
}: InputPanelProps) {
  return (
    <div className="card">
      {/* Mode Toggle */}
      <div className="mode-row mb-4">
        <span className="text-sm text-slate-400 font-medium">模式：</span>
        <div className="flex bg-slate-900/60 rounded-lg p-1 border border-slate-800">
          <button
            onClick={() => onModeChange('full')}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-medium transition-all',
              mode === 'full'
                ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            完整模式
          </button>
          <button
            onClick={() => onModeChange('saveOnly')}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-medium transition-all',
              mode === 'saveOnly'
                ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            仅转存
          </button>
        </div>
      </div>

      {/* Section Label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
          01
        </span>
        <span className="text-sm font-bold text-slate-200">原推文</span>
      </div>

      {/* Input Area */}
      <div className="mb-3">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="粘贴包含夸克网盘链接的推广文案...

示例：
内部资料《绝秘人性天书》
揭秘人性底层逻辑，助你洞悉人心奥秘
链接：https://pan.quark.cn/s/19e1b0d18c95"
          className="min-h-[200px] bg-slate-900/50 border-slate-700/50 text-slate-200 text-sm leading-relaxed resize-y font-slate-400 placeholder:text-slate-600 focus:border-orange-500 focus:ring-orange-500/20"
        />

        {/* Link Chips — 放在输入框下方，避免遮盖文字 */}
        {links.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {links.map((link, i) => (
              <Badge
                key={i}
                variant="outline"
                className="bg-orange-500/10 border-orange-500/30 text-orange-400 text-xs font-mono"
              >
                🔗 链接{i + 1}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Style Selector */}
      {mode === 'full' && (
        <div className="mb-4">
          <StyleSelector value={style} onChange={onStyleChange} />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={onGenerate}
          disabled={!value.trim() || isRunning}
          className={cn(
            'flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-lg py-2.5 transition-all',
            isRunning && 'animate-pulse'
          )}
        >
          {isRunning ? '处理中...' : '🚀 一键生成'}
        </Button>
        <Button
          onClick={onClear}
          variant="outline"
          className="border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 rounded-lg px-5"
        >
          清空
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LinkMap {
  [original: string]: string;
}

interface OutputPanelProps {
  outputText: string;
  linkMap: LinkMap;
  onCopyFull: () => void;
  onCopyLinks: () => void;
}

export function OutputPanel({
  outputText,
  linkMap,
  onCopyFull,
  onCopyLinks,
}: OutputPanelProps) {
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedLinks, setCopiedLinks] = useState(false);

  const handleCopyFull = () => {
    onCopyFull();
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
  };

  const handleCopyLinks = () => {
    onCopyLinks();
    setCopiedLinks(true);
    setTimeout(() => setCopiedLinks(false), 2000);
  };

  const hasOutput = outputText || Object.keys(linkMap).length > 0;
  const entries = Object.entries(linkMap);

  return (
    <Card className="bg-slate-800/30 border-slate-700/30 backdrop-blur">
      {/* Section Label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
          02
        </span>
        <span className="text-sm font-bold text-slate-200">输出</span>
      </div>

      {/* New Links Display */}
      {entries.length > 0 && (
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 mb-3">
          <div className="text-xs text-orange-400 font-bold uppercase tracking-wider mb-2">
            新分享链接
          </div>
          {entries.map(([original, newLink], i) => (
            <div key={i} className="flex gap-2 py-1 border-b border-slate-700/30 last:border-0">
              <span className="text-orange-400 text-xs font-bold min-w-[20px]">[{i + 1}]</span>
              <span className="text-slate-300 text-xs font-mono break-all">{newLink}</span>
            </div>
          ))}
        </div>
      )}

      {/* Output Box */}
      <div className="bg-slate-900/40 border border-slate-700/20 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
        {!hasOutput ? (
          <div className="flex flex-col items-center justify-center min-h-[180px] text-center">
            <div className="text-4xl mb-2 opacity-50">📄</div>
            <p className="text-slate-500 text-sm">输入文案后点击「一键生成」</p>
          </div>
        ) : (
          <pre className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap break-words font-slate-400">
            {outputText}
          </pre>
        )}
      </div>

      {/* Copy Buttons */}
      {hasOutput && (
        <div className="flex gap-3 mt-4">
          <Button
            onClick={handleCopyFull}
            className={cn(
              'flex-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 rounded-lg py-2 font-semibold text-sm transition-all',
              copiedFull && 'border-green-500/50 text-green-400'
            )}
          >
            {copiedFull ? '✓ 已复制' : '📋 一键复制'}
          </Button>
          {entries.length > 0 && (
            <Button
              onClick={handleCopyLinks}
              className={cn(
                'bg-slate-400/5 border border-slate-600/20 text-slate-400 hover:bg-slate-400/10 rounded-lg py-2 px-4 text-sm transition-all',
                copiedLinks && 'border-green-500/50 text-green-400'
              )}
            >
              {copiedLinks ? '✓ 已复制' : '🔗 仅复制链接'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

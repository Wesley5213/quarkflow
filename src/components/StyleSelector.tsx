'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const styles = [
  { value: 'default', label: '默认改写 — 保持原风格，换一种说法' },
  { value: 'casual', label: '口语种草 — 口语化，加入个人体验感' },
  { value: 'suspense', label: '悬念钩子 — 强化好奇心和紧迫感' },
  { value: 'structured', label: '干货总结 — 理性、结构化表达' },
];

interface StyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function StyleSelector({ value, onChange }: StyleSelectorProps) {
  return (
    <div>
      <Label className="text-xs text-slate-400 font-medium mb-2 block">改写风格</Label>
      <Select value={value} onValueChange={(v) => onChange(v || 'default')}>
        <SelectTrigger className="w-full bg-slate-900/50 border-slate-700/50 text-slate-200 text-sm font-medium rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
          {styles.map((style) => (
            <SelectItem
              key={style.value}
              value={style.value}
              className="text-sm focus:bg-slate-700 focus:text-slate-200"
            >
              {style.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

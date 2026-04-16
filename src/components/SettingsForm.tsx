'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getConfig, saveConfig, AppConfig } from '@/lib/config';
import { copyToClipboard } from '@/lib/clipboard';

interface SettingsFormProps {
  onClose: () => void;
}

// Cookie 提取脚本（捕获夸克网盘所有认证相关 cookie）
const EXTRACT_SCRIPT =
  "javascript:(function(){" +
  "var all=document.cookie.split(';');" +
  "var result=all.map(function(c){return c.trim();}).filter(function(c){return c.length>0;}).join('; ');" +
  "if(!result){alert('未找到 Cookie，请确保已登录 pan.quark.cn');return;}" +
  "var wrap=document.createElement('div');" +
  "wrap.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;';" +
  "var box=document.createElement('div');" +
  "box.style.cssText='background:#1e293b;border-radius:12px;padding:20px;width:90%;max-width:700px;';" +
  "var title=document.createElement('p');" +
  "title.style.cssText='color:#f97316;font-weight:bold;margin:0 0 10px;font-family:sans-serif;';" +
  "title.textContent='✅ Cookie 已提取 — 全选后复制，粘贴到 QuarkFlow 设置';" +
  "var ta=document.createElement('textarea');" +
  "ta.value=result;" +
  "ta.style.cssText='width:100%;height:120px;background:#0f172a;color:#10b981;font-size:11px;font-family:monospace;border:1px solid #334155;border-radius:6px;padding:8px;resize:none;box-sizing:border-box;';" +
  "var btn=document.createElement('button');" +
  "btn.textContent='📋 一键复制并关闭';" +
  "btn.style.cssText='margin-top:10px;width:100%;padding:10px;background:#f97316;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-family:sans-serif;';" +
  "btn.onclick=function(){" +
  "ta.select();" +
  "if(navigator.clipboard){navigator.clipboard.writeText(result).then(function(){document.body.removeChild(wrap);alert('✅ Cookie 已复制！请粘贴到 QuarkFlow 设置框');}).catch(function(){document.execCommand('copy');document.body.removeChild(wrap);alert('✅ Cookie 已复制！');});}" +
  "else{document.execCommand('copy');document.body.removeChild(wrap);alert('✅ Cookie 已复制！');}" +
  "};" +
  "box.appendChild(title);box.appendChild(ta);box.appendChild(btn);" +
  "wrap.appendChild(box);document.body.appendChild(wrap);" +
  "ta.focus();ta.select();" +
  "})();";

export function SettingsForm({ onClose }: SettingsFormProps) {
  const [config, setConfig] = useState<AppConfig>({
    deepseekKey: '',
    quarkCookie: '',
    savePath: '/QuarkFlow转存',
    qasUrl: '',
    qasToken: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    setConfig(getConfig());
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    saveConfig(config);
    setTimeout(() => {
      setIsSaving(false);
      onClose();
      window.location.reload();
    }, 500);
  };

  const handleTest = async () => {
    if (!config.quarkCookie && !config.deepseekKey) {
      setTestStatus('error');
      setTestMessage('请先填写夸克 Cookie 或 DeepSeek API Key');
      return;
    }
    setTestStatus('testing');
    setTestMessage('验证中...');
    try {
      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quarkCookie: config.quarkCookie,
          deepseekKey: config.deepseekKey,
        }),
      });
      const data = await res.json();
      const parts: string[] = [];
      if (data.quark?.status === 'ok') parts.push(`✅ 夸克账号: ${data.quark.nickname}`);
      else if (config.quarkCookie) parts.push(`❌ 夸克 Cookie: ${data.quark?.nickname || '无效'}`);
      if (data.deepseek?.status === 'ok') parts.push('✅ DeepSeek 已连接');
      else if (config.deepseekKey) parts.push(`❌ DeepSeek: ${data.deepseek?.model || '连接失败'}`);
      setTestStatus(parts.some(p => p.startsWith('❌')) ? 'error' : 'ok');
      setTestMessage(parts.join('　'));
    } catch (e: unknown) {
      setTestStatus('error');
      setTestMessage(`连接失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleCopyScript = async () => {
    await copyToClipboard(EXTRACT_SCRIPT);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-slate-900 border-slate-700 p-6 max-h-[90vh] overflow-y-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-100">⚙ 系统设置</h2>
            <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
              首次使用请配置
            </Badge>
          </div>
          <Button onClick={onClose} variant="ghost" className="text-slate-400 hover:text-slate-200 h-8 px-3">
            ✕ 关闭
          </Button>
        </div>

        {/* 验证结果 */}
        {testStatus !== 'idle' && (
          <div className={`mb-4 p-3 rounded-lg text-xs ${
            testStatus === 'ok' ? 'bg-green-500/10 border border-green-500/30 text-green-400' :
            testStatus === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-400' :
            'bg-slate-500/10 border border-slate-500/30 text-slate-400'
          }`}>
            {testMessage}
          </div>
        )}

        <div className="space-y-5">
          {/* 夸克 Cookie（核心） */}
          <div>
            <Label className="text-sm text-slate-300 font-medium block mb-1.5">
              夸克 Cookie <span className="text-red-400">*</span>
            </Label>
            <textarea
              value={config.quarkCookie}
              onChange={(e) => setConfig({ ...config, quarkCookie: e.target.value })}
              placeholder="__pus=xxx; __puus=xxx; kps=xxx; ..."
              rows={3}
              className="w-full bg-slate-800/50 border border-slate-600 text-slate-200 text-xs font-mono rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-orange-500 placeholder:text-slate-600 leading-relaxed"
            />
            <p className="text-xs text-amber-500/80 mt-1">
              ⚠ 需要从 Network 面板复制完整 Cookie（含 HttpOnly），Console 脚本无法获取
            </p>
          </div>

          {/* DeepSeek API Key */}
          <div>
            <Label className="text-sm text-slate-300 font-medium block mb-1.5">
              DeepSeek API Key
              <span className="text-slate-500 text-xs font-normal ml-2">（文案改写，可选）</span>
            </Label>
            <Input
              type="password"
              value={config.deepseekKey}
              onChange={(e) => setConfig({ ...config, deepseekKey: e.target.value })}
              placeholder="sk-xxxxxxxxxxxxxxxx"
              className="bg-slate-800/50 border-slate-600 text-slate-200 text-sm font-mono rounded-lg"
            />
          </div>

          {/* 转存目录 */}
          <div>
            <Label className="text-sm text-slate-300 font-medium block mb-1.5">默认转存目录</Label>
            <Input
              value={config.savePath}
              onChange={(e) => setConfig({ ...config, savePath: e.target.value })}
              placeholder="/QuarkFlow转存"
              className="bg-slate-800/50 border-slate-600 text-slate-200 text-sm font-mono rounded-lg"
            />
            <p className="text-xs text-slate-500 mt-1">文件转存到此目录下的「日期/时间戳」子目录</p>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleTest}
            disabled={testStatus === 'testing'}
            variant="outline"
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            {testStatus === 'testing' ? '验证中...' : '🔍 验证配置'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-lg"
          >
            {isSaving ? '保存中...' : '💾 保存设置'}
          </Button>
        </div>

        {/* 使用说明 */}
        <div className="mt-5 p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg">
          <h3 className="text-orange-400 text-sm font-bold mb-3">🚀 正确获取 Cookie 的方法</h3>
          <ol className="text-xs text-slate-300 space-y-2">
            <li className="flex gap-2">
              <span className="text-orange-400 font-bold min-w-[16px]">1.</span>
              <span>登录 <span className="text-sky-400">pan.quark.cn</span>，按 F12 → 点 <b>Network（网络）</b> 标签</span>
            </li>
            <li className="flex gap-2">
              <span className="text-orange-400 font-bold min-w-[16px]">2.</span>
              <span>在搜索框输入 <span className="text-sky-400 font-mono">clouddrive</span>，然后点击网盘中任意一个文件夹</span>
            </li>
            <li className="flex gap-2">
              <span className="text-orange-400 font-bold min-w-[16px]">3.</span>
              <span>点击 Network 列表中出现的任意请求 → <b>Headers</b> → 找到 <span className="text-sky-400">cookie:</span> 行</span>
            </li>
            <li className="flex gap-2">
              <span className="text-orange-400 font-bold min-w-[16px]">4.</span>
              <span>右键 cookie 值 → <b>Copy value</b>，粘贴到上方框 → 验证 → 保存</span>
            </li>
          </ol>
          <p className="text-xs text-slate-500 mt-3">⚠ Cookie 有效期约 7–30 天，失效后重新提取即可</p>
        </div>
      </Card>
    </div>
  );
}

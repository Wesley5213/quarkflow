'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { InputPanel } from '@/components/InputPanel';
import { OutputPanel } from '@/components/OutputPanel';
import { LogPanel, LogEntry } from '@/components/LogPanel';
import { SettingsForm } from '@/components/SettingsForm';
import { QUARK_LINK_REGEX, parseText, replacePlaceholders, type ParsedLink } from '@/lib/parser';
import { getConfig } from '@/lib/config';
import { copyToClipboard } from '@/lib/clipboard';
import { readSseStream } from '@/lib/stream';
// CookieHelper 已移除，恢复 QAS 模式

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [linkMap, setLinkMap] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<ParsedLink[]>([]);
  const [mode, setMode] = useState<'full' | 'saveOnly'>('full');
  const [style, setStyle] = useState('default');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalTime, setTotalTime] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 解析输入中的链接
  useEffect(() => {
    const { links: parsed } = parseText(inputText);
    setLinks(parsed);
  }, [inputText]);

  const updateTimer = useCallback(() => {
    if (startTimeRef.current) {
      setTotalTime(`${((Date.now() - startTimeRef.current) / 1000).toFixed(1)}s`);
    }
  }, []);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const elapsed = startTimeRef.current
      ? ((Date.now() - startTimeRef.current) / 1000).toFixed(1)
      : '0.0';
    setLogs((prev) => [...prev, { time: `${elapsed}s`, message, type }]);
  }, []);

  // 一键生成
  const handleGenerate = useCallback(async () => {
    if (!inputText.trim() || isRunning) return;

    setIsRunning(true);
    setOutputText('');
    setLinkMap({});
    setLogs([]);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(updateTimer, 100);

    addLog('开始处理...', 'working');

    const { textWithoutLinks, links: parsedLinks } = parseText(inputText);
    setLinks(parsedLinks);

    if (parsedLinks.length > 0) {
      addLog(`检测到 ${parsedLinks.length} 个夸克网盘链接`, 'success');
    } else {
      addLog('未检测到夸克网盘链接，仅执行文案改写', 'info');
    }

    const config = getConfig();
    let rewritten = textWithoutLinks;
    const newLinkMap: Record<string, string> = {};

    // 文案改写
    if (mode === 'full') {
      addLog('AI 改写文案中...', 'working');
      try {
        if (config.deepseekKey) {
          const response = await fetch('/api/rewrite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: textWithoutLinks,
              style,
              links: parsedLinks,
              deepseekKey: config.deepseekKey,
            }),
          });

          if (!response.ok) throw new Error(`API 错误: ${response.status}`);

          const reader = response.body?.getReader();
          if (reader) {
            await readSseStream(reader, (data) => {
              const json = data as { type: string; content?: string; full_text?: string };
              if (json.type === 'chunk' && json.content) {
                setOutputText(json.content);
              } else if (json.type === 'done' && json.full_text) {
                rewritten = json.full_text;
              }
            });
          }
        } else {
          addLog('未配置 API Key，使用演示模式', 'info');
          rewritten = await demoRewrite(textWithoutLinks);
        }
        addLog('文案改写完成', 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`改写失败: ${msg}`, 'error');
        rewritten = textWithoutLinks;
      }
    } else {
      addLog('仅转存模式，跳过文案改写', 'info');
    }

    setOutputText(rewritten);

    // 转存文件
    if (parsedLinks.length > 0) {
      addLog('开始转存文件...', 'working');
      try {
        if (config.quarkCookie) {
          const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              links: parsedLinks.map((l) => l.original),
              save_path: config.savePath,
              quarkCookie: config.quarkCookie,
            }),
          });

          if (!response.ok) throw new Error(`API 错误: ${response.status}`);

          const reader = response.body?.getReader();
          if (reader) {
            await readSseStream(reader, (data) => {
              const json = data as {
                type: string;
                message?: string;
                link_index?: number;
                original?: string;
                new_link?: string;
                link_map?: Record<string, string>;
              };
              if (json.type === 'progress' && json.message) {
                addLog(json.message, 'working');
              } else if (json.type === 'link_done' && json.original && json.new_link) {
                newLinkMap[json.original] = json.new_link;
                addLog(`链接 ${(json.link_index ?? 0) + 1} 转存完成`, 'success');
              } else if (json.type === 'all_done' && json.link_map) {
                setLinkMap(json.link_map);
              }
            });
          }
        } else {
          addLog('未配置夸克 Cookie，使用演示模式', 'info');
          const demoMap = await demoSave(parsedLinks);
          setLinkMap(demoMap);
          Object.assign(newLinkMap, demoMap);
        }
        addLog('全部转存完成', 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`转存失败: ${msg}`, 'error');
      }
    }

    // 替换链接占位符
    if (parsedLinks.length > 0 && Object.keys(newLinkMap).length > 0) {
      setOutputText(replacePlaceholders(rewritten, parsedLinks, newLinkMap));
    }

    if (timerRef.current) clearInterval(timerRef.current);
    updateTimer();
    setIsRunning(false);
    addLog('全部完成 ✓', 'success');
  }, [inputText, isRunning, mode, style, addLog, updateTimer]);

  // 演示模式 - 模拟改写
  const demoRewrite = async (text: string): Promise<string> => {
    const lines = text.split('\n');
    const demo = `📢 独家分享！\n\n${lines
      .map((l) => {
        if (l.match(/\[链接\d+\]/)) return l;
        if (!l.trim()) return '';
        return '✨ ' + l.replace(/[《》]/g, '').trim();
      })
      .filter(Boolean)
      .join('\n')}\n\n⚡ 速存速看，过期不候！`;

    let result = '';
    for (let i = 0; i < demo.length; i += 2) {
      result += demo.slice(i, i + 2);
      setOutputText(result);
      await new Promise((r) => setTimeout(r, 18));
    }
    return demo;
  };

  // 演示模式 - 模拟转存
  const demoSave = async (
    parsedLinks: ParsedLink[]
  ): Promise<Record<string, string>> => {
    const map: Record<string, string> = {};
    for (let i = 0; i < parsedLinks.length; i++) {
      addLog(`转存文件 ${i + 1}/${parsedLinks.length}...`, 'working');
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
      addLog(`生成分享链接 ${i + 1}/${parsedLinks.length}...`, 'working');
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));
      const fakeId = Math.random().toString(36).slice(2, 14);
      map[parsedLinks[i].original] = `https://pan.quark.cn/s/${fakeId}`;
      addLog(`链接 ${i + 1}/${parsedLinks.length} 完成`, 'success');
    }
    return map;
  };

  const handleClear = useCallback(() => {
    setInputText('');
    setOutputText('');
    setLinkMap({});
    setLinks([]);
    setLogs([]);
    setTotalTime('');
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleCopyFull = useCallback(async () => {
    await copyToClipboard(outputText);
  }, [outputText]);

  const handleCopyLinks = useCallback(async () => {
    await copyToClipboard(Object.values(linkMap).join('\n'));
  }, [linkMap]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-4xl mx-auto px-5 pb-16">
        {/* Header */}
        <header className="flex items-center justify-between py-4 border-b border-slate-800/50 sticky top-0 z-10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-700 rounded-lg text-white font-bold text-sm">
              ◆
            </div>
            <span className="text-xl font-bold text-slate-100 tracking-tight">QuarkFlow</span>
            <span className="text-xs text-slate-500 border border-slate-800 rounded px-2 py-0.5 font-medium">
              V1.0
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 bg-transparent border border-slate-700/30 text-slate-400 px-4 py-1.5 rounded-lg text-sm font-medium hover:border-orange-500 hover:text-orange-400 transition-all"
            >
              ⚙ 设置
            </button>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <InputPanel
            value={inputText}
            onChange={setInputText}
            onGenerate={handleGenerate}
            onClear={handleClear}
            isRunning={isRunning}
            mode={mode}
            onModeChange={setMode}
            style={style}
            onStyleChange={setStyle}
            links={links}
          />
          <OutputPanel
            outputText={outputText}
            linkMap={linkMap}
            onCopyFull={handleCopyFull}
            onCopyLinks={handleCopyLinks}
          />
        </div>

        {/* Log Panel */}
        <LogPanel logs={logs} isRunning={isRunning} totalTime={totalTime} />

        {/* Footer */}
        <footer className="text-center pt-8 pb-4">
          <span className="text-slate-700 text-xs">QuarkFlow — 夸克网盘转存 & 文案二创工具</span>
        </footer>
      </div>

      {/* Settings Modal */}
      {showSettings && <SettingsForm onClose={() => setShowSettings(false)} />}
    </main>
  );
}

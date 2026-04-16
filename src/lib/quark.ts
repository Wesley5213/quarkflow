// quark-auto-save (QAS) API 封装

export interface QASTaskResult {
  success: boolean;
  original: string;
  newLink?: string;
  error?: string;
}

interface QASTaskItem {
  taskname: string;
  newlink?: string;
  status?: string;
}

interface QASDataResponse {
  success?: boolean;
  data?: {
    tasklist?: QASTaskItem[];
    version?: string;
    nickname?: string;
  };
  tasklist?: QASTaskItem[];
  version?: string;
  nickname?: string;
}

export interface QASSaveOptions {
  links: string[];
  savePath: string;
  qasUrl: string;
  qasToken: string;
  onProgress?: (info: { linkIndex: number; step: string; message: string }) => void;
}

export async function saveAndShare(
  options: QASSaveOptions
): Promise<Record<string, string>> {
  const { links, savePath, qasUrl, qasToken, onProgress } = options;
  const linkMap: Record<string, string> = {};
  const today = new Date().toISOString().slice(0, 10);
  const targetPath = `${savePath}/${today}`;

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    onProgress?.({
      linkIndex: i,
      step: 'saving',
      message: `转存文件中... ${i + 1}/${links.length}`,
    });

    try {
      // Step 1: 添加转存任务
      const taskName = `QF_${Date.now()}_${i}`;
      const addRes = await fetch(`${qasUrl}/api/add_task?token=${qasToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskname: taskName,
          shareurl: link,
          savepath: targetPath,
        }),
      });

      if (!addRes.ok) {
        throw new Error(`添加任务失败: ${addRes.status}`);
      }

      onProgress?.({
        linkIndex: i,
        step: 'running',
        message: `执行转存任务... ${i + 1}/${links.length}`,
      });

      // Step 2: 触发立即执行
      const runRes = await fetch(`${qasUrl}/run_script_now?token=${qasToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasklist: [{
            taskname: taskName,
            shareurl: link,
            savepath: targetPath,
          }],
        }),
      });

      if (!runRes.ok) {
        throw new Error(`执行任务失败: ${runRes.status}`);
      }

      // Step 3: 等待任务完成并获取新链接
      onProgress?.({
        linkIndex: i,
        step: 'sharing',
        message: `生成分享链接... ${i + 1}/${links.length}`,
      });

      const newLink = await pollForNewLink(qasUrl, qasToken, taskName, link);
      linkMap[link] = newLink || link;

    } catch (err) {
      console.error(`转存失败 ${link}:`, err);
      linkMap[link] = link; // 失败时保留原链接
    }
  }

  return linkMap;
}

async function pollForNewLink(
  qasUrl: string,
  qasToken: string,
  taskName: string,
  _originalLink: string,
  maxAttempts = 15
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${qasUrl}/data?token=${qasToken}`);
      if (res.ok) {
        const json: QASDataResponse = await res.json();
        // QAS 返回结构: { success: true, data: { tasklist: [...] } }
        const taskList = json.data?.tasklist ?? json.tasklist;
        const task = taskList?.find((t) => t.taskname === taskName);
        if (task?.newlink) {
          return task.newlink;
        }
      }
    } catch (e) {
      console.error('轮询获取链接失败:', e);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

export async function testQASConnection(qasUrl: string, qasToken: string): Promise<{ status: string; version: string; nickname?: string }> {
  try {
    const res = await fetch(`${qasUrl}/data?token=${qasToken}`);
    if (!res.ok) {
      throw new Error(`QAS API 错误: ${res.status}`);
    }
    const json: QASDataResponse = await res.json();
    return {
      status: 'ok',
      version: json.data?.version || json.version || 'unknown',
      nickname: json.data?.nickname || json.nickname,
    };
  } catch (e) {
    throw new Error(`QAS 连接失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

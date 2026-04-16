// GET /api/qas-debug-run - 添加任务 -> 立即执行 -> 轮询 newlink 全流程测试
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const qasUrl = searchParams.get('qasUrl');
  const qasToken = searchParams.get('qasToken');
  const shareurl = searchParams.get('shareurl') || 'https://pan.quark.cn/s/xxxxxxxx';
  const savepath = searchParams.get('savepath') || '/QuarkFlow测试';

  if (!qasUrl || !qasToken) {
    return NextResponse.json({ error: '缺少 qasUrl 或 qasToken' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const targetPath = `${savepath}/${today}`;
  const taskName = `DEBUG_RUN_${Date.now()}`;

  try {
    // Step 1: 添加任务
    const addRes = await fetch(`${qasUrl}/api/add_task?token=${qasToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskname: taskName, shareurl, savepath: targetPath }),
    });
    const addJson = await addRes.json();

    // Step 2: 立即触发执行
    const runRes = await fetch(`${qasUrl}/run_script_now?token=${qasToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasklist: [{ taskname: taskName, shareurl, savepath: targetPath }],
      }),
    });
    const runText = await runRes.text();

    // Step 3: 轮询 newlink（最多 30 次，每次 3 秒）
    let finalResult = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const dataRes = await fetch(`${qasUrl}/data?token=${qasToken}`);
      const dataJson = await dataRes.json();
      const task = (dataJson.data?.tasklist || [])
        .find((t: any) => t.taskname === taskName);

      if (task?.newlink) {
        finalResult = { newlink: task.newlink, polls: i + 1, task_status: task.status };
        break;
      }

      // 如果任务状态是失败，停止等待
      if (task?.status === 'error' || task?.status === 3) {
        finalResult = { error: '任务执行失败', task_status: task.status, polls: i + 1 };
        break;
      }
    }

    return NextResponse.json({
      add_result: addJson,
      run_http_status: runRes.status,
      run_response: runText.slice(0, 200),
      poll_result: finalResult || { error: '超时未获得 newlink', polls: 30 },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

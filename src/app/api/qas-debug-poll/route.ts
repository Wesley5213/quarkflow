// GET /api/qas-debug-poll - 添加任务 -> 执行 -> 完整轮询日志
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const qasUrl = searchParams.get('qasUrl');
  const qasToken = searchParams.get('qasToken');
  const shareurl = searchParams.get('shareurl') || 'https://pan.quark.cn/s/9571008aefe8';
  const savepath = searchParams.get('savepath') || '/test';

  if (!qasUrl || !qasToken) {
    return NextResponse.json({ error: '缺少 qasUrl 或 qasToken' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const targetPath = `${savepath}/${today}`;
  const taskName = `POLLTEST_${Date.now()}`;
  const polls: any[] = [];

  try {
    // Step 1: 添加任务
    const addRes = await fetch(`${qasUrl}/api/add_task?token=${qasToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskname: taskName, shareurl, savepath: targetPath }),
    });
    const addJson = await addRes.json();

    // Step 2: 触发执行
    const runRes = await fetch(`${qasUrl}/run_script_now?token=${qasToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasklist: [{ taskname: taskName, shareurl, savepath: targetPath }],
      }),
    });
    const runText = await runRes.text();

    // Step 3: 轮询 20 次，每次 5 秒 = 最多 100 秒
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 5000));

      const dataRes = await fetch(`${qasUrl}/data?token=${qasToken}`);
      const dataJson = await dataRes.json();
      const taskList = dataJson.data?.tasklist || dataJson.tasklist || [];
      const task = taskList.find((t: any) => t.taskname === taskName);

      polls.push({
        poll: i + 1,
        time: new Date().toISOString(),
        task_found: !!task,
        newlink: task?.newlink || null,
        status: task?.status || null,
        all_keys: task ? Object.keys(task) : null,
      });

      if (task?.newlink) {
        return NextResponse.json({
          success: true,
          add_result: addJson,
          run_response: runText.slice(0, 300),
          newlink: task.newlink,
          total_polls: i + 1,
          polls,
        });
      }

      if (task?.status === 'error' || task?.status === 3) {
        return NextResponse.json({
          success: false,
          error: '任务执行失败',
          add_result: addJson,
          run_response: runText.slice(0, 300),
          task_status: task.status,
          total_polls: i + 1,
          polls,
        });
      }
    }

    // 超时
    const finalData = await fetch(`${qasUrl}/data?token=${qasToken}`).then(r => r.json());
    const finalTask = (finalData.data?.tasklist || finalData.tasklist || []).find((t: any) => t.taskname === taskName);

    return NextResponse.json({
      success: false,
      error: '轮询超时',
      timeout_after_polls: 20,
      final_task: finalTask || null,
      final_task_keys: finalTask ? Object.keys(finalTask) : null,
      final_newlink: finalTask?.newlink || null,
      polls,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

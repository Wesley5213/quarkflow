// GET /api/qas-debug-add - 直接测试 QAS add_task 返回什么
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

  try {
    // 测试添加任务
    const taskName = `DEBUG_${Date.now()}`;
    const addRes = await fetch(`${qasUrl}/api/add_task?token=${qasToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskname: taskName,
        shareurl: shareurl,
        savepath: savepath,
      }),
    });

    const addText = await addRes.text();
    let addJson: any;
    try {
      addJson = JSON.parse(addText);
    } catch {
      return NextResponse.json({ add_raw: addText, http_status: addRes.status });
    }

    // 立即查询 /data 看任务是否进入队列
    await new Promise(r => setTimeout(r, 500));
    const dataRes = await fetch(`${qasUrl}/data?token=${qasToken}`);
    const dataText = await dataRes.text();
    let dataJson: any;
    try {
      dataJson = JSON.parse(dataText);
    } catch {
      return NextResponse.json({ add_result: addJson, data_raw: dataText });
    }

    // 找刚创建的任务
    const task = (dataJson.data?.tasklist || dataJson.tasklist || [])
      .find((t: any) => t.taskname === taskName);

    return NextResponse.json({
      add_result: addJson,
      add_http_status: addRes.status,
      data_http_status: dataRes.status,
      data_root_keys: Object.keys(dataJson),
      data_data_keys: dataJson.data ? Object.keys(dataJson.data) : null,
      tasklist_count: (dataJson.data?.tasklist || dataJson.tasklist || []).length,
      our_task: task || null,
      all_tasks: (dataJson.data?.tasklist || dataJson.tasklist || []).slice(0, 5),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

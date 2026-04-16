// GET /api/qas-debug - 查看 QAS /data 返回的原始结构
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const qasUrl = searchParams.get('qasUrl');
  const qasToken = searchParams.get('qasToken');

  if (!qasUrl || !qasToken) {
    return NextResponse.json({ error: '缺少 qasUrl 或 qasToken' }, { status: 400 });
  }

  try {
    const res = await fetch(`${qasUrl}/data?token=${qasToken}`);
    const text = await res.text();

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json({ raw: text, parse_error: true });
    }

    // 返回简化但完整的信息
    return NextResponse.json({
      http_status: res.status,
      raw_keys: Object.keys(json),
      tasklist_count: json.tasklist?.length || 0,
      tasklist_sample: (json.tasklist || []).slice(0, 3).map((t: any) => ({
        taskname: t.taskname,
        newlink: t.newlink,
        status: t.status,
        savepath: t.savepath,
        shareurl: t.shareurl,
        all_keys: Object.keys(t),
      })),
      version: json.version,
      nickname: json.nickname,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

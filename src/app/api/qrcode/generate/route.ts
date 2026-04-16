// POST /api/qrcode/generate - 生成二维码（已停用，恢复 QAS 后不再需要）
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: '扫码登录已停用，请使用 QAS 模式' }, { status: 410 });
}

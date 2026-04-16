// POST /api/qrcode/check - 扫码状态（已停用，恢复 QAS 后不再需要）
import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: '扫码登录已停用，请使用 QAS 模式' }, { status: 410 });
}

// POST /api/status - 服务状态检测
import { NextRequest, NextResponse } from 'next/server';
import { testDeepSeekConnection } from '@/lib/deepseek';
import { testQuarkCookie } from '@/lib/quark-direct';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const deepseekKey: string = body.deepseekKey || '';
  const quarkCookie: string = body.quarkCookie || '';

  const result: Record<string, { status: string; [key: string]: string }> = {
    deepseek: { status: 'not_configured', model: '' },
    quark: { status: 'not_configured', nickname: '' },
  };

  if (deepseekKey) {
    try {
      result.deepseek = await testDeepSeekConnection(deepseekKey);
    } catch (e) {
      result.deepseek = {
        status: 'error',
        model: `连接失败: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  if (quarkCookie) {
    try {
      const info = await testQuarkCookie(quarkCookie);
      result.quark = { status: 'ok', nickname: info.nickname };
    } catch (e) {
      result.quark = {
        status: 'error',
        nickname: `Cookie 无效: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  return NextResponse.json(result);
}

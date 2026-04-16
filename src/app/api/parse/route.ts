// POST /api/parse - 输入解析接口
import { NextRequest, NextResponse } from 'next/server';
import { parseText } from '@/lib/parser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { raw_text } = body;

    if (!raw_text || typeof raw_text !== 'string') {
      return NextResponse.json(
        { error: '缺少 raw_text 参数' },
        { status: 400 }
      );
    }

    const result = parseText(raw_text);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Parse error:', error);
    return NextResponse.json(
      { error: '解析失败' },
      { status: 500 }
    );
  }
}

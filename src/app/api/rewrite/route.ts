// POST /api/rewrite - 文案改写接口
import { NextRequest, NextResponse } from 'next/server';
import { rewriteText, RewriteStyle } from '@/lib/deepseek';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, style, links, deepseekKey } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '缺少 text 参数' },
        { status: 400 }
      );
    }

    if (!deepseekKey) {
      return NextResponse.json(
        { error: '未配置 DeepSeek API Key' },
        { status: 400 }
      );
    }

    const validStyles: RewriteStyle[] = ['default', 'casual', 'suspense', 'structured'];
    const selectedStyle: RewriteStyle = validStyles.includes(style) ? style : 'default';

    // 使用流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let accumulated = '';
          const result = await rewriteText(
            deepseekKey,
            { text, style: selectedStyle, links: links || [] },
            (delta) => {
              accumulated += delta;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: accumulated })}\n`)
              );
            }
          );
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', full_text: result })}\n`)
          );
          controller.enqueue(encoder.encode('data: [DONE]\n'));
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: String(error) })}\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Rewrite error:', error);
    return NextResponse.json(
      { error: '改写失败' },
      { status: 500 }
    );
  }
}

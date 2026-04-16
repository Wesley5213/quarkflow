// POST /api/save - 夸克网盘转存接口（直连模式）
import { NextRequest, NextResponse } from 'next/server';
import { saveAndShareDirect } from '@/lib/quark-direct';

export const preferredRegion = ['hkg1', 'sin1'];
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { links, save_path, quarkCookie } = body;

    if (!links || !Array.isArray(links) || links.length === 0) {
      return NextResponse.json({ error: '缺少 links 参数或格式错误' }, { status: 400 });
    }

    if (!quarkCookie) {
      return NextResponse.json({ error: '未配置夸克 Cookie，请在设置中填写' }, { status: 400 });
    }

    const savePath = save_path || '/QuarkFlow转存';
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n`));

        try {
          console.log('[save] starting, links:', links, 'savePath:', savePath, 'cookieLen:', quarkCookie.length);
          const linkMap = await saveAndShareDirect({
            links,
            savePath,
            cookie: quarkCookie,
            onProgress: (info) => {
              console.log(`[save] progress [${info.step}]: ${info.message}`);
              send({ type: 'progress', link_index: info.linkIndex, step: info.step, message: info.message });
            },
          });
          console.log('[save] linkMap:', linkMap);

          let idx = 0;
          for (const [original, newLink] of Object.entries(linkMap)) {
            send({ type: 'link_done', link_index: idx++, original, new_link: newLink });
          }

          send({ type: 'all_done', link_map: linkMap });
          controller.enqueue(encoder.encode('data: [DONE]\n'));
          controller.close();
        } catch (error) {
          send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
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
    return NextResponse.json({ error: '转存失败' }, { status: 500 });
  }
}

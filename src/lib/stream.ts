/**
 * 带行缓冲的 SSE 流读取器。
 * 解决跨 reader.read() 调用的 JSON 行截断问题。
 */
export async function readSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (data: unknown) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let lineBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    lineBuffer += decoder.decode(value, { stream: true });
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]' || data === '') continue;
      try {
        onEvent(JSON.parse(data));
      } catch {
        // 忽略不完整或无效的 JSON
      }
    }
  }
}

// DeepSeek API 封装

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export type RewriteStyle = 'default' | 'casual' | 'suspense' | 'structured';

const PROMPTS: Record<RewriteStyle, string> = {
  default: '保持原文风格，用完全不同的表达方式重新写一遍，保留核心卖点。',
  casual: '用口语化、种草风格改写，像在朋友圈分享个人体验一样，带点情绪和感叹。',
  suspense: '用悬念和钩子风格改写，制造好奇心和紧迫感，让人忍不住点开。',
  structured: '用干货总结风格改写，结构清晰、逻辑分明，适合知识分享。',
};

export interface RewriteOptions {
  text: string;
  style: RewriteStyle;
  links: { placeholder: string; original: string }[];
}

export async function rewriteText(
  apiKey: string,
  options: RewriteOptions,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const { text, style, links } = options;

  const prompt = `你是一个社交媒体文案改写专家。请对以下推广文案进行二次创作：

要求：
1. 保留原文提到的资源名称、核心卖点
2. 完全更换表达方式和句式，不能有任何原文直接复制的句子
3. 保持相近的文案长度（±20%）
4. 文案中的 [链接N] 占位符必须原样保留，不要修改
5. 风格：${PROMPTS[style]}
6. 直接输出改写后的文案，不要任何解释和前缀

原文案：
${text}`;

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 2000,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API 错误: ${response.status} - ${err}`);
  }

  // 流式读取响应
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法读取响应流');
  }

  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter((l: string) => l.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') break;
      try {
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content || '';
        if (content) {
          result += content;
          onChunk?.(content);
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  }

  return result;
}

export async function testDeepSeekConnection(apiKey: string): Promise<{ status: string; model: string }> {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API 错误: ${response.status}`);
  }

  return { status: 'ok', model: 'deepseek-chat' };
}

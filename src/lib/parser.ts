// 夸克网盘链接解析工具

export interface ParsedLink {
  original: string;
  placeholder: string;
  position: number;
}

export interface ParseResult {
  textWithoutLinks: string;
  links: ParsedLink[];
  linkCount: number;
}

// 夸克网盘链接正则
export const QUARK_LINK_REGEX = /https?:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9]+/g;

export function parseText(text: string): ParseResult {
  const matches = [...text.matchAll(QUARK_LINK_REGEX)];
  
  const links: ParsedLink[] = matches.map((match, index) => ({
    original: match[0],
    placeholder: `[链接${index + 1}]`,
    position: match.index || 0,
  }));

  // 将链接替换为占位符
  let textWithoutLinks = text;
  links.forEach(link => {
    textWithoutLinks = textWithoutLinks.replace(link.original, link.placeholder);
  });

  return {
    textWithoutLinks,
    links,
    linkCount: links.length,
  };
}

export function replacePlaceholders(
  text: string,
  links: ParsedLink[],
  linkMap: Record<string, string>
): string {
  let result = text;
  links.forEach(link => {
    const newLink = linkMap[link.original] || link.original;
    result = result.split(link.placeholder).join(newLink);
  });
  return result;
}

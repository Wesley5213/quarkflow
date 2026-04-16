// 配置管理

export interface AppConfig {
  deepseekKey: string;
  quarkCookie: string;  // 夸克网盘 Cookie，用于直连 API 转存+分享
  savePath: string;
  // QAS 兼容字段（保留但不再使用）
  qasUrl: string;
  qasToken: string;
}

const CONFIG_KEY = 'quarkflow_config';

export const defaultConfig: AppConfig = {
  deepseekKey: '',
  quarkCookie: '',
  savePath: '/QuarkFlow转存',
  qasUrl: '',
  qasToken: '',
};

export function getConfig(): AppConfig {
  if (typeof window === 'undefined') {
    return defaultConfig;
  }
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      return { ...defaultConfig, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return defaultConfig;
}

export function saveConfig(config: Partial<AppConfig>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

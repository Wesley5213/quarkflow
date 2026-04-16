# QuarkFlow — 夸克网盘一键转存 & 文案二创工具

## 产品概述

QuarkFlow 是一款高效的夸克网盘推广助手，帮助用户一键完成「文案 AI 改写 + 网盘文件转存 + 新分享链接生成」，大幅提升推广效率。

## 功能特性

- **M1: 输入解析** - 自动识别粘贴文案中的夸克网盘链接
- **M2: 文案改写** - 调用 DeepSeek API 进行 AI 文案二创，支持多种风格
- **M3: 网盘转存** - 调用夸克官方 API 直接转存文件，生成新分享链接
- **M4: 输出合成** - 新文案 + 新链接自动拼接，一键复制
- **M5: 配置管理** - 集中管理 API Key 和服务配置

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.local.example` 为 `.env.local`，填入你的 API Key：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEFAULT_SAVE_PATH=/QuarkFlow转存
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 4. 获取夸克 Cookie

在 QuarkFlow 设置页面使用「Cookie 提取助手」，从 pan.quark.cn 获取 Cookie 并填入设置。

## 技术栈

- **前端**: Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **AI**: DeepSeek API (deepseek-chat)
- **字体**: Outfit + JetBrains Mono

## 项目结构

```
quarkflow/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── parse/route.ts    # 输入解析
│   │   │   ├── rewrite/route.ts  # 文案改写
│   │   │   ├── save/route.ts     # 网盘转存
│   │   │   └── status/route.ts   # 状态检测
│   │   ├── settings/page.tsx      # 设置页面
│   │   ├── page.tsx              # 主页面
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── InputPanel.tsx        # 左侧输入面板
│   │   ├── OutputPanel.tsx        # 右侧输出面板
│   │   ├── LogPanel.tsx          # 底部日志面板
│   │   ├── StyleSelector.tsx     # 改写风格选择
│   │   └── SettingsForm.tsx      # 设置表单
│   └── lib/
│       ├── config.ts             # 配置管理
│       ├── parser.ts             # 链接解析
│       ├── deepseek.ts           # DeepSeek API
│       ├── quark-direct.ts        # 夸克直连 API
│       └── stream.ts             # SSE 流式处理
├── .env.local.example
├── package.json
└── README.md
```

## 改写风格

| 风格 | 说明 | 适用场景 |
|------|------|---------|
| 默认改写 | 保持原风格，换一种说法 | 通用 |
| 口语种草 | 更口语化，加入个人体验感 | 小红书、朋友圈 |
| 悬念钩子 | 强化好奇心和紧迫感 | X/Twitter、微博 |
| 干货总结 | 更理性、结构化 | 知识分享类 |

## 模式说明

- **完整模式**: 文案改写 + 转存 + 生成链接，全流程
- **仅转存**: 不改写文案，只转存文件并替换链接

## License

MIT

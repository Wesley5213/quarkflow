// 夸克网盘直连 API 客户端（替代 QAS，直接转存并生成分享链接）

const BASE_PC = 'https://drive-pc.quark.cn';
const BASE_DRIVE = 'https://drive.quark.cn';

function buildHeaders(cookie: string, referer = 'https://pan.quark.cn/'): Record<string, string> {
  return {
    'Cookie': cookie,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Referer': referer,
    'Origin': 'https://pan.quark.cn',
    'Sec-Fetch-Site': 'same-site',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
  };
}

// 从夸克分享链接中提取 pwd_id 和 passcode
export function extractPwdId(link: string): { pwdId: string; passcode: string } {
  // 格式: https://pan.quark.cn/s/XXXXXXXX 或 https://pan.quark.cn/s/XXXXXXXX?pwd=XXXX
  const match = link.match(/pan\.quark\.cn\/s\/([a-zA-Z0-9]+)/);
  if (!match) throw new Error(`无效的夸克分享链接: ${link}`);
  const pwdId = match[1];
  const passcodeMatch = link.match(/[?&]pwd=([^&]+)/);
  const passcode = passcodeMatch ? passcodeMatch[1] : '';
  return { pwdId, passcode };
}

// 访问分享页面初始化 session，返回合并后的 cookie 字符串
async function initShareSession(pwdId: string, cookie: string): Promise<string> {
  try {
    const res = await fetch(`https://pan.quark.cn/s/${pwdId}`, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      redirect: 'follow',
    });
    // 合并 Set-Cookie 到现有 cookie
    const setCookies = res.headers.getSetCookie?.() ?? [];
    if (setCookies.length === 0) return cookie;

    // 解析新 cookie，覆盖旧的同名项
    const cookieMap: Record<string, string> = {};
    cookie.split(';').forEach(c => {
      const [k, ...vs] = c.trim().split('=');
      if (k) cookieMap[k.trim()] = vs.join('=');
    });
    setCookies.forEach(sc => {
      const part = sc.split(';')[0];
      const [k, ...vs] = part.split('=');
      if (k) cookieMap[k.trim()] = vs.join('=');
    });
    const merged = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
    console.log(`[initShareSession] merged ${setCookies.length} new cookies`);
    return merged;
  } catch (e) {
    console.warn('[initShareSession] failed, using original cookie:', e);
    return cookie;
  }
}

// 从 cookie 中解析用户 UID（__pus 或 __puus 中可能编码了 uid）
function extractUidFromCookie(cookie: string): string {
  // 尝试从 __pus 中解析（Quark 的 __pus 可能含有 uid 信息）
  const m = cookie.match(/__pus=([^;]+)/);
  if (!m) return '';
  const val = decodeURIComponent(m[1]);
  // 可能是 base64 编码的 JSON
  for (const enc of ['base64url', 'base64'] as const) {
    try {
      const decoded = Buffer.from(val, enc).toString('utf-8');
      const data = JSON.parse(decoded) as Record<string, unknown>;
      const uid = data['uid'] ?? data['user_id'] ?? data['userId'];
      if (uid) return String(uid);
    } catch { /* ignore */ }
  }
  // 可能是 JWT 格式
  try {
    const parts = val.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as Record<string, unknown>;
      const uid = payload['uid'] ?? payload['sub'] ?? payload['user_id'];
      if (uid) return String(uid);
    }
  } catch { /* ignore */ }
  return '';
}

// 获取用户 UID（save 接口需要）
async function getUserUid(cookie: string): Promise<string> {
  // 先尝试从 cookie 解析
  const cookieUid = extractUidFromCookie(cookie);
  if (cookieUid) {
    console.log('[getUserUid] from cookie:', cookieUid);
    return cookieUid;
  }
  // 备选：API 查询
  try {
    const res = await fetch(`${BASE_PC}/1/clouddrive/config?pr=ucpro&fr=pc`, {
      headers: buildHeaders(cookie),
    });
    if (!res.ok) return '';
    const text = await res.text();
    console.log('[getUserUid] config response:', text.slice(0, 300));
    const json = JSON.parse(text) as Record<string, Record<string, unknown>>;
    const data = json['data'] ?? {};
    const uid = data['user_id'] ?? data['uid'] ?? data['userId'];
    return uid ? String(uid) : '';
  } catch { return ''; }
}

// 获取分享 stoken
async function getStoken(pwdId: string, passcode: string, cookie: string): Promise<string> {
  const url = `${BASE_PC}/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc`;
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(cookie, `https://pan.quark.cn/s/${pwdId}`),
    body: JSON.stringify({ pwd_id: pwdId, passcode }),
  });
  if (!res.ok) throw new Error(`获取 stoken 失败: ${res.status}`);
  const json = await res.json();
  if (json.status !== 200 && json.code !== 0) {
    throw new Error(`获取 stoken 错误: ${json.message || JSON.stringify(json)}`);
  }
  const stoken = json.data?.stoken;
  if (!stoken) throw new Error('stoken 为空，可能链接已失效或需要密码');
  return stoken;
}

// 获取分享文件列表（取第一页所有文件 fid + share_fid_token）
async function getShareFiles(
  pwdId: string,
  stoken: string,
  cookie: string
): Promise<Array<{ fid: string; file_name: string; token: string }>> {
  const url = `${BASE_PC}/1/clouddrive/share/sharepage/detail?pr=ucpro&fr=pc&pwd_id=${pwdId}&stoken=${encodeURIComponent(stoken)}&pdir_fid=0&force=0&_page=1&_size=50&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc`;
  const res = await fetch(url, { headers: buildHeaders(cookie) });
  if (!res.ok) throw new Error(`获取文件列表失败: ${res.status}`);
  const json = await res.json();
  if (json.status !== 200 && json.code !== 0) {
    throw new Error(`获取文件列表错误: ${json.message || JSON.stringify(json)}`);
  }
  const list = json.data?.list ?? [];
  return list.map((f: { fid: string; file_name: string; share_fid_token?: string }) => ({
    fid: f.fid,
    file_name: f.file_name,
    token: f.share_fid_token ?? '',
  }));
}

// 获取用户根目录 fid
async function getRootFid(cookie: string): Promise<string> {
  const url = `${BASE_PC}/1/clouddrive/file/sort?pr=ucpro&fr=pc&pdir_fid=0&_page=1&_size=1&_fetch_total=0&_fetch_sub_dirs=1&_sort=file_type:asc,updated_at:desc`;
  const res = await fetch(url, { headers: buildHeaders(cookie) });
  if (!res.ok) throw new Error(`获取根目录失败: ${res.status}`);
  // 根目录 fid 就是 "0"
  return '0';
}

// 创建目录（递归创建路径，返回末级 fid）
async function createFolder(path: string, cookie: string): Promise<string> {
  const parts = path.split('/').filter(Boolean);
  let parentFid = '0';

  for (const part of parts) {
    const url = `${BASE_PC}/1/clouddrive/file?pr=ucpro&fr=pc`;
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(cookie),
      body: JSON.stringify({
        pdir_fid: parentFid,
        file_name: part,
        dir_path: '',
        dir_init_lock: false,
      }),
    });

    let fid: string | undefined;

    if (res.ok) {
      const json = await res.json();
      fid = json.data?.fid;
    }
    // 400/409 通常表示目录已存在，尝试查找已有目录
    if (!fid) {
      const existing = await findFolder(parentFid, part, cookie);
      if (existing) {
        parentFid = existing;
        continue;
      }
      const status = res.ok ? 'no-fid' : res.status;
      throw new Error(`创建目录 "${part}" 失败 (${status})`);
    }
    parentFid = fid;
  }

  return parentFid;
}

// 在指定父目录中查找同名文件夹，返回 fid 或 null
async function findFolder(parentFid: string, name: string, cookie: string): Promise<string | null> {
  const url = `${BASE_PC}/1/clouddrive/file/sort?pr=ucpro&fr=pc&pdir_fid=${parentFid}&_page=1&_size=100&_fetch_total=0&_fetch_sub_dirs=1&_sort=file_type:asc,updated_at:desc`;
  const res = await fetch(url, { headers: buildHeaders(cookie) });
  if (!res.ok) return null;
  const json = await res.json();
  const list = json.data?.list ?? [];
  const found = list.find((f: { file_name: string; fid: string; file_type: number }) =>
    f.file_name === name && f.file_type === 0
  );
  return found?.fid ?? null;
}

// 转存文件到指定目录，返回 task_id
async function saveFiles(
  pwdId: string,
  stoken: string,
  fidList: string[],
  fidTokenList: string[],
  targetFid: string,
  cookie: string
): Promise<string> {
  const shareReferer = `https://pan.quark.cn/s/${pwdId}`;
  const __dt = Math.floor(Math.random() * 9400 + 600);
  const __t = Date.now();
  const url = `${BASE_PC}/1/clouddrive/share/sharepage/save?pr=ucpro&fr=pc&uc_param_str=&__dt=${__dt}&__t=${__t}`;
  const body = {
    fid_list: fidList,
    fid_token_list: fidTokenList,
    to_pdir_fid: targetFid,
    pwd_id: pwdId,
    stoken,
    pdir_fid: '0',
    scene: 'link',
  };
  console.log('[saveFiles] fid_list:', fidList, 'fid_token_list:', fidTokenList);
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(cookie, shareReferer),
    body: JSON.stringify(body),
  });
  const bodyText = await res.text();
  console.log(`[saveFiles] status=${res.status} body:`, bodyText.slice(0, 500));
  if (!res.ok) throw new Error(`转存文件失败: ${res.status} - ${bodyText.slice(0, 200)}`);
  const json = JSON.parse(bodyText);
  if (json.status !== 200 && json.code !== 0) {
    throw new Error(`转存文件错误: ${json.message || JSON.stringify(json)}`);
  }
  const taskId = json.data?.task_id;
  if (!taskId) throw new Error(`未获得 task_id，响应: ${JSON.stringify(json.data).slice(0, 200)}`);
  return taskId;
}

// 轮询任务状态直到完成
async function waitForTask(taskId: string, cookie: string, maxAttempts = 20): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const __dt = Math.floor(Math.random() * 9400 + 600);
    const __t = Date.now();
    const url = `${BASE_PC}/1/clouddrive/task?pr=ucpro&fr=pc&task_id=${taskId}&retry_index=${i}&__dt=${__dt}&__t=${__t}`;
    try {
      const res = await fetch(url, { headers: buildHeaders(cookie) });
      if (!res.ok) { await new Promise(r => setTimeout(r, 500)); continue; }
      const json = await res.json();
      console.log(`[waitForTask] attempt=${i}:`, JSON.stringify(json).slice(0, 300));
      const status = json.data?.status;
      if (status === 2 || status === '2') return;
    } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('任务超时');
}

// 列出指定目录下的文件，返回 fid 列表
async function listFolder(
  folderFid: string,
  cookie: string
): Promise<Array<{ fid: string; file_name: string }>> {
  const url = `${BASE_PC}/1/clouddrive/file/sort?pr=ucpro&fr=pc&pdir_fid=${folderFid}&_page=1&_size=100&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc`;
  const res = await fetch(url, { headers: buildHeaders(cookie) });
  if (!res.ok) throw new Error(`列出目录失败: ${res.status}`);
  const json = await res.json();
  const list = json.data?.list ?? [];
  return list.map((f: { fid: string; file_name: string }) => ({ fid: f.fid, file_name: f.file_name }));
}

// 创建分享链接，返回 API 原始 data
async function createShareRaw(
  fidList: string[],
  cookie: string,
  expiredType = 4  // 1=1天 2=7天 3=30天 4=永久
): Promise<Record<string, unknown>> {
  const __dt = Math.floor(Math.random() * 9400 + 600);
  const __t = Date.now();
  const url = `${BASE_PC}/1/clouddrive/share?pr=ucpro&fr=pc&__dt=${__dt}&__t=${__t}`;
  const body = {
    fid_list: fidList,
    title: '',
    url_type: 1,
    expired_type: expiredType,
    passcode_type: 0,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(cookie),
    body: JSON.stringify(body),
  });
  const bodyText = await res.text();
  console.log('[createShare] status:', res.status, 'body:', bodyText.slice(0, 800));
  if (!res.ok) throw new Error(`创建分享失败: ${res.status} - ${bodyText.slice(0, 200)}`);
  const json = JSON.parse(bodyText);
  if (json.status !== 200 && json.code !== 0) {
    throw new Error(`创建分享错误: ${json.message || JSON.stringify(json)}`);
  }
  return (json.data ?? {}) as Record<string, unknown>;
}

// 用 share_id 调 /share/password 获取真正的分享短链接
async function getShareUrlByShareId(shareId: string, cookie: string): Promise<string> {
  const url = `${BASE_PC}/1/clouddrive/share/password?pr=ucpro&fr=pc`;
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(cookie),
    body: JSON.stringify({ share_id: shareId }),
  });
  if (!res.ok) throw new Error(`获取分享链接失败: ${res.status}`);
  const json = await res.json();
  console.log('[getShareUrl] response:', JSON.stringify(json.data).slice(0, 300));
  const shareUrl = json.data?.share_url;
  if (!shareUrl) throw new Error(`未获得 share_url: ${JSON.stringify(json.data).slice(0, 200)}`);
  const passcode = json.data?.passcode;
  return passcode ? `${shareUrl}?pwd=${passcode}` : shareUrl;
}

// 创建分享并获取最终 URL（三步：创建任务 → 轮询拿 share_id → 用 share_id 换短链接）
async function createAndGetShareUrl(
  fidList: string[],
  cookie: string,
  expiredType: number,
  progress: (step: string, message: string) => void
): Promise<string> {
  // 第一步：提交创建分享任务
  const result = await createShareRaw(fidList, cookie, expiredType);
  if (result.share_url) return String(result.share_url);

  const taskId = result.task_id as string;
  if (!taskId) throw new Error(`未获得分享任务: ${JSON.stringify(result).slice(0, 200)}`);

  // 第二步：轮询任务拿到 share_id
  progress('share', `分享任务已提交，等待完成...`);
  let shareId = '';
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    const __dt = Math.floor(Math.random() * 9400 + 600);
    const __t = Date.now();
    const url = `${BASE_PC}/1/clouddrive/task?pr=ucpro&fr=pc&task_id=${taskId}&retry_index=${i}&__dt=${__dt}&__t=${__t}`;
    try {
      const res = await fetch(url, { headers: buildHeaders(cookie) });
      if (!res.ok) continue;
      const json = await res.json();
      console.log(`[shareTask] attempt=${i}:`, JSON.stringify(json).slice(0, 500));
      const data = json.data ?? {};
      const status = data.status;
      if (status === 2 || status === '2') {
        shareId = data.share_id ?? '';
        break;
      }
    } catch { /* ignore */ }
  }
  if (!shareId) throw new Error('分享任务超时或未返回 share_id');

  // 第三步：用 share_id 换取真正的分享短链接
  progress('share', `获取分享链接...`);
  return await getShareUrlByShareId(shareId, cookie);
}

export interface DirectSaveOptions {
  links: string[];
  savePath: string;
  cookie: string;
  onProgress?: (info: { linkIndex: number; step: string; message: string }) => void;
}

// 主函数：批量转存并生成分享链接
export async function saveAndShareDirect(
  options: DirectSaveOptions
): Promise<Record<string, string>> {
  const { links, savePath, cookie, onProgress } = options;
  const linkMap: Record<string, string> = {};
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const progress = (step: string, message: string) =>
      onProgress?.({ linkIndex: i, step, message });

    try {
      progress('parse', `解析链接 ${i + 1}/${links.length}...`);
      const { pwdId, passcode } = extractPwdId(link);

      // 用 sessionCookie（含分享页 session）来访问分享资源
      // 用原始 cookie 来操作用户自己的网盘（写操作），避免分享页 cookie 污染认证
      progress('stoken', `初始化分享会话...`);
      const sessionCookie = await initShareSession(pwdId, cookie);

      progress('stoken', `获取访问令牌...`);
      const stoken = await getStoken(pwdId, passcode, sessionCookie);

      progress('files', `获取文件列表...`);
      const files = await getShareFiles(pwdId, stoken, sessionCookie);
      if (files.length === 0) throw new Error('分享文件列表为空');
      progress('files', `找到 ${files.length} 个文件`);

      // 创建唯一子目录：savePath/日期/时间戳（用原始 cookie，操作自己的网盘）
      const timestamp = Date.now();
      const uniquePath = `${savePath}/${today}/${timestamp}`;
      progress('mkdir', `创建目录: ${uniquePath}`);
      const targetFid = await createFolder(uniquePath, cookie);
      progress('mkdir', `目录创建成功 (fid: ${targetFid})`);

      progress('save', `转存 ${files.length} 个文件...`);
      const fidList = files.map(f => f.fid);
      const fidTokenList = files.map(f => f.token);
      const taskId = await saveFiles(pwdId, stoken, fidList, fidTokenList, targetFid, cookie);
      progress('save', `任务已提交 (task_id: ${taskId})`);

      // 等待转存完成：先尝试轮询任务，超时则直接检查文件夹
      progress('wait', `等待转存完成...`);
      try {
        await waitForTask(taskId, cookie);
      } catch {
        progress('wait', `任务轮询超时，检查文件夹是否已有文件...`);
      }

      // 等一下确保文件落盘，然后直接分享整个文件夹（文件夹 fid 稳定，不受任务状态影响）
      await new Promise(r => setTimeout(r, 3000));
      progress('share', `生成永久分享链接...`);
      const shareUrl = await createAndGetShareUrl([targetFid], cookie, 4, progress);

      linkMap[link] = shareUrl;
      progress('done', `链接 ${i + 1}/${links.length} 完成: ${shareUrl}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      progress('error', `链接 ${i + 1} 失败: ${msg}`);
      linkMap[link] = link; // 失败时保留原链接
    }
  }

  return linkMap;
}

// 验证 Cookie 有效性，返回昵称
export async function testQuarkCookie(cookie: string): Promise<{ nickname: string }> {
  // 优先用 drive-pc API 验证（会返回用户信息）
  try {
    const res = await fetch(`${BASE_PC}/1/clouddrive/config?pr=ucpro&fr=pc`, {
      headers: buildHeaders(cookie),
    });
    if (res.ok) {
      const json = await res.json();
      // 登录失效时 status=401
      if (json.status === 401 || json.code === 401) {
        throw new Error('Cookie 已失效，请重新提取');
      }
      if (json.status === 200 || json.code === 0) {
        const nickname = json.data?.nickname ?? json.data?.user?.nickname ?? '';
        return { nickname: nickname || '已登录' };
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('失效')) throw e;
    // 忽略此端点错误，尝试备用
  }

  // 备用：pan.quark.cn/account/info
  const res = await fetch('https://pan.quark.cn/account/info', {
    headers: buildHeaders(cookie),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  // success:true / code:'OK' 说明 Cookie 有效，即使 data 为空
  if (json.success === true || json.code === 'OK') {
    const nickname =
      json.data?.nickname ??
      json.data?.member_info?.nickname ??
      json.nickname ??
      '已登录';
    return { nickname };
  }

  throw new Error(`Cookie 无效: ${json.message || JSON.stringify(json).slice(0, 100)}`);
}

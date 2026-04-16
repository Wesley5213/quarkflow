// 已停用 - 恢复 QAS 模式后不再需要此页面
export default function CookieHelperPage() {
  return (
    <div style={{ padding: '2rem', color: '#fff', background: '#0f172a', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#f97316', fontSize: '1.5rem', marginBottom: '1rem' }}>⚠️ 页面已停用</h1>
      <p style={{ color: '#94a3b8', lineHeight: 1.8 }}>
        Cookie 助手已停用。请使用 QAS（quark-auto-save）模式进行转存。
      </p>
      <p style={{ color: '#94a3b8', lineHeight: 1.8, marginTop: '1rem' }}>
        在 QuarkFlow 设置页填入 QAS 服务地址和 Token 即可使用。
      </p>
    </div>
  );
}

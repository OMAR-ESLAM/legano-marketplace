const { requireAdmin, gh, enc, safePath, sha, BRANCH } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST فقط' });
  if (!(await requireAdmin(req, res))) return;
  const { path, contentBase64, message } = req.body || {};
  const p = safePath(path);
  if (!p) return res.status(400).json({ error: 'اسم أو مسار الملف غير مسموح' });
  if (typeof contentBase64 !== 'string' || !contentBase64 || contentBase64.length > 4.2e6) return res.status(400).json({ error: 'الملف فاضي أو أكبر من 3MB' });
  const s = await sha(p);
  const r = await gh(`contents/${enc(p)}`, { method: 'PUT', body: JSON.stringify({ message: String(message || `رفع ${p} من لوحة التحكم`).slice(0, 200), content: contentBase64, branch: BRANCH, ...(s ? { sha: s } : {}) }) });
  const d = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: d.message || 'فشل الرفع' });
  res.json({ ok: true, updated: !!s });
};

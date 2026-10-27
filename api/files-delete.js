const { requireAdmin, gh, enc, safePath, sha, BRANCH } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST فقط' });
  if (!(await requireAdmin(req, res))) return;
  const p = safePath((req.body || {}).path);
  if (!p) return res.status(400).json({ error: 'مسار غير مسموح' });
  const s = await sha(p);
  if (!s) return res.status(404).json({ error: 'الملف مش موجود' });
  const r = await gh(`contents/${enc(p)}`, { method: 'DELETE', body: JSON.stringify({ message: `حذف ${p} من لوحة التحكم`, sha: s, branch: BRANCH }) });
  const d = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: d.message || 'فشل الحذف' });
  res.json({ ok: true });
};

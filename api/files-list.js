const { requireAdmin, gh, enc, BRANCH } = require('./_lib');
module.exports = async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const dir = String(req.query.dir || '').replace(/^\/+|\/+$/g, '');
  if (dir.includes('..')) return res.status(400).json({ error: 'مسار غير صالح' });
  const r = await gh(`contents/${dir ? enc(dir) : ''}?ref=${BRANCH}`);
  const d = await r.json();
  if (!r.ok || !Array.isArray(d)) return res.status(r.status || 500).json({ error: (d && d.message) || 'تعذر قراءة الملفات' });
  res.json({ files: d.map(f => ({ name: f.name, path: f.path, type: f.type, size: f.size, download_url: f.download_url })) });
};

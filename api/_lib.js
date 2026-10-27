// أدوات مشتركة لدوال رفع الملفات. الملفات اللي بتبدأ بـ _ مش بتتحول لـ endpoint.
const SU = 'https://qlboprdqnjvsmcwfpjwl.supabase.co';
const SK = 'sb_publishable_i-9FiXSNKe5xf_mEawmEfQ_PjSjf2_i';
const REPO = process.env.GITHUB_REPO || 'OMAR-ESLAM/legano-marketplace';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

// بيتأكد إن اللي بيكلّم الدالة أدمن فعلاً في Supabase (بتوكن الجلسة، مش باسورد ثابت)
async function requireAdmin(req, res) {
  const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) { res.status(401).json({ error: 'سجّل دخول الأول' }); return false; }
  try {
    const r = await fetch(`${SU}/rest/v1/rpc/is_admin`, { method: 'POST', headers: { apikey: SK, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok || (await r.json()) !== true) { res.status(403).json({ error: 'مش مسموح' }); return false; }
    if (!process.env.GITHUB_TOKEN) { res.status(500).json({ error: 'GITHUB_TOKEN مش مضبوط في إعدادات Vercel' }); return false; }
    return true;
  } catch { res.status(502).json({ error: 'تعذر التحقق من الصلاحية' }); return false; }
}

function gh(path, opt = {}) {
  return fetch(`https://api.github.com/repos/${REPO}/${path}`, { ...opt, headers: {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'legano-admin', 'Content-Type': 'application/json' } });
}
const enc = p => p.split('/').map(encodeURIComponent).join('/');

// مسار آمن: من غير .. ولا مسارات مطلقة، ومحظور تعديل الدوال والإعدادات من اللوحة
function safePath(p) {
  p = String(p || '').replace(/^\/+/, '');
  if (!p || p.length > 200 || p.includes('..') || p.includes('\\') || p.includes('\0')) return null;
  if (/^(api\/|\.github\/|vercel\.json$|package(-lock)?\.json$)/i.test(p)) return null;
  return p;
}
async function sha(p) { const r = await gh(`contents/${enc(p)}?ref=${BRANCH}`); return r.ok ? (await r.json()).sha : null; }

module.exports = { requireAdmin, gh, enc, safePath, sha, BRANCH };

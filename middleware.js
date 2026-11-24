// قفل الموقع مؤقتاً قبل الإعلان. بيشتغل بس لو SITE_LOCKED=1 في متغيرات Vercel.
// صاحب الموقع بيفتح بالرابط: /?preview=<PREVIEW_KEY> (بيتحفظ في كوكي 30 يوم).
// مفتوح دايماً: إشعارات قاعدة البيانات (/api/push) والكرون (/api/consult-purge) والأيقونات.
export const config = { matcher: '/((?!_vercel/).*)' };

const OPEN = [/^\/api\/push$/, /^\/api\/consult-purge$/, /^\/icons\//, /^\/favicon/];
const PAGE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#0B1220"><title>Legano | قريباً</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;color:#fff;text-align:center;background:radial-gradient(circle at 85% 0,rgba(183,121,31,.5),transparent 55%),radial-gradient(circle at 0 100%,rgba(37,99,235,.3),transparent 50%),linear-gradient(140deg,#0B1220,#1b2a4a)}
main{max-width:420px}img{width:84px;height:84px;border-radius:22px;background:#fff;padding:10px;box-shadow:0 14px 40px rgba(0,0,0,.35)}h1{margin:20px 0 8px;font-size:1.8rem;font-weight:900;line-height:1.5}h1 em{font-style:normal;color:#fcd34d}p{margin:0;color:#cbd5e1;line-height:2}
.pill{display:inline-flex;align-items:center;gap:8px;margin-top:22px;padding:7px 16px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);font-size:13px;font-weight:700}.pill i{width:9px;height:9px;border-radius:50%;background:#fcd34d;animation:p 1.8s infinite}@keyframes p{70%{box-shadow:0 0 0 9px rgba(252,211,77,0)}0%{box-shadow:0 0 0 0 rgba(252,211,77,.7)}}</style></head>
<body><main><img src="/icons/icon-192.png" alt="Legano"><h1>سوق المحامين <em>قريباً</em></h1><p>بنجهّز آخر التفاصيل علشان نقدّملك تجربة أحسن. هنفتح الموقع رسمياً بكرة بإذن الله.</p><span class="pill"><i></i>جاري التجهيز للإطلاق</span></main></body></html>`;

function cookie(req, name) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function same(a, b) { if (!a || !b || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

export default function middleware(req) {
  if (process.env.SITE_LOCKED !== '1') return;
  const url = new URL(req.url), key = process.env.PREVIEW_KEY || '';
  if (OPEN.some(r => r.test(url.pathname))) return;
  if (key && same(cookie(req, 'lg_preview'), key)) return;
  if (key && same(url.searchParams.get('preview') || '', key)) {
    url.searchParams.delete('preview');
    return new Response(null, { status: 302, headers: { Location: url.pathname + url.search, 'Set-Cookie': 'lg_preview=' + encodeURIComponent(key) + '; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax', 'Cache-Control': 'no-store' } });
  }
  return new Response(PAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '86400', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}

// بيبعت إشعار دفع (Web Push) للمحامي (وللأدمن مع طلبات الشحن {topup}): طلب استشارة جديد ({consultation}) أو طلب مستند ({doc}) أو سؤال جديد في تخصصه ({question}).
// بيتنده من قاعدة البيانات (trigger + pg_net) وبيحتاج سر مشترك PUSH_SECRET.
// متغيرات Vercel المطلوبة: PUSH_SECRET و VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY (و VAPID_SUBJECT اختياري).
const crypto = require('crypto');
const SU = 'https://qlboprdqnjvsmcwfpjwl.supabase.co';
const SK = 'sb_publishable_i-9FiXSNKe5xf_mEawmEfQ_PjSjf2_i';

const CATS = { rent: 'إيجارات وعقارات', labor: 'عمالي', criminal: 'جنائي', family: 'أحوال شخصية', contracts: 'عقود وتحكيم', commercial: 'تجاري وشركات', other: 'قضايا متنوعة' };
function same(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
const rpc = (fn, body) => fetch(`${SU}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(6000) });

const T = (x, n) => String(x == null ? '' : x).slice(0, n);
const AD = {
  disp: (A, s) => ({ title: '⚠️ نزاع على استشارة: محتاج قرارك', body: `${T(A.client || 'موكل', 30)} مع ${T(A.lawyer || 'محامي', 40)} • ${Number(A.price) || 0} ج`, url: '/admin.html', tag: 'disp-' + (s && s.id), urgent: true }),
  vr: (A, s) => ({ title: '🪪 طلب توثيق جديد', body: `${T(A.lawyer || 'محامي', 40)} مستني مراجعة القيد`, url: '/admin.html', tag: 'vr-' + (s && s.id), urgent: true }),
  lawyer: (A, s) => ({ title: '👤 محامي جديد سجّل', body: T(A.lawyer || 'حساب جديد على المنصة', 60), url: '/admin.html', tag: 'law-' + (s && s.id), urgent: false }),
  rep: (A, s) => ({ title: '🚩 بلاغ جديد', body: 'فيه بلاغ على محتوى محتاج مراجعتك', url: '/admin.html', tag: 'rep-' + (s && s.id), urgent: false }),
  doc: (A, s) => ({ title: '📄 طلب مستند جديد', body: `${T(A.title || 'مستند', 50)} • ${Number(A.price) || 0} ج`, url: '/admin.html', tag: 'adoc-' + (s && s.id), urgent: false }),
  flag: (A, s) => ({ title: A.source === 'client_report' ? '🚩 موكل بلّغ عن تواصل برّه المنصة' : (A.suspended ? '⛔ محامي اتحظر تلقائي لمخالفة التواصل' : '⚠️ محامي خد إنذار لمحاولة تواصل برّه المنصة'), body: `${T(A.lawyer || 'محامي', 40)} • مخالفات: ${Number(A.violations) || 0}`, url: '/admin.html', tag: 'flag-' + (s && s.id), urgent: true }),
  ddisp: (A, s) => ({ title: '⚠️ نزاع على مستند: محتاج قرارك', body: `${T(A.title || 'مستند', 50)} • ${Number(A.price) || 0} ج`, url: '/admin.html', tag: 'ddisp-' + (s && s.id), urgent: true })
};
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const secret = process.env.PUSH_SECRET, pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!secret || !pub || !priv) return res.status(500).json({ error: 'not_configured' });
  if (!same(req.headers['x-push-secret'], secret)) return res.status(403).json({ error: 'forbidden' });
  const b = req.body || {}, isQ = typeof b.question === 'string', isD = typeof b.doc === 'string', isT = typeof b.topup === 'string', isA = ['new', 'confirmed', 'wd', 'disp', 'vr', 'lawyer', 'rep', 'doc', 'ddisp', 'flag'].includes(b.admin), id = isT ? b.topup : isA ? b.id : isD ? b.doc : isQ ? b.question : b.consultation;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'bad_id' });
  const webpush = require('web-push');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@legano.site', pub, priv);
  try {
    const r = isA ? await rpc('admin_push_targets', { p_secret: secret, p_kind: b.admin, p_id: id }) : isT ? await rpc('topup_push_targets', { p_secret: secret, p_id: id }) : isD ? await rpc('doc_push_targets', { p_secret: secret, p_order: id }) : isQ ? await rpc('push_targets_q', { p_secret: secret, p_question: id }) : await rpc('push_targets', { p_secret: secret, p_consultation: id });
    if (!r.ok) return res.status(502).json({ error: 'targets' });
    const subs = await r.json();
    let sent = 0, dropped = 0;
    await Promise.all((Array.isArray(subs) ? subs : []).map(async s => {
      const A = s.info || {}, payload = JSON.stringify(isA ? (AD[s.kind] ? AD[s.kind](A, s) : s.kind === 'wd' ? {
        title: '🏦 طلب سحب جديد: ' + (Number(A.amount) || 0) + ' ج',
        body: String(A.lawyer || 'محامي').slice(0, 40) + ' طلب يسحب أرباحه',
        url: '/admin.html', tag: 'wd-' + s.id, urgent: true
      } : s.kind === 'confirmed' ? {
        title: '✅ استشارة اتأكدت: حوّل للمحامي',
        body: `${String(A.lawyer || 'محامي').slice(0, 40)} • صافيه ${Number(A.net) || 0} ج`,
        url: '/admin.html', tag: 'cf-' + s.id, urgent: true
      } : {
        title: '⚖️ استشارة جديدة على المنصة',
        body: `${String(A.client || 'موكل').slice(0, 30)} مع ${String(A.lawyer || 'محامي').slice(0, 40)} • ${Number(A.price) || 0} ج${A.wallet ? ' (من المحفظة)' : ''}`,
        url: '/admin.html', tag: 'new-' + s.id, urgent: false
      }) : isT ? {
        title: '💰 طلب شحن جديد: ' + (Number(s.amount) || 0) + ' ج',
        body: 'راجع الإيصال من لوحة الأدمن ووافق',
        url: '/admin.html', tag: 'topup-' + s.id, urgent: true
      } : isD ? {
        title: '📄 طلب مستند جديد: ' + String(s.title || '').slice(0, 50),
        body: `${Number(s.price) || 0} ج، صافي ربحك ${Number(s.net) || 0} ج. اقبل الطلب الأول`,
        url: '/doc-orders.html', tag: 'doc-' + s.id, urgent: false
      } : isQ ? {
        title: '❓ سؤال جديد في تخصصك',
        body: `${CATS[s.category] || ''}: ${String(s.title || '').slice(0, 90)}`,
        url: '/qa/' + s.id, tag: 'qa-' + s.id, urgent: false
      } : {
        title: '⚖️ طلب استشارة جديد',
        body: `${String(s.name || 'موكل').slice(0, 40)} مستنيك دلوقتي، اضغط وردّ قبل ما الطلب يخلص`,
        url: '/consultations.html', tag: 'req-' + s.id, urgent: true
      });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 120, urgency: 'high' });
        sent++;
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) { dropped++; try { await rpc('push_drop', { p_secret: secret, p_endpoint: s.endpoint }); } catch {} }
      }
    }));
    res.status(200).json({ sent, dropped });
  } catch { res.status(500).json({ error: 'failed' }); }
};

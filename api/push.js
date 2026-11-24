// بيبعت إشعار دفع (Web Push) للمحامي: طلب استشارة جديد ({consultation}) أو طلب مستند ({doc}) أو سؤال جديد في تخصصه ({question}).
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

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const secret = process.env.PUSH_SECRET, pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!secret || !pub || !priv) return res.status(500).json({ error: 'not_configured' });
  if (!same(req.headers['x-push-secret'], secret)) return res.status(403).json({ error: 'forbidden' });
  const b = req.body || {}, isQ = typeof b.question === 'string', isD = typeof b.doc === 'string', id = isD ? b.doc : isQ ? b.question : b.consultation;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'bad_id' });
  const webpush = require('web-push');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@legano.site', pub, priv);
  try {
    const r = isD ? await rpc('doc_push_targets', { p_secret: secret, p_order: id }) : isQ ? await rpc('push_targets_q', { p_secret: secret, p_question: id }) : await rpc('push_targets', { p_secret: secret, p_consultation: id });
    if (!r.ok) return res.status(502).json({ error: 'targets' });
    const subs = await r.json();
    let sent = 0, dropped = 0;
    await Promise.all((Array.isArray(subs) ? subs : []).map(async s => {
      const payload = JSON.stringify(isD ? {
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

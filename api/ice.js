// خوادم الاتصال (ICE) للغرفة.
// 1) STUN مجاني دايماً.
// 2) لو متغيرات Cloudflare TURN مضبوطة في Vercel (CF_TURN_KEY_ID و CF_TURN_API_TOKEN) بنطلب بيانات دخول مؤقتة من Cloudflare.
// 3) لو عندك TURN تاني، حطّه في ICE_SERVERS بصيغة JSON.
// الـTURN بيحلّ حالات الشبكات المقفولة (موبايل/شركات) اللي الاتصال المباشر ما بينجحش فيها.
const STUN = { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] };
const TTL = 4 * 3600;            // عمر بيانات الدخول (ثواني): كفاية لأي استشارة
const REUSE_MS = 30 * 60 * 1000; // نعيد استخدام نفس البيانات 30 دقيقة عشان ما نكلّمش Cloudflare كل مرة
let cache = null;                // { at, servers }
const hits = new Map();          // حدّ بسيط للطلبات لكل IP (على مستوى النسخة)

function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 20;
}

async function cfTurn() {
  const id = process.env.CF_TURN_KEY_ID, tok = process.env.CF_TURN_API_TOKEN;
  if (!id || !tok) return [];
  if (cache && Date.now() - cache.at < REUSE_MS) return cache.servers;
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(id)}/credentials/generate-ice-servers`, {
      method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TTL }), signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) return cache ? cache.servers : [];
    const j = await r.json();
    let list = Array.isArray(j.iceServers) ? j.iceServers : (j.iceServers ? [j.iceServers] : []);
    // نشيل STUN بتاع Cloudflare المكرر (عندنا STUN فوق) ونسيب كل اللي فيه credential
    list = list.filter(s => s && s.credential && s.username);
    if (list.length) cache = { at: Date.now(), servers: list };
    return list;
  } catch { return cache ? cache.servers : []; }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (limited(ip)) { res.statusCode = 429; return res.end(JSON.stringify({ iceServers: [STUN] })); }
  let extra = [];
  try { if (process.env.ICE_SERVERS) { const j = JSON.parse(process.env.ICE_SERVERS); if (Array.isArray(j)) extra = j; } } catch {}
  const cf = await cfTurn();
  res.statusCode = 200;
  res.end(JSON.stringify({ iceServers: [STUN, ...cf, ...extra] }));
};

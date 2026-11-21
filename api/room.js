// غرفة الاستشارة. بتتأكد إن اللي بيطلب طرف حقيقي في الاستشارة وإن الاتنين وافقوا على التسجيل،
// وبعدين بتفتح الغرفة عند مزوّد الفيديو (Daily) وبترجّع رابط دخول خاص بالشخص ده.
// محتاجة متغيّرات بيئة في Vercel: DAILY_API_KEY و DAILY_DOMAIN (اسم الدومين اللي في Daily، من غير .daily.co).
const SU = 'https://qlboprdqnjvsmcwfpjwl.supabase.co';
const SK = 'sb_publishable_i-9FiXSNKe5xf_mEawmEfQ_PjSjf2_i';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const out = (res, code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };

async function rpc(fn, body, bearer) {
  const r = await fetch(`${SU}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SK, Authorization: 'Bearer ' + (bearer || SK), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('rpc ' + r.status);
  return r.json();
}
const daily = (path, opt = {}) => fetch('https://api.daily.co/v1' + path, { ...opt, headers: { Authorization: 'Bearer ' + process.env.DAILY_API_KEY, 'Content-Type': 'application/json', ...(opt.headers || {}) } });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return out(res, 405, { error: 'method' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const id = String(b.id || '');
    if (!UUID.test(id)) return out(res, 400, { error: 'bad_id' });
    let c, who;
    if (b.token) {
      who = 'client'; c = await rpc('consult_client_get', { p_token: String(b.token) });
      if (c && c.id !== id) c = null;
    } else {
      const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!bearer) return out(res, 401, { error: 'login' });
      who = 'lawyer'; c = await rpc('consult_lawyer_get', { p_id: id }, bearer);
    }
    if (!c) return out(res, 403, { error: 'not_party' });
    if (!['accepted', 'live'].includes(c.status)) return out(res, 409, { error: 'bad_status' });
    if (!c.client_consent || !c.lawyer_consent || !c.room_name) return out(res, 409, { error: 'consent_required' });
    if (!process.env.DAILY_API_KEY || !process.env.DAILY_DOMAIN) return out(res, 503, { error: 'provider_not_configured' });

    const exp = Math.floor(Date.now() / 1000) + 3 * 3600;
    const g = await daily('/rooms/' + encodeURIComponent(c.room_name));
    if (g.status === 404) {
      const mk = await daily('/rooms', { method: 'POST', body: JSON.stringify({ name: c.room_name, privacy: 'private', properties: { max_participants: 2, exp, enable_recording: 'cloud', enable_chat: true, enable_screenshare: true, eject_at_room_exp: true } }) });
      if (!mk.ok) return out(res, 502, { error: 'room_create_failed' });
    } else if (!g.ok) return out(res, 502, { error: 'provider_error' });
    const name = who === 'lawyer' ? 'المحامي' : (c.client_name || 'الموكل');
    const tk = await daily('/meeting-tokens', { method: 'POST', body: JSON.stringify({ properties: { room_name: c.room_name, user_name: name, is_owner: false, exp, start_cloud_recording: true } }) });
    if (!tk.ok) return out(res, 502, { error: 'token_failed' });
    const { token } = await tk.json();
    return out(res, 200, { url: `https://${process.env.DAILY_DOMAIN}.daily.co/${c.room_name}?t=${token}` });
  } catch (e) {
    return out(res, 500, { error: 'server' });
  }
};

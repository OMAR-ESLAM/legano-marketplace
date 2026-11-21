// مهمة مجدولة (Vercel Cron): بتمسح تسجيلات الفيديو والغرف عند المزوّد للاستشارات اللي فترة احتفاظها خلصت.
// محتاجة CRON_SECRET في Vercel بنفس قيمة السر المتسجّل في قاعدة البيانات (consult_settings.cron_secret).
const SU = 'https://qlboprdqnjvsmcwfpjwl.supabase.co';
const SK = 'sb_publishable_i-9FiXSNKe5xf_mEawmEfQ_PjSjf2_i';
const rpc = (fn, body) => fetch(`${SU}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const daily = (path, opt = {}) => fetch('https://api.daily.co/v1' + path, { ...opt, headers: { Authorization: 'Bearer ' + process.env.DAILY_API_KEY, ...(opt.headers || {}) } });

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  res.setHeader('Cache-Control', 'no-store');
  if (!secret || got !== secret) { res.statusCode = 401; return res.end('unauthorized'); }
  if (!process.env.DAILY_API_KEY) { res.statusCode = 200; return res.end(JSON.stringify({ skipped: 'provider_not_configured' })); }
  try {
    const r = await rpc('consult_rooms_to_purge', { p_secret: secret });
    if (!r.ok) throw new Error('rpc');
    const rooms = await r.json(), done = [];
    for (const name of rooms) {
      const l = await daily('/recordings?room_name=' + encodeURIComponent(name) + '&limit=50');
      if (l.ok) { const j = await l.json(); for (const rec of (j.data || [])) { const d = await daily('/recordings/' + rec.id, { method: 'DELETE' }); if (!d.ok && d.status !== 404) throw new Error('delete_recording'); } }
      else if (l.status !== 404) throw new Error('list_recordings');
      const dr = await daily('/rooms/' + encodeURIComponent(name), { method: 'DELETE' });
      if (!dr.ok && dr.status !== 404) throw new Error('delete_room');
      done.push(name);
    }
    if (done.length) await rpc('consult_rooms_purged', { p_secret: secret, p_names: done });
    res.statusCode = 200; res.end(JSON.stringify({ purged: done.length }));
  } catch (e) { res.statusCode = 502; res.end(JSON.stringify({ error: 'failed' })); }
};

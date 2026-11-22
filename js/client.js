// جلسة الموكل (جوجل). مفتاح منفصل عن جلسة المحامي علشان واجهة المحامين ما تظهرش للموكل.
(() => {
  const SB = 'https://qlboprdqnjvsmcwfpjwl.supabase.co', KEY = 'sb_publishable_i-9FiXSNKe5xf_mEawmEfQ_PjSjf2_i', K = 'lg_c';
  const get = () => { try { return JSON.parse(localStorage.getItem(K)); } catch { return null; } };
  const set = v => { try { v ? localStorage.setItem(K, JSON.stringify(v)) : localStorage.removeItem(K); } catch {} };
  let S = get();
  async function token() {
    if (!S) return null;
    if (S.expires_at && S.expires_at * 1000 < Date.now() + 60000 && S.refresh_token) {
      try {
        const r = await fetch(SB + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: S.refresh_token }) });
        const j = await r.json(); if (!r.ok || !j.access_token) throw 0; S = { ...S, ...j }; set(S);
      } catch { S = null; set(null); return null; }
    }
    return S.access_token;
  }
  async function rpc(fn, json) {
    const t = await token();
    const r = await fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + (t || KEY), 'Content-Type': 'application/json' }, body: JSON.stringify(json || {}) });
    const tx = await r.text(); let j = null; try { j = tx ? JSON.parse(tx) : null; } catch { j = tx; }
    if (!r.ok) { const e = new Error((j && (j.message || j.msg)) || 'HTTP ' + r.status); e.status = r.status; throw e; }
    return j;
  }
  // رجوع جوجل بيحط التوكن في الـ hash
  async function handleHash() {
    const h = location.hash.replace(/^#/, ''); if (!/access_token=/.test(h)) return false;
    const p = new URLSearchParams(h); const at = p.get('access_token'); if (!at) return false;
    try {
      const r = await fetch(SB + '/auth/v1/user', { headers: { apikey: KEY, Authorization: 'Bearer ' + at } });
      const u = await r.json(); if (!r.ok) throw 0;
      S = { access_token: at, refresh_token: p.get('refresh_token'), expires_at: Number(p.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(p.get('expires_in') || 3600), user: { id: u.id, email: u.email } }; set(S);
    } catch {}
    history.replaceState(null, '', location.pathname + location.search); return !!S;
  }
  async function signIn(back) {
    try {
      const r = await fetch(SB + '/auth/v1/settings', { headers: { apikey: KEY } }), j = await r.json();
      if (j && j.external && j.external.google === false) { alert('تسجيل الدخول بجوجل لسه متفعّلش. جرّب تاني بعد شوية.'); return; }
    } catch {}
    const to = location.origin + '/account.html' + (back ? '?back=' + encodeURIComponent(back) : '');
    location.href = SB + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(to);
  }
  window.ClientAuth = { get: () => S, token, rpc, handleHash, signIn, signOut() { S = null; set(null); }, me: () => rpc('client_me') };
})();

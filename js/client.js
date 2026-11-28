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
  // دخول/تسجيل الموكل بالإيميل والباسورد
  async function emailAuth(mode, email, password, name) {
    const up = mode === 'up';
    const r = await fetch(SB + (up ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password'), { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(up ? { email, password, data: { role: 'client', full_name: String(name || '').slice(0, 80) } } : { email, password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const m = String(j.msg || j.message || j.error_description || ''); throw new Error(/already|registered/i.test(m) ? 'exists' : /invalid|credentials/i.test(m) ? 'bad' : /password/i.test(m) ? 'weak' : m || 'fail'); }
    if (!j.access_token) return { confirm: true };
    S = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: { id: j.user.id, email: j.user.email } }; set(S);
    return { ok: true };
  }
  function form(opts) {
    const el = opts.el, id = 'cf' + Math.random().toString(36).slice(2, 6); let up = !!opts.signup;
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const draw = (msg) => { el.innerHTML = `<div class="cfm" style="display:grid;gap:8px;text-align:right;max-width:340px;margin:0 auto">
      ${up ? `<input id="${id}n" class="soc-in" style="width:100%;padding:11px 12px;border:1px solid #E2E8F0;border-radius:10px;font:inherit" placeholder="اسمك" autocomplete="name">` : ''}
      <input id="${id}e" type="email" dir="ltr" style="width:100%;padding:11px 12px;border:1px solid #E2E8F0;border-radius:10px;font:inherit" placeholder="الإيميل" autocomplete="email">
      <input id="${id}p" type="password" dir="ltr" style="width:100%;padding:11px 12px;border:1px solid #E2E8F0;border-radius:10px;font:inherit" placeholder="الباسورد (8 حروف على الأقل)" autocomplete="${up ? 'new-password' : 'current-password'}">
      <div id="${id}m" style="font-size:13px;color:#B91C1C;min-height:18px">${msg ? esc(msg) : ''}</div>
      <button id="${id}g" type="button" class="soc-btn primary">${up ? 'إنشاء حساب' : 'دخول'}</button>
      <button id="${id}s" type="button" class="soc-btn">${up ? 'عندي حساب، دخول' : 'مفيش عندي حساب، إنشاء حساب'}</button></div>`;
      const $ = k => document.getElementById(id + k);
      $('s').onclick = () => { up = !up; draw(); };
      $('g').onclick = async () => {
        const em = $('e').value.trim(), pw = $('p').value, nm = up ? $('n').value.trim() : '';
        if (!/^\S+@\S+\.\S+$/.test(em)) return draw0('اكتب إيميل صحيح.');
        if (pw.length < 8) return draw0('الباسورد لازم 8 حروف على الأقل.');
        $('g').disabled = true;
        try {
          const r = await emailAuth(up ? 'up' : 'in', em, pw, nm);
          if (r.confirm) { el.innerHTML = '<p style="line-height:2">📧 بعتنالك رسالة تأكيد على إيميلك. افتحها وبعدين ارجع هنا وادخل بحسابك.</p>'; return; }
          opts.onDone && opts.onDone();
        } catch (e) { $('g').disabled = false; draw0(e.message === 'exists' ? 'الإيميل ده مسجّل قبل كده، جرّب تدخل.' : e.message === 'bad' ? 'الإيميل أو الباسورد غلط.' : e.message === 'weak' ? 'الباسورد ضعيف، اختار أقوى.' : 'حصلت مشكلة، جرّب تاني.'); }
      };
      function draw0(m) { const x = $('m'); if (x) x.textContent = m; }
    };
    draw();
  }
  window.ClientAuth = { emailAuth, form, get: () => S, token, rpc, handleHash, signIn, signOut() { S = null; set(null); }, me: () => rpc('client_me') };
})();

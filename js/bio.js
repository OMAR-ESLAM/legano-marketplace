// دخول المحامي بالبصمة/الوجه/قفل الشاشة (WebAuthn للجهاز). التحقق بيتم على الجهاز نفسه،
// وبعدها بنجدد الجلسة بالتوكن المحفوظ. لو أي حاجة فشلت، الدخول بالإيميل والباسورد زي ما هو.
(() => {
  const K = 'lg_bio', SB = 'https://qlboprdqnjvsmcwfpjwl.supabase.co', KEY = 'sb_publishable_i-9FiXSNKe5xf_mEawmEfQ_PjSjf2_i';
  const get = () => { try { return JSON.parse(localStorage.getItem(K)); } catch { return null; } };
  const put = v => { try { v ? localStorage.setItem(K, JSON.stringify(v)) : localStorage.removeItem(K); } catch {} };
  const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  async function supported() {
    try { return !!(window.PublicKeyCredential && isSecureContext && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
  }
  const enabled = () => !!(get() && get().cid && get().rt);
  async function enable(session) {
    if (!session || !session.refresh_token) throw new Error('no_session');
    const c = await navigator.credentials.create({ publicKey: {
      challenge: rnd(32), rp: { name: 'Legano', id: location.hostname },
      user: { id: rnd(16), name: (session.user && session.user.email) || 'lawyer', displayName: 'محامي ليجانو' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000, attestation: 'none' } });
    if (!c) throw new Error('cancel');
    put({ cid: b64(c.rawId), rt: session.refresh_token, email: (session.user && session.user.email) || '' });
  }
  // بيرجّع جلسة جديدة أو بيرمي خطأ (والصفحة ترجع للإيميل والباسورد)
  async function login() {
    const d = get(); if (!d) throw new Error('none');
    const a = await navigator.credentials.get({ publicKey: { challenge: rnd(32), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: unb64(d.cid), transports: ['internal'] }], userVerification: 'required', timeout: 60000 } });
    if (!a) throw new Error('cancel');
    const r = await fetch(SB + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: d.rt }) });
    const j = await r.json();
    if (!r.ok || !j.access_token) { put(null); throw new Error('expired'); }
    put({ ...d, rt: j.refresh_token });
    return j;
  }
  // كل ما الجلسة تتجدد، بنحدّث التوكن المحفوظ علشان ما يبقاش قديم
  function sync(session) { const d = get(); if (d && session && session.refresh_token && d.rt !== session.refresh_token) put({ ...d, rt: session.refresh_token }); }
  window.Bio = { supported, enabled, enable, login, sync, disable: () => put(null) };
})();

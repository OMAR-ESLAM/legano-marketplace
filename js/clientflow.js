// رحلة الموكل في خطوات بسيطة جوه نافذة واحدة: حسابك ← رصيدك ← طلبك.
// ClientFlow.open({ price, onReady }) و ClientFlow.topupForm(el, { pi, need, onDone })
(() => {
  const CA = window.ClientAuth, SB = 'https://qlboprdqnjvsmcwfpjwl.supabase.co', KEY = 'sb_publishable_i-9FiXSNKe5xf_mEawmEfQ_PjSjf2_i';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = n => Number(n).toLocaleString('ar-EG');
  const G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
  const css = `.cf-steps{display:flex;gap:6px;padding:10px 14px 0;font-size:12px;font-weight:800;color:#94A3B8}
  .cf-steps div{flex:1;text-align:center;padding:6px 4px;border-bottom:3px solid #E2E8F0}.cf-steps .on{color:#0F172A;border-color:#92620C}.cf-steps .done{color:#15803D;border-color:#15803D}
  .cf-g{display:flex;width:100%;align-items:center;justify-content:center;gap:10px;padding:13px;border-radius:14px;border:1px solid #DADCE0;background:#fff;font:inherit;font-weight:800;font-size:15px;cursor:pointer}
  .cf-or{display:flex;align-items:center;gap:10px;color:#94A3B8;font-size:12.5px;margin:14px 0}.cf-or::before,.cf-or::after{content:'';flex:1;height:1px;background:#E2E8F0}
  .cf-lead{margin:0 0 12px;line-height:1.9;font-size:14px;color:#334155}
  .cf-sum{display:flex;justify-content:space-between;gap:8px;padding:12px;border-radius:12px;background:#FFF8E6;border:1px solid #F1D48A;font-size:13.5px;margin-bottom:12px}.cf-sum b{color:#7A5200}
  .tf{display:grid;gap:10px}.tf label{font-size:13px;font-weight:800;display:grid;gap:5px}
  .tf input[type=number],.tf input[type=text],.tf input[type=tel]{width:100%;padding:12px;border:1px solid #E2E8F0;border-radius:12px;font:inherit;font-size:15px}
  .tf-card{padding:14px;border-radius:14px;background:#0F172A;color:#fff;text-align:center}.tf-card small{color:#CBD5E1;display:block}
  .tf-num{font-size:26px;font-weight:900;letter-spacing:.08em;color:#FCD34D;margin:4px 0 8px}
  .tf-card button{background:#FCD34D;color:#0F172A;border:0;border-radius:10px;padding:8px 18px;font:inherit;font-weight:900;cursor:pointer}
  .tf-file{display:flex!important;align-items:center;justify-content:center;gap:8px;padding:14px;border:2px dashed #CBD5E1;border-radius:14px;cursor:pointer;color:#475569;text-align:center}
  .tf-file.ok{border-color:#15803D;color:#15803D;background:#F0FDF4}.tf img{max-width:100%;max-height:170px;border-radius:10px;border:1px solid #E2E8F0;margin:0 auto}
  .tf-msg{font-size:13px;color:#B91C1C;min-height:18px}.cf-wait{text-align:center;padding:10px 4px}.cf-wait .big{font-size:46px}`;
  let styled = false; const style = () => { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };

  const shrink = f => new Promise((ok, no) => { const im = new Image(), u = URL.createObjectURL(f); im.onload = () => { const k = Math.min(1, 1200 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); const d = c.toDataURL('image/jpeg', 0.72); ok(d); }; im.onerror = () => no(new Error('topup_receipt')); im.src = u; });

  // فورم الشحن المبسّط: 3 حاجات بس (حوّل، اكتب رقمك، ارفع الصورة)
  function topupForm(el, o) {
    const pi = o.pi, need = Math.max(0, Math.ceil(o.need || 0)), def = Math.min(pi.max, Math.max(pi.min, need || pi.min));
    const ERR = { topup_amount: `المبلغ لازم يكون من ${num(pi.min)} لـ ${num(pi.max)} جنيه.`, topup_sender: 'اكتب رقم التليفون اللي حوّلت منه.', topup_receipt: 'ارفع سكرين شوت التحويل (صورة واضحة).', topup_pending_limit: 'عندك 3 طلبات لسه بتتراجع. استنى لما تخلص.', rate_limited: 'طلبات كتير النهارده. جرّب بكرة.' };
    const id = 'tf' + Math.random().toString(36).slice(2, 6), $ = k => document.getElementById(id + k); let b64 = null;
    el.innerHTML = `<div class="tf">
      <div class="tf-card"><small>١. حوّل المبلغ على فودافون كاش للرقم ده</small><div class="tf-num" dir="ltr">${esc(pi.number)}</div><button type="button" id="${id}c">نسخ الرقم</button></div>
      <label>٢. المبلغ اللي حوّلته (جنيه)<input id="${id}a" type="number" inputmode="numeric" min="${pi.min}" max="${pi.max}" value="${def}"></label>
      <label>٣. رقم تليفونك اللي حوّلت منه<input id="${id}s" type="tel" dir="ltr" inputmode="tel" placeholder="01xxxxxxxxx"></label>
      <label class="tf-file" id="${id}l"><input id="${id}f" type="file" accept="image/*" hidden><span id="${id}t">📷 ارفع سكرين شوت التحويل</span></label><img id="${id}p" alt="" hidden>
      <div class="tf-msg" id="${id}m" role="alert"></div>
      <button type="button" class="soc-btn primary" id="${id}g" style="width:100%;padding:13px;font-size:15px">أكّدت التحويل</button></div>`;
    $('c').onclick = async () => { try { await navigator.clipboard.writeText(pi.number); $('c').textContent = 'اتنسخ ✓'; } catch { $('c').textContent = pi.number; } };
    $('f').onchange = async () => { const f = $('f').files[0]; if (!f) return; try { const d = await shrink(f); b64 = d.split(',')[1]; $('p').src = d; $('p').hidden = false; $('l').classList.add('ok'); $('t').textContent = '✓ الصورة اتحمّلت (دوس لتغييرها)'; } catch { b64 = null; $('m').textContent = ERR.topup_receipt; } };
    $('g').onclick = async () => {
      $('g').disabled = true; $('m').textContent = '';
      try { if (!b64) throw new Error('topup_receipt');
        await CA.rpc('topup_create', { p_amount: Number($('a').value), p_method: 'vodafone_cash', p_sender: $('s').value.trim(), p_ref: null, p_receipt: b64, p_mime: 'image/jpeg' });
        o.onDone && o.onDone(); }
      catch (e) { $('m').textContent = ERR[e.message] || 'حصلت مشكلة، جرّب تاني.'; $('g').disabled = false; }
    };
  }

  let ov = null, poll = null;
  const close = () => { clearInterval(poll); poll = null; if (ov) { ov.remove(); ov = null; } };
  const googleOn = async () => { try { const r = await fetch(SB + '/auth/v1/settings', { headers: { apikey: KEY } }), j = await r.json(); return !!(j && j.external && j.external.google); } catch { return false; } };

  function shell(step, title, body) {
    const S = ['حسابك', 'رصيدك', 'طلبك'];
    ov.querySelector('.modal').innerHTML = `<div class="modal-h"><h2>${title}</h2><button type="button" class="modal-x" id="cfX" aria-label="إغلاق">×</button></div>
      <div class="cf-steps">${S.map((s, i) => `<div class="${i + 1 < step ? 'done' : i + 1 === step ? 'on' : ''}">${i + 1 < step ? '✓ ' : ''}${s}</div>`).join('')}</div><div class="modal-b" id="cfB">${body}</div>`;
    document.getElementById('cfX').onclick = close;
  }

  async function authStep(o, msg) {
    shell(1, 'سجّل علشان تكمّل', `<p class="cf-lead">${esc(msg || 'حسابك بيحفظ رصيدك واستشاراتك في مكان واحد، وبياخد ثواني.')}</p>${await googleOn() ? `<button type="button" class="cf-g" id="cfG">${G} كمّل بجوجل</button><div class="cf-or">أو بالإيميل</div>` : ''}<div id="cfF"></div>`);
    const g = document.getElementById('cfG'); if (g) g.onclick = () => CA.signIn(o.back || location.pathname.split('/').pop());
    CA.form({ signup: true, el: document.getElementById('cfF'), onDone: () => route(o) });
  }

  async function topupStep(o, me, pi, tops) {
    const need = o.price - me.balance, pend = (tops || []).find(t => t.status === 'pending');
    const sum = `<div class="cf-sum">${o.price ? `<span>سعر الاستشارة <b>${num(o.price)} ج</b></span>` : ''}<span>رصيدك <b>${num(Math.round(me.balance * 100) / 100)} ج</b></span></div>`;
    const waiting = () => { shell(2, 'بنراجع تحويلك', `${sum}<div class="cf-wait"><div class="big">⏳</div><p class="cf-lead">وصلنا طلب شحن ${num(pend.amount)} ج وبنراجعه دلوقتي. غالباً بيخلص في ساعات، ورصيدك هيتضاف تلقائي.<br>سيب الصفحة دي أو ارجع بعدين، وتقدر تكمّل طلبك أول ما الرصيد يتضاف.</p><button type="button" class="soc-btn" id="cfMore">عايز أبعت تحويل تاني</button> <button type="button" class="soc-btn primary" id="cfOk">تمام</button></div>`);
      document.getElementById('cfOk').onclick = close; document.getElementById('cfMore').onclick = () => form();
      clearInterval(poll); if (o.price) poll = setInterval(async () => { try { const m = await CA.me(); if (Number(m.balance) >= o.price) { clearInterval(poll); close(); o.onReady && o.onReady(); } } catch {} }, 15000); };
    const form = () => { clearInterval(poll); shell(2, 'اشحن رصيدك', `${sum}<p class="cf-lead">${o.price ? `محتاج تشحن <b>${num(Math.max(need, pi.min))} ج</b> على الأقل. ` : ''}حوّل وارفع صورة التحويل، وإحنا بنضيف الرصيد بعد المراجعة.</p><div id="cfT"></div>`);
      topupForm(document.getElementById('cfT'), { pi, need, onDone: async () => { try { tops = await CA.rpc('topup_mine'); } catch {} pend0(); } }); };
    const pend0 = () => { shell(2, 'وصلنا تحويلك ✅', `<div class="cf-wait"><div class="big">✅</div><p class="cf-lead">استلمنا طلب الشحن وهنراجعه. أول ما الرصيد يتضاف تقدر تطلب استشارتك. غالباً بيتم في ساعات.</p><button type="button" class="soc-btn primary" id="cfOk">تمام</button></div>`); document.getElementById('cfOk').onclick = close; };
    if (pend) waiting(); else form();
  }

  async function route(o) {
    if (!CA.get()) return authStep(o);
    try {
      const [me, pi, tops] = await Promise.all([CA.me(), CA.rpc('pay_info'), CA.rpc('topup_mine').catch(() => [])]);
      me.balance = Number(me.balance) || 0;
      if (!o.force && me.balance >= o.price) { close(); o.onReady && o.onReady(me); return; }
      topupStep(o, me, pi, tops);
    } catch (e) {
      if (/not_client/.test(e.message)) { CA.signOut(); authStep(o, 'الحساب ده مش حساب موكل. لو إنت محامي ادخل من صفحة دخول المحامين، أو سجّل بإيميل تاني.'); }
      else if (e.status === 401) { CA.signOut(); authStep(o); }
      else shell(1, 'حصلت مشكلة', '<p class="cf-lead">مقدرناش نحمّل بياناتك. جرّب تاني بعد شوية.</p>');
    }
  }

  function open(o) {
    style(); close();
    ov = document.createElement('div'); ov.className = 'modal-ov'; ov.innerHTML = '<div class="modal" role="dialog" aria-modal="true"></div>';
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    document.body.appendChild(ov); shell(1, '...', '<p class="cf-lead">ثواني…</p>'); route(o);
  }
  window.ClientFlow = { open, close, topupForm, style };
})();

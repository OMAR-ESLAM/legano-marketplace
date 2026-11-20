const CW = window.CaseWidget;
const S = window.Social;
const esc = CW.escapeHTML;
const SITE = 'Legano';
const CATEGORY_ICONS = { rent: 'building-2', labor: 'briefcase', criminal: 'scale', family: 'users', contracts: 'file-text', commercial: 'landmark', other: 'more-horizontal' };

const app = document.getElementById('app');
const bar = document.getElementById('stickyBar');
const toastEl = document.getElementById('toast');
const $ = id => document.getElementById(id);

function catLabel(key) { const c = CW.LEAD_CATEGORIES.find(x => x.key === key); return c ? c.label : key; }
function icons() { window.lucide && window.lucide.createIcons(); }

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// المفضلة: تخزين محلي للزائر فقط (قد يكون غير متاح، فكل حاجة جوه try)
function favs() { try { return JSON.parse(localStorage.getItem('fav_lawyers') || '[]'); } catch { return []; } }
function setFavs(a) { try { localStorage.setItem('fav_lawyers', JSON.stringify(a)); } catch {} }
function isFav(id) { return favs().includes(id); }

function formatPhone(p) { const d = String(p).replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : d; }

function notFound() {
  app.innerHTML = `<div class="glass rounded-2xl p-10 text-center">
    <div class="mb-3 text-4xl">🧑‍⚖️</div>
    <h1 class="text-lg font-bold text-gold-c">البروفايل غير موجود</h1>
    <p class="mt-2 text-sm text-muted-c">ممكن يكون الرابط غلط أو الحساب اتشال.</p>
    <a href="index.html?browse=1" class="btn-main btn-call mt-5 inline-flex">ارجع للبحث</a>
  </div>`;
}

const COVER_WAVE = '<svg viewBox="0 0 720 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0,120 C90,70 150,170 240,120 C330,70 390,170 480,120 C570,70 630,170 720,120" fill="none" stroke="rgba(212,160,23,.55)" stroke-width="2"/><path d="M0,140 C90,100 150,190 240,140 C330,100 390,190 480,140 C570,100 630,190 720,140" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.4"/></svg>';

function render(l, similar) {
  const p = l.publicProfile;
  const isMe = S.me() === l.id;
  document.title = `${p.displayName} | ${SITE}`;
  const photo = /^(https:\/\/|data:image\/)/.test(p.photoBase64 || '')
    ? `<img src="${esc(p.photoBase64)}" alt="" class="absolute inset-0 h-full w-full object-cover">`
    : `<i data-lucide="scale" class="text-gold-c" style="width:44px;height:44px;"></i>`;

  const chips = (p.specialties || []).map(k => `<span class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold chip-inactive"><i data-lucide="${CATEGORY_ICONS[k] || 'tag'}" style="width:13px;height:13px;"></i>${esc(catLabel(k))}</span>`).join('');
  const feat = l.featured ? '<span class="rounded-full px-2.5 py-1 text-[11px] font-bold badge-featured">مميز</span>' : '';

  const fact = (icon, label, value) => `<li class="fact"><i data-lucide="${icon}" class="text-gold-c" style="width:16px;height:16px;"></i><span class="fact-l">${label}</span><b>${esc(value)}</b></li>`;
  const list = (arr) => (arr || []).length
    ? `<ul class="flex flex-col gap-2">${arr.map(x => `<li class="flex items-start gap-2 text-sm text-fg"><i data-lucide="check" class="mt-1 shrink-0 text-gold-c" style="width:14px;height:14px;"></i><span>${esc(x)}</span></li>`).join('')}</ul>`
    : `<p class="text-sm text-muted-c">لم تتم إضافة بيانات بعد.</p>`;

  const verifiedBox = l.verified
    ? `<div class="flex items-start gap-3 rounded-xl p-3 text-sm" style="background:rgba(29,155,240,.07);border:1px solid rgba(29,155,240,.28);color:#0B5FA5;"><span class="mt-0.5 shrink-0">${S.badge('lg')}</span><span>تمت مراجعة بطاقة القيد بالنقابة لهذا المحامي. درجة القيد المعلنة: <b>${esc(p.licenseLevel)}</b>.</span></div>`
    : `<div class="flex items-start gap-3 rounded-xl p-3 text-sm text-muted-c" style="border:1px dashed var(--border);"><i data-lucide="shield-alert" class="mt-0.5 shrink-0"></i><span>لم يتم التحقق من قيد هذا المحامي بعد. ننصحك بطلب كارنيه النقابة قبل أي تعاقد.</span></div>`;

  const simHTML = similar.length ? `
    <section>
      <h2 class="mb-3 text-sm font-bold text-gold-soft-c">محامون في نفس التخصص</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        ${similar.map(s => `<a href="lawyer.html?id=${encodeURIComponent(s.id)}" class="flex flex-col gap-1 rounded-2xl border border-app bg-card-c/70 p-3 text-center transition hover:border-[color:var(--gold)]">
          <div class="text-sm font-bold text-fg">${esc(s.publicProfile.displayName)}${s.verified ? S.badge() : ''}</div>
          <div class="text-[11px]">${S.stars(s.rating.avg, s.rating.count)}</div>
          <div class="text-xs text-muted-c">${esc((s.publicProfile.specialties || []).map(catLabel).join(' • '))}</div>
          <div class="text-xs text-muted-c">📍 ${esc(s.publicProfile.city)}</div>
        </a>`).join('')}
      </div>
    </section>` : '';

  const actions = isMe
    ? `<a href="dashboard.html" class="btn-main btn-ghost fb-act">تعديل بياناتي</a><a href="feed.html" class="btn-main btn-call fb-act">المنشورات</a>`
    : `<a id="btnCall" href="#" class="btn-main btn-call fb-act"><i data-lucide="phone"></i>اتصل الآن</a>
       <a id="btnWa" href="#" class="btn-main btn-wa fb-act"><i data-lucide="message-circle"></i>واتساب</a>
       ${S.me() ? '<button id="fBtn" type="button" class="btn-main btn-ghost fb-act" hidden></button>' : ''}`;

  app.innerHTML = `
  <section class="fb-card glass overflow-hidden rounded-2xl">
    <div class="fb-cover">${COVER_WAVE}</div>
    <div class="fb-idrow">
      <div class="fb-ava"><div class="relative h-full w-full overflow-hidden rounded-full bg-secondary-c flex items-center justify-center">${photo}</div></div>
      <div class="fb-main">
        <h1 class="fb-name">${esc(p.displayName)}${l.verified ? S.badge('lg') : ''}</h1>
        <div class="fb-sub"><i data-lucide="map-pin" style="width:14px;height:14px;"></i><span>${esc(p.city || '')}</span>${p.experienceYears ? `<span>•</span><span>خبرة ${esc(p.experienceYears)} سنة</span>` : ''}</div>
        <div class="fb-rate" id="fbRate">${S.stars(l.rating.avg, l.rating.count, true)}</div>
        <div class="fb-counts" id="fbCounts"></div>
      </div>
      <div class="fb-actions">${actions}</div>
    </div>
    <div class="fb-tags">${feat}${chips}</div>
    ${isMe ? '' : `<div class="fb-more">
      <button id="btnReveal" type="button" class="btn-main btn-ghost text-xs"><i data-lucide="eye"></i><span>إظهار الرقم</span></button>
      <button id="btnShare" type="button" class="btn-main btn-ghost text-xs"><i data-lucide="share-2"></i>مشاركة</button>
      <button id="btnFav" type="button" class="btn-main btn-ghost text-xs ${isFav(l.id) ? 'fav-on' : ''}"><i data-lucide="heart"></i><span>${isFav(l.id) ? 'محفوظ' : 'حفظ'}</span></button>
    </div><div id="phoneBox" class="px-4 pb-4 hidden"></div>`}
    <div role="tablist" aria-label="أقسام البروفايل" class="fb-tabs">
      <button class="fb-tab" role="tab" data-tab="posts" aria-selected="true">المنشورات</button>
      <button class="fb-tab" role="tab" data-tab="services" aria-selected="false">الخدمات والمحاكم</button>
      <button class="fb-tab" role="tab" data-tab="info" aria-selected="false">معلومات التواصل</button>
    </div>
  </section>

  <div class="fb-grid">
    <aside class="fb-side">
      <section class="glass rounded-2xl p-4">
        <h2 class="fb-h">نبذة</h2>
        <p class="text-sm leading-loose text-fg">${esc(p.bio || 'لم يضف المحامي نبذة بعد.')}</p>
        <ul class="facts">
          ${fact('scale', 'درجة القيد', p.licenseLevel || '—')}
          ${fact('wallet', 'الاستشارة', p.consultationFee || '—')}
          ${fact('languages', 'اللغات', (p.languages || []).join('، ') || '—')}
          ${fact('clock', 'ساعات العمل', p.hours || '—')}
        </ul>
        <div class="mt-3">${verifiedBox}</div>
      </section>
      <section class="glass rounded-2xl p-4" id="rateCard">
        <h2 class="fb-h">تقييم الموكلين</h2>
        <div class="rate-big" id="rateBig">${S.stars(l.rating.avg, l.rating.count, true)}</div>
        <div id="rateBox" class="rate-box"></div>
        <p class="mt-2 text-[11px] leading-relaxed text-muted-c">التقييم من موكلين تواصلوا مع المحامي عن طريق الموقع، وبيعبّر عن رأيهم هما ومش عن رأي ${esc(SITE)}.</p>
      </section>
    </aside>

    <div class="fb-content">
      <div data-panel="posts" role="tabpanel"><div id="socialBox"></div></div>
      <div data-panel="services" role="tabpanel" hidden class="glass flex flex-col gap-5 rounded-2xl p-4 md:p-6">
        <div><h3 class="fb-h">الخدمات</h3>${list(p.services)}</div>
        <div><h3 class="fb-h">المحاكم</h3>${list(p.courts)}</div>
        <div><h3 class="fb-h">المحافظات التي يعمل بها</h3><div class="flex flex-wrap gap-2">${(p.served || [p.city]).map(g => `<span class="rounded-full px-3 py-1 text-xs chip-inactive">${esc(g)}</span>`).join('')}</div></div>
      </div>
      <div data-panel="info" role="tabpanel" hidden class="glass flex flex-col gap-3 rounded-2xl p-4 text-sm md:p-6">
        <div class="flex items-center gap-2 text-fg"><i data-lucide="clock" class="text-gold-c" style="width:16px;height:16px;"></i><span>${esc(p.hours || 'غير محدد')}</span></div>
        <div class="flex items-center gap-2 text-fg"><i data-lucide="map-pin" class="text-gold-c" style="width:16px;height:16px;"></i><span>${esc(p.city || '')}</span></div>
        <p class="text-xs leading-loose text-muted-c">اذكر للمحامي إنك وصلت له من ${esc(SITE)}، واطلب منه كارنيه النقابة واتفق على الأتعاب كتابة قبل بدء العمل.</p>
      </div>
    </div>
  </div>

  ${simHTML}

  <p class="text-center text-[11px] leading-loose text-muted-c/80">
    ${esc(SITE)} وسيط للتعارف فقط، ولا يقدّم استشارات قانونية ولا يضمن نتيجة أي قضية.
    علامة «موثّق» تعني مراجعة بطاقة القيد، و«مميز» عرض مدفوع، والتقييم رأي الموكلين.
  </p>`;

  if (isMe) { bar.classList.add('hidden'); bar.classList.remove('flex'); }
  else {
    bar.classList.remove('hidden'); bar.classList.add('flex');
    bar.innerHTML = `
      <a id="barCall" href="#" class="btn-main btn-call flex-1"><i data-lucide="phone"></i>اتصل</a>
      <a id="barWa" href="#" class="btn-main btn-wa flex-1"><i data-lucide="message-circle"></i>واتساب</a>`;
  }

  wire(l, isMe);
  icons();
  S.mountProfilePosts($('socialBox'), l);
  loadCounts(l, isMe);
  refreshRate(l);
}

// عدّاد المتابعين + زرار المتابعة (للمحامي المسجّل بس: الموكل مفيش له حساب)
async function loadCounts(l, isMe) {
  let st = null; try { st = await S.profileSocial(l.id); } catch {}
  st = st || { followers: 0, following: 0, posts: 0, views: 0, cases: 0, i_follow: false };
  const draw = () => {
    $('fbCounts').innerHTML = `<span><b>${S.num(st.followers)}</b> متابع</span><span><b>${S.num(st.following)}</b> بيتابع</span><span><b>${S.num(st.posts)}</b> منشور</span>${st.cases ? `<span class="fb-case" title="المحامي بيتابع قضايا موكليه من خلال Legano"><b>${S.num(st.cases)}</b> قضية متتبَّعة</span>` : ''}${isMe ? `<span title="المشاهدات تظهر لصاحب البروفايل بس"><b>${S.num(st.views)}</b> مشاهدة</span>` : ''}`;
    const f = $('fBtn');
    if (f) { f.hidden = false; f.textContent = st.i_follow ? 'بتتابعه ✓' : 'متابعة'; f.classList.toggle('btn-ghost', st.i_follow); f.classList.toggle('btn-call', !st.i_follow); }
  };
  draw();
  const f = $('fBtn');
  if (f) f.onclick = async () => {
    f.disabled = true;
    try {
      if (st.i_follow) { await S.unfollow(l.id); st.i_follow = false; st.followers = Math.max(0, st.followers - 1); }
      else { await S.follow(l.id); st.i_follow = true; st.followers++; }
      draw();
    } catch (e) { toast(S.friendly(e)); }
    f.disabled = false;
  };
}

// تقييم الموكل: متاح بعد ما يتواصل مع المحامي (السيرفر بيتأكد). المحامي المسجّل مش بيقيّم.
async function refreshRate(l) {
  const box = $('rateBox'); if (!box) return;
  if (S.me()) { box.innerHTML = S.me() === l.id ? '' : '<p class="text-xs text-muted-c">التقييم للموكلين بس.</p>'; return; }
  let st = null; try { st = await S.ratingStatus(l.id); } catch {}
  if (!st || !st.eligible) { box.innerHTML = '<p class="text-xs leading-relaxed text-muted-c">تقدر تقيّم الأستاذ بعد ما تتصل بيه أو تبعتله واتساب من هنا.</p>'; return; }
  const my = st.my || 0;
  box.innerHTML = `<p class="mb-1 text-xs font-semibold text-fg">${my ? 'تقييمك (اضغط على نجمة تانية لتعديله):' : 'قيّم تجربتك مع الأستاذ:'}</p>
    <div class="rate-input" role="radiogroup" aria-label="تقييمك من 5">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${n === my}" data-n="${n}" aria-label="${n} من 5" class="${n <= my ? 'on' : ''}">★</button>`).join('')}</div>`;
  const row = box.querySelector('.rate-input'), btns = [...row.children];
  const paint = n => btns.forEach((b, i) => b.classList.toggle('hv', i < n));
  row.addEventListener('mouseover', e => { const b = e.target.closest('button'); if (b) paint(Number(b.dataset.n)); });
  row.addEventListener('mouseleave', () => paint(0));
  row.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    btns.forEach(x => { x.disabled = true; });
    try {
      const r = await S.rate(l.id, Number(b.dataset.n));
      $('fbRate').innerHTML = $('rateBig').innerHTML = S.stars(r.avg, r.count, true);
      toast('شكراً على تقييمك'); refreshRate(l);
    } catch (er) { toast(S.friendly(er)); btns.forEach(x => { x.disabled = false; }); }
  });
}

function wire(l, isMe) {
  const p = l.publicProfile;

  // التابات
  const tabs = app.querySelectorAll('.fb-tab');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.setAttribute('aria-selected', String(x === t)));
    app.querySelectorAll('[data-panel]').forEach(pn => { pn.hidden = pn.dataset.panel !== t.dataset.tab; });
  }));
  if (isMe) return;

  // تتبع الضغط على الاتصال/واتساب
  ['btnCall', 'barCall'].forEach(id => $(id)?.addEventListener('click', e => { e.preventDefault(); CW.openContact(l.id, 'call'); }));
  ['btnWa', 'barWa'].forEach(id => $(id)?.addEventListener('click', e => { e.preventDefault(); CW.openContact(l.id, 'whatsapp', `مرحباً أستاذ ${p.displayName}، وصلت لحضرتك من موقع ${SITE}. محتاج استشارة بخصوص: `); }));

  // لما الموكل يرجع للصفحة بعد المكالمة/الواتساب نفتحله التقييم
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshRate(l); });
  addEventListener('pageshow', e => { if (e.persisted) refreshRate(l); });

  // إظهار الرقم + نسخ
  const box = $('phoneBox');
  const revealBtn = $('btnReveal');
  revealBtn.addEventListener('click', async () => {
    if (box.classList.contains('hidden')) {
      let ph = null; try { ph = await CW.getContact(l.id, 'reveal'); } catch {} if (!ph) return toast('الرقم غير متاح دلوقتي'); p.phone = ph;
      box.classList.remove('hidden'); box.classList.add('reveal-in');
      box.innerHTML = `<div class="flex items-center justify-between gap-2 rounded-xl border border-app bg-card-c/70 px-4 py-3">
        <button id="copyPhone" type="button" class="flex items-center gap-1 text-xs font-semibold text-gold-c"><i data-lucide="copy" style="width:14px;height:14px;"></i>نسخ</button>
        <span dir="ltr" class="text-lg font-extrabold tracking-wider text-fg">${esc(formatPhone(p.phone))}</span>
      </div>`;
      revealBtn.querySelector('span').textContent = 'إخفاء الرقم';
      icons(); refreshRate(l);
      $('copyPhone').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(p.phone); toast('تم نسخ الرقم'); } catch { toast('انسخ الرقم يدوياً'); }
      });
    } else {
      box.classList.add('hidden');
      revealBtn.querySelector('span').textContent = 'إظهار الرقم';
    }
  });

  // مشاركة
  $('btnShare').addEventListener('click', async () => {
    const url = location.href;
    const title = `${p.displayName} — ${SITE}`;
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); toast('تم نسخ رابط البروفايل'); } catch { toast('انسخ الرابط من شريط العنوان'); }
  });

  // حفظ في المفضلة
  const favBtn = $('btnFav');
  favBtn.addEventListener('click', () => {
    const cur = favs();
    const on = cur.includes(l.id);
    setFavs(on ? cur.filter(x => x !== l.id) : [...cur, l.id]);
    favBtn.classList.toggle('fav-on', !on);
    favBtn.querySelector('span').textContent = on ? 'حفظ' : 'محفوظ';
    toast(on ? 'اتشال من المحفوظات' : 'اتحفظ في المحفوظات');
  });
}

async function boot() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return notFound();
  try {
    const l = await CW.getLawyerById(id);
    if (!l) return notFound();
    const all = await CW.listAllPublicLawyers();
    const mine = l.publicProfile.specialties || [];
    const similar = all.filter(x => x.id !== l.id && (x.publicProfile.specialties || []).some(k => mine.includes(k))).slice(0, 3);
    render(l, similar);
    CW.trackContact(l.id, 'view');
  } catch (e) {
    console.error('profile boot error', e);
    app.innerHTML = `<div class="py-16 text-center text-sm text-red-600">⚠️ حصل خطأ في تحميل البروفايل — حدّث الصفحة.</div>`;
  }
}
boot();

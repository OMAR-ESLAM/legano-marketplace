const CW = window.CaseWidget;
const esc = CW.escapeHTML;
const SITE = 'Legano';
const CATEGORY_ICONS = { rent: 'building-2', labor: 'briefcase', criminal: 'scale', family: 'users', contracts: 'file-text', commercial: 'landmark', other: 'more-horizontal' };

const app = document.getElementById('app');
const bar = document.getElementById('stickyBar');
const toastEl = document.getElementById('toast');

function catLabel(key) { const c = CW.LEAD_CATEGORIES.find(x => x.key === key); return c ? c.label : key; }
function icons() { window.lucide && window.lucide.createIcons(); }

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

// المفضلة: تخزين محلي للزائر فقط (قد يكون غير متاح، فكل حاجة جوه try)
function favs() { try { return JSON.parse(localStorage.getItem('fav_lawyers') || '[]'); } catch { return []; } }
function setFavs(a) { try { localStorage.setItem('fav_lawyers', JSON.stringify(a)); } catch {} }
function isFav(id) { return favs().includes(id); }

function formatPhone(p) { const d = String(p).replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : d; }

function waLink(l) {
  const p = l.publicProfile;
  const msg = `مرحباً أستاذ ${p.displayName}، وصلت لحضرتك من موقع ${SITE}. محتاج استشارة بخصوص: `;
  return `https://wa.me/${CW.toWaNumber(p.phone)}?text=${encodeURIComponent(msg)}`;
}

function notFound() {
  app.innerHTML = `<div class="glass rounded-2xl p-10 text-center">
    <div class="mb-3 text-4xl">🧑‍⚖️</div>
    <h1 class="text-lg font-bold text-gold-c">البروفايل غير موجود</h1>
    <p class="mt-2 text-sm text-muted-c">ممكن يكون الرابط غلط أو الحساب اتشال.</p>
    <a href="find-lawyer.html" class="btn-main btn-call mt-5 inline-flex">ارجع للبحث</a>
  </div>`;
}

function render(l, similar) {
  const p = l.publicProfile;
  document.title = `${p.displayName} | ${SITE}`;
  const photo = /^(https:\/\/|data:image\/)/.test(p.photoBase64 || '')
    ? `<img src="${esc(p.photoBase64)}" alt="" class="absolute inset-0 h-full w-full object-cover">`
    : `<i data-lucide="scale" class="text-gold-c" style="width:40px;height:40px;"></i>`;

  const badges = [
    l.verified ? `<span class="rounded-full px-2.5 py-1 text-[11px] font-bold" style="background:rgba(5,150,105,.1);color:#047857;border:1px solid rgba(5,150,105,.35);">✔ موثّق</span>` : '',
    l.featured ? `<span class="rounded-full px-2.5 py-1 text-[11px] font-bold badge-featured">مميز</span>` : '',
  ].join('');

  const chips = (p.specialties || []).map(k => `<span class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold chip-inactive"><i data-lucide="${CATEGORY_ICONS[k] || 'tag'}" style="width:13px;height:13px;"></i>${esc(catLabel(k))}</span>`).join('');

  const stat = (icon, label, value) => `<div class="stat"><i data-lucide="${icon}" class="mx-auto mb-1 text-gold-c" style="width:16px;height:16px;"></i><div class="text-sm font-extrabold text-fg">${esc(value)}</div><div class="text-[11px] text-muted-c">${label}</div></div>`;

  const list = (arr) => (arr || []).length
    ? `<ul class="flex flex-col gap-2">${arr.map(x => `<li class="flex items-start gap-2 text-sm text-fg"><i data-lucide="check" class="mt-1 shrink-0 text-gold-c" style="width:14px;height:14px;"></i><span>${esc(x)}</span></li>`).join('')}</ul>`
    : `<p class="text-sm text-muted-c">لم تتم إضافة بيانات بعد.</p>`;

  const verifiedBox = l.verified
    ? `<div class="flex items-start gap-3 rounded-xl p-3 text-sm" style="background:rgba(5,150,105,.08);border:1px solid rgba(5,150,105,.25);color:#047857;"><i data-lucide="badge-check" class="mt-0.5 shrink-0"></i><span>تمت مراجعة بطاقة القيد بالنقابة لهذا المحامي. درجة القيد المعلنة: <b>${esc(p.licenseLevel)}</b>.</span></div>`
    : `<div class="flex items-start gap-3 rounded-xl p-3 text-sm text-muted-c" style="border:1px dashed var(--border);"><i data-lucide="shield-alert" class="mt-0.5 shrink-0"></i><span>لم يتم التحقق من قيد هذا المحامي بعد. ننصحك بطلب كارنيه النقابة قبل أي تعاقد.</span></div>`;

  const simHTML = similar.length ? `
    <section>
      <h2 class="mb-3 text-sm font-bold text-gold-soft-c">محامون في نفس التخصص</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        ${similar.map(s => `<a href="lawyer.html?id=${encodeURIComponent(s.id)}" class="flex flex-col gap-1 rounded-2xl border border-app bg-card-c/70 p-3 text-center transition hover:border-[color:var(--gold)]">
          <div class="text-sm font-bold text-fg">${esc(s.publicProfile.displayName)}</div>
          <div class="text-xs text-muted-c">${esc((s.publicProfile.specialties || []).map(catLabel).join(' • '))}</div>
          <div class="text-xs text-muted-c">📍 ${esc(s.publicProfile.city)}</div>
        </a>`).join('')}
      </div>
    </section>` : '';

  app.innerHTML = `
  <section class="glass rounded-2xl p-4 md:p-6 shadow-2xl">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div class="relative mx-auto h-44 w-36 shrink-0 overflow-hidden rounded-2xl bg-secondary-c flex items-center justify-center sm:mx-0">${photo}</div>
      <div class="flex-1 text-center sm:text-right">
        <div class="mb-2 flex flex-wrap justify-center gap-2 sm:justify-start">${badges}</div>
        <h1 class="text-2xl font-extrabold text-gold-c md:text-3xl">${esc(p.displayName)}</h1>
        <div class="mt-1 flex items-center justify-center gap-1 text-sm text-muted-c sm:justify-start"><i data-lucide="map-pin" style="width:14px;height:14px;"></i><span>${esc(p.city)}</span></div>
        <div class="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">${chips}</div>
      </div>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      ${stat('briefcase', 'سنوات الخبرة', (p.experienceYears ?? '—') + ' سنة')}
      ${stat('scale', 'درجة القيد', p.licenseLevel || '—')}
      ${stat('wallet', 'الاستشارة', p.consultationFee || '—')}
      ${stat('languages', 'اللغات', (p.languages || []).join('، ') || '—')}
    </div>

    <div class="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <a id="btnCall" href="#" class="btn-main btn-call"><i data-lucide="phone"></i>اتصل الآن</a>
      <a id="btnWa" href="#" class="btn-main btn-wa"><i data-lucide="message-circle"></i>تواصل واتساب</a>
    </div>
    <div class="mt-2 grid grid-cols-3 gap-2">
      <button id="btnReveal" type="button" class="btn-main btn-ghost text-xs"><i data-lucide="eye"></i><span>إظهار الرقم</span></button>
      <button id="btnShare" type="button" class="btn-main btn-ghost text-xs"><i data-lucide="share-2"></i>مشاركة</button>
      <button id="btnFav" type="button" class="btn-main btn-ghost text-xs ${isFav(l.id) ? 'fav-on' : ''}"><i data-lucide="heart"></i><span>${isFav(l.id) ? 'محفوظ' : 'حفظ'}</span></button>
    </div>
    <div id="phoneBox" class="mt-2 hidden"></div>
  </section>

  <section class="glass rounded-2xl p-4 md:p-6">
    <div role="tablist" class="mb-4 flex flex-wrap gap-2">
      <button class="tab-btn" role="tab" data-tab="about" aria-selected="true">نبذة</button>
      <button class="tab-btn" role="tab" data-tab="services" aria-selected="false">الخدمات</button>
      <button class="tab-btn" role="tab" data-tab="courts" aria-selected="false">المحاكم والمناطق</button>
      <button class="tab-btn" role="tab" data-tab="info" aria-selected="false">معلومات التواصل</button>
    </div>
    <div data-panel="about" class="flex flex-col gap-4">
      <p class="text-sm leading-loose text-fg">${esc(p.bio || 'لم يضف المحامي نبذة بعد.')}</p>
      ${verifiedBox}
    </div>
    <div data-panel="services" hidden>${list(p.services)}</div>
    <div data-panel="courts" hidden class="flex flex-col gap-4">
      <div><h3 class="mb-2 text-xs font-bold text-gold-soft-c">المحاكم</h3>${list(p.courts)}</div>
      <div><h3 class="mb-2 text-xs font-bold text-gold-soft-c">المحافظات التي يعمل بها</h3><div class="flex flex-wrap gap-2">${(p.served || [p.city]).map(g => `<span class="rounded-full px-3 py-1 text-xs chip-inactive">${esc(g)}</span>`).join('')}</div></div>
    </div>
    <div data-panel="info" hidden class="flex flex-col gap-3 text-sm">
      <div class="flex items-center gap-2 text-fg"><i data-lucide="clock" class="text-gold-c" style="width:16px;height:16px;"></i><span>${esc(p.hours || 'غير محدد')}</span></div>
      <div class="flex items-center gap-2 text-fg"><i data-lucide="map-pin" class="text-gold-c" style="width:16px;height:16px;"></i><span>${esc(p.city)}</span></div>
      <p class="text-xs leading-loose text-muted-c">اذكر للمحامي إنك وصلت له من ${esc(SITE)}، واطلب منه كارنيه النقابة واتفق على الأتعاب كتابة قبل بدء العمل.</p>
    </div>
  </section>

  ${simHTML}

  <p class="text-center text-[11px] leading-loose text-muted-c/80">
    ${esc(SITE)} وسيط للتعارف فقط، ولا يقدّم استشارات قانونية ولا يضمن نتيجة أي قضية.
    علامة «موثّق» تعني مراجعة بطاقة القيد، و«مميز» عرض مدفوع لا يعني تقييماً.
  </p>`;

  bar.classList.remove('hidden'); bar.classList.add('flex');
  bar.innerHTML = `
    <a id="barCall" href="#" class="btn-main btn-call flex-1"><i data-lucide="phone"></i>اتصل</a>
    <a id="barWa" href="#" class="btn-main btn-wa flex-1"><i data-lucide="message-circle"></i>واتساب</a>`;

  wire(l);
  icons();
}

function wire(l) {
  const p = l.publicProfile;

  // التابات
  const tabs = app.querySelectorAll('.tab-btn');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.setAttribute('aria-selected', String(x === t)));
    app.querySelectorAll('[data-panel]').forEach(pn => { pn.hidden = pn.dataset.panel !== t.dataset.tab; });
  }));

  // تتبع الضغط على الاتصال/واتساب
  ['btnCall', 'barCall'].forEach(id => document.getElementById(id)?.addEventListener('click', e => { e.preventDefault(); CW.openContact(l.id, 'call'); }));
  ['btnWa', 'barWa'].forEach(id => document.getElementById(id)?.addEventListener('click', e => { e.preventDefault(); CW.openContact(l.id, 'whatsapp', `مرحباً أستاذ ${p.displayName}، وصلت لحضرتك من موقع ${SITE}. محتاج استشارة بخصوص: `); }));

  // إظهار الرقم + نسخ
  const box = document.getElementById('phoneBox');
  const revealBtn = document.getElementById('btnReveal');
  revealBtn.addEventListener('click', async () => {
    if (box.classList.contains('hidden')) {
      let ph = null; try { ph = await CW.getContact(l.id, 'reveal'); } catch {} if (!ph) return toast('الرقم غير متاح دلوقتي'); p.phone = ph;
      box.classList.remove('hidden'); box.classList.add('reveal-in');
      box.innerHTML = `<div class="flex items-center justify-between gap-2 rounded-xl border border-app bg-card-c/70 px-4 py-3">
        <button id="copyPhone" type="button" class="flex items-center gap-1 text-xs font-semibold text-gold-c"><i data-lucide="copy" style="width:14px;height:14px;"></i>نسخ</button>
        <span dir="ltr" class="text-lg font-extrabold tracking-wider text-fg">${esc(formatPhone(p.phone))}</span>
      </div>`;
      revealBtn.querySelector('span').textContent = 'إخفاء الرقم';
      icons();
      document.getElementById('copyPhone').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(p.phone); toast('تم نسخ الرقم'); } catch { toast('انسخ الرقم يدوياً'); }
      });
    } else {
      box.classList.add('hidden');
      revealBtn.querySelector('span').textContent = 'إظهار الرقم';
    }
  });

  // مشاركة
  document.getElementById('btnShare').addEventListener('click', async () => {
    const url = location.href;
    const title = `${p.displayName} — ${SITE}`;
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); toast('تم نسخ رابط البروفايل'); } catch { toast('انسخ الرابط من شريط العنوان'); }
  });

  // حفظ في المفضلة
  const favBtn = document.getElementById('btnFav');
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

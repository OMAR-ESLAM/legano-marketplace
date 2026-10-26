const CW = window.CaseWidget;
const esc = CW.escapeHTML;
const SITE = 'Legano';
const CATEGORY_ICONS = { all: 'layout-grid', rent: 'building-2', labor: 'briefcase', criminal: 'scale', family: 'users', contracts: 'file-text', commercial: 'landmark', other: 'more-horizontal' };

// قاموس يربط كلام الزائر العادي بالتصنيف (بيشتغل مع "عايز اتطلق" مش بس "طلاق")
const KEYWORDS = {
  family: ['طلاق', 'اتطلق', 'اطلق', 'خلع', 'نفقه', 'حضانه', 'رؤيه', 'زواج', 'قايمه', 'ميراث', 'وراثه', 'اسره', 'اطفال', 'ولايه'],
  criminal: ['بلاغ', 'محضر', 'جنايه', 'جنحه', 'قتل', 'سرقه', 'مخدرات', 'شيك', 'ايصال امانه', 'نصب', 'ضرب', 'قبض', 'حبس', 'نيابه', 'تهمه', 'تزوير', 'سب', 'قذف'],
  rent: ['ايجار', 'مستاجر', 'مالك', 'طرد', 'اخلاء', 'عقار', 'شقه', 'قديم', 'انذار', 'تمليك'],
  labor: ['فصل', 'اتفصلت', 'موظف', 'عامل', 'مرتب', 'تامينات', 'مكافاه', 'عقد عمل', 'استقاله', 'شغل'],
  contracts: ['عقد', 'عقود', 'توقيع', 'بيع', 'شراء', 'تعاقد', 'شرط جزائي', 'صياغه', 'تحكيم'],
  commercial: ['شركه', 'تاسيس', 'سجل تجاري', 'افلاس', 'تجاري', 'شريك', 'اسهم', 'مستثمر'],
};
function normalize(s) {
  return String(s || '').toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
}
function detectCategories(text) {
  const t = normalize(text);
  if (!t) return [];
  return Object.entries(KEYWORDS).filter(([, ws]) => ws.some(w => t.includes(normalize(w)))).map(([k]) => k);
}

const state = { cat: 'all', verifiedOnly: false, sort: 'default' };
let allLawyers = [];

const $input = document.getElementById('descInput');
const $city = document.getElementById('citySelect');
const $cityLabel = document.querySelector('#cityLabel span');
const $grid = document.getElementById('lawyerGrid');
const $count = document.getElementById('resultsCount');
const $verified = document.getElementById('verifiedOnly');
const $sort = document.getElementById('sortSelect');
const $reset = document.getElementById('resetBtn');
const $detected = document.getElementById('detectedHint');

function categoryLabel(key) { const c = CW.LEAD_CATEGORIES.find(x => x.key === key); return c ? c.label : key; }
function icons() { window.lucide && window.lucide.createIcons(); }

// المفضلة (تخزين محلي للزائر)
function favs() { try { return JSON.parse(localStorage.getItem('fav_lawyers') || '[]'); } catch { return []; } }
function setFavs(a) { try { localStorage.setItem('fav_lawyers', JSON.stringify(a)); } catch {} }

// حفظ حالة الفلاتر في الرابط علشان الزائر يشارك نتيجة بحثه
function writeURL() {
  const q = new URLSearchParams();
  if ($input.value.trim()) q.set('q', $input.value.trim());
  if ($city.value) q.set('city', $city.value);
  if (state.cat !== 'all') q.set('cat', state.cat);
  if (state.verifiedOnly) q.set('verified', '1');
  if (state.sort !== 'default') q.set('sort', state.sort);
  const s = q.toString();
  try { history.replaceState(null, '', s ? `?${s}` : location.pathname); } catch {}
}
function readURL() {
  const q = new URLSearchParams(location.search);
  $input.value = q.get('q') || '';
  if (q.get('city')) { $city.value = q.get('city'); $cityLabel.textContent = $city.value || 'كل المحافظات'; }
  if (q.get('cat') && CW.LEAD_CATEGORIES.some(c => c.key === q.get('cat'))) state.cat = q.get('cat');
  state.verifiedOnly = q.get('verified') === '1';
  if (['exp', 'name'].includes(q.get('sort'))) state.sort = q.get('sort');
  $verified.checked = state.verifiedOnly;
  $sort.value = state.sort;
}

function renderChips() {
  const row = document.getElementById('chipRow');
  const cats = [{ key: 'all', label: 'الكل' }, ...CW.LEAD_CATEGORIES];
  row.innerHTML = cats.map(c => {
    const cls = c.key === state.cat ? 'chip-active' : 'chip-inactive';
    return `<button type="button" class="chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${cls}" data-key="${esc(c.key)}" aria-pressed="${c.key === state.cat}">
      <span>${esc(c.label)}</span><i data-lucide="${CATEGORY_ICONS[c.key] || 'tag'}" style="width:14px;height:14px;"></i></button>`;
  }).join('');
  row.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => { state.cat = chip.dataset.key; renderChips(); applyFilters(); }));
  icons();
}

function renderCities() {
  CW.EGYPT_GOVERNORATES.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; $city.appendChild(o); });
  $city.addEventListener('change', () => { $cityLabel.textContent = $city.value || 'كل المحافظات'; applyFilters(); });
}

function skeleton() {
  $grid.innerHTML = Array.from({ length: 5 }).map(() => `<div class="overflow-hidden rounded-2xl border border-app bg-card-c/70 animate-pulse">
    <div class="aspect-[4/5] bg-secondary-c"></div><div class="space-y-2 p-3"><div class="mx-auto h-3 w-2/3 rounded bg-secondary-c"></div><div class="mx-auto h-3 w-1/2 rounded bg-secondary-c"></div><div class="h-8 rounded bg-secondary-c"></div></div></div>`).join('');
}

function applyFilters() {
  const text = $input.value;
  const term = normalize(text);
  const detected = detectCategories(text);
  const city = $city.value;

  $detected.textContent = detected.length ? `فهمنا إن مشكلتك في: ${detected.map(categoryLabel).join(' / ')}` : '';

  let list = allLawyers.filter(l => {
    const p = l.publicProfile || {};
    const sp = p.specialties || [];
    if (state.cat !== 'all' && !sp.includes(state.cat)) return false;
    if (city && p.city !== city && !(p.served || []).includes(city)) return false;
    if (state.verifiedOnly && !l.verified) return false;
    if (term) {
      if (detected.length) { if (!detected.some(k => sp.includes(k))) return false; }
      else if (!normalize([l.name, p.displayName, p.bio, ...sp.map(categoryLabel)].join(' ')).includes(term)) return false;
    }
    return true;
  });

  if (state.sort === 'exp') list = list.slice().sort((a, b) => (b.publicProfile?.experienceYears || 0) - (a.publicProfile?.experienceYears || 0));
  else if (state.sort === 'name') list = list.slice().sort((a, b) => (a.publicProfile?.displayName || '').localeCompare(b.publicProfile?.displayName || '', 'ar'));

  $reset.hidden = !(term || city || state.cat !== 'all' || state.verifiedOnly || state.sort !== 'default');
  writeURL();
  renderGrid(list);
}

function renderGrid(lawyers) {
  $count.textContent = lawyers.length ? `${lawyers.length} محامي متاح` : '';
  if (!lawyers.length) {
    $grid.innerHTML = `<div class="col-span-full text-center py-16 border border-dashed border-app rounded-2xl text-muted-c text-sm leading-loose">
      <div class="text-4xl mb-3">🧑‍⚖️</div>مفيش محامين مطابقين دلوقتي — جرّب تصنيف أو محافظة تانية، أو امسح الفلاتر.</div>`;
    return;
  }
  const fav = new Set(favs());
  $grid.innerHTML = lawyers.map(l => {
    const p = l.publicProfile || {};
    const sp = p.specialties || [];
    const line = sp.length ? sp.map(categoryLabel).join(' - ') : `محامي مسجّل على ${SITE}`;
    const photo = /^(https:\/\/|data:image\/)/.test(p.photoBase64 || '')
      ? `<img src="${esc(p.photoBase64)}" class="absolute inset-0 h-full w-full object-cover" alt="">`
      : `<i data-lucide="scale" class="text-gold-c" style="width:34px;height:34px;"></i>`;
    const isFav = fav.has(l.id);
    return `
    <article class="lawyer-card group flex flex-col overflow-hidden rounded-2xl border-app bg-card-c/70 backdrop-blur-sm border cursor-pointer" data-id="${esc(l.id)}" tabindex="0" role="link" aria-label="${esc(p.displayName || l.name)}">
      <div class="relative aspect-[4/5] w-full overflow-hidden bg-secondary-c flex items-center justify-center">
        ${photo}
        <div class="absolute inset-0" style="background:linear-gradient(to top, var(--card), color-mix(in oklch, var(--card) 10%, transparent), transparent);"></div>
        <div class="absolute top-2 inset-x-2 flex items-start justify-between gap-1">
          <button type="button" class="fav-btn flex h-8 w-8 items-center justify-center rounded-full border border-app ${isFav ? 'text-gold-c' : 'text-fg'}" style="background:color-mix(in oklch, var(--background) 65%, transparent);" aria-label="حفظ" aria-pressed="${isFav}" data-id="${esc(l.id)}">
            <i data-lucide="heart" style="width:15px;height:15px;${isFav ? 'fill:currentColor;' : ''}"></i></button>
          <div class="flex flex-col items-end gap-1">
            ${l.verified ? `<span class="rounded-full px-2 py-0.5 text-[10px] font-bold" style="background:rgba(5,150,105,.1);color:#047857;border:1px solid rgba(5,150,105,.35);">✔ موثّق</span>` : ''}
            ${l.featured ? `<span class="rounded-full px-2 py-0.5 text-[10px] font-bold badge-featured">مميز</span>` : ''}
          </div>
        </div>
      </div>
      <div class="flex flex-1 flex-col gap-2 px-3 pb-3 pt-1 text-center">
        <div class="flex items-center justify-center gap-1.5">
          <i data-lucide="star" class="text-gold-c" style="width:13px;height:13px;"></i>
          <h3 class="text-sm font-bold text-fg">${esc(p.displayName || l.name || 'محامي')}</h3>
        </div>
        <p class="text-xs leading-relaxed text-muted-c">${esc(line)}</p>
        ${p.city ? `<div class="flex items-center justify-center gap-1 text-xs text-muted-c"><i data-lucide="map-pin" style="width:12px;height:12px;"></i><span>${esc(p.city)}</span></div>` : ''}
        ${p.experienceYears ? `<div class="text-[11px] text-muted-c">خبرة ${esc(p.experienceYears)} سنة</div>` : ''}
        ${l.verified ? '' : `<div class="text-[10px] text-muted-c/80">لم يتم التحقق من القيد بعد</div>`}
        <div class="mt-1 grid grid-cols-2 gap-2">
          <a class="quick-contact flex items-center justify-center gap-1 rounded-md border border-app px-2 py-2 text-xs font-semibold text-fg hover:border-[color:var(--gold)]" href="#" data-id="${esc(l.id)}" data-type="call"><i data-lucide="phone" style="width:13px;height:13px;"></i>اتصال</a>
          <a class="quick-contact flex items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-semibold text-white" style="background:#1fa855;" href="#" data-id="${esc(l.id)}" data-type="whatsapp"><i data-lucide="message-circle" style="width:13px;height:13px;"></i>واتساب</a>
        </div>
        <button class="lc-action w-full rounded-md px-3 py-2 text-xs font-semibold text-white" style="background:var(--gold);">عرض البروفايل والتواصل</button>
        <p class="mt-1 text-[10px] leading-relaxed text-muted-c/70">من ضمن الشبكة المسجّلة على ${SITE}</p>
      </div>
    </article>`;
  }).join('');

  const go = id => { location.href = `lawyer.html?id=${encodeURIComponent(id)}`; };
  $grid.querySelectorAll('.lawyer-card').forEach(card => {
    card.addEventListener('click', () => go(card.dataset.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === card) go(card.dataset.id); });
  });
  // أزرار الاتصال السريع والحفظ ما تفتحش البروفايل
  $grid.querySelectorAll('.quick-contact').forEach(a => a.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); CW.openContact(a.dataset.id, a.dataset.type, a.dataset.type === 'whatsapp' ? `مرحباً، وصلت لحضرتك من موقع ${SITE}. محتاج استشارة بخصوص: ` : ''); }));
  $grid.querySelectorAll('.fav-btn').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const cur = favs(); const on = cur.includes(b.dataset.id);
    setFavs(on ? cur.filter(x => x !== b.dataset.id) : [...cur, b.dataset.id]);
    b.classList.toggle('text-gold-c', !on); b.classList.toggle('text-fg', on);
    b.setAttribute('aria-pressed', String(!on));
    const svg = b.querySelector('svg'); if (svg) svg.style.fill = on ? '' : 'currentColor';
  }));
  icons();
}

function resetAll() {
  $input.value = ''; $city.value = ''; $cityLabel.textContent = 'كل المحافظات';
  state.cat = 'all'; state.verifiedOnly = false; state.sort = 'default';
  $verified.checked = false; $sort.value = 'default';
  renderChips(); applyFilters();
}

let t;
$input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(applyFilters, 120); });
$verified.addEventListener('change', () => { state.verifiedOnly = $verified.checked; applyFilters(); });
$sort.addEventListener('change', () => { state.sort = $sort.value; applyFilters(); });
$reset.addEventListener('click', resetAll);

async function boot() {
  renderCities();
  readURL();
  renderChips();
  skeleton();
  try {
    allLawyers = await CW.listAllPublicLawyers();
    applyFilters();
  } catch (e) {
    console.error('find-lawyer boot error', e);
    $grid.innerHTML = `<div class="col-span-full text-center py-16 text-red-600 text-sm">⚠️ حصل خطأ في تحميل القائمة — حدّث الصفحة.</div>`;
  }
  icons();
}
boot();

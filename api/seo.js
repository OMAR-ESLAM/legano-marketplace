// دالة SEO واحدة: robots / sitemap / صفحة بروفايل / صفحة قائمة (تخصص + محافظة).
// بتجيب الصفحة الثابتة (lawyer.html / index.html) وتحقن فيها العنوان والوصف والـcanonical والـSchema
// ومحتوى نصي فيه روابط حقيقية، والجافاسكريبت بيكمّل بعد كده زي ما هو.
// مفيش أي رقم تليفون بيتحط هنا. البيانات كلها من public_lawyers (عام بطبيعته).
const SU = 'https://qlboprdqnjvsmcwfpjwl.supabase.co';
const SK = 'sb_publishable_i-9FiXSNKe5xf_mEawmEfQ_PjSjf2_i';
const SITE_NAME = 'Legano';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATS = { rent: 'إيجارات وعقارات', labor: 'عمالي', criminal: 'جنائي', family: 'أحوال شخصية', contracts: 'عقود وتحكيم', commercial: 'تجاري وشركات', other: 'قضايا متنوعة' };
const GOVS = ['القاهرة','الجيزة','الإسكندرية','القليوبية','الشرقية','الدقهلية','الغربية','المنوفية','البحيرة','كفر الشيخ','دمياط','بورسعيد','الإسماعيلية','السويس','الفيوم','بني سويف','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان','البحر الأحمر','الوادي الجديد','مطروح','شمال سيناء','جنوب سيناء'];
const COLS = 'id,display_name,city,served,specialties,bio,experience_years,license_level,photo_path,verified,rating_avg,rating_count,rating_score';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ld = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const photo = p => p ? `${SU}/storage/v1/object/public/lawyer-photos/${p.split('/').map(encodeURIComponent).join('/')}` : '';

function origin(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  return `https://${host}`;
}
async function sb(path) {
  const r = await fetch(`${SU}/rest/v1/${path}`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
  if (!r.ok) throw new Error('supabase ' + r.status);
  return r.json();
}
async function rpcSb(fn, body) {
  const r = await fetch(`${SU}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  if (!r.ok) throw new Error('supabase rpc ' + r.status);
  return r.json();
}
async function page(base, file) {
  const r = await fetch(`${base}/${file}`, { headers: { 'x-seo-internal': '1' } });
  if (!r.ok) throw new Error('static ' + r.status);
  return r.text();
}
const listUrl = (cat, city) => '/lawyers' + (cat ? '/' + cat : '') + (city ? '/' + encodeURIComponent(city) : '');
const lawyerUrl = id => '/lawyer/' + id;

// بيحقن الـhead والمحتوى. base href علشان المسارات النسبية (js/…) تشتغل من /lawyer/xxx و/lawyers/a/b
function inject(html, { title, desc, canonical, image, robots, jsonld, ssr, anchor, preset }) {
  let head = `<base href="/">\n<title>${esc(title)}</title>\n<meta name="description" content="${esc(desc)}">\n<link rel="canonical" href="${esc(canonical)}">\n`
    + `<meta name="robots" content="${robots || 'index,follow,max-image-preview:large'}">\n`
    + `<meta property="og:type" content="website"><meta property="og:locale" content="ar_EG"><meta property="og:site_name" content="${SITE_NAME}">\n`
    + `<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}">\n`
    + (image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">\n` : '<meta name="twitter:card" content="summary">\n')
    + (preset ? `<script>window.__SEO=${ld(preset)};</script>\n` : '')
    + (jsonld || []).map(o => `<script type="application/ld+json">${ld(o)}</script>`).join('\n');
  html = html.replace(/<title>[\s\S]*?<\/title>\s*/i, '').replace(/<meta name="description"[^>]*>\s*/i, '');
  html = html.replace(/<script>try\{if\(localStorage\.getItem\("lg_s"\)[^<]*<\/script>\s*/i, ''); // تحويل المحامي المسجّل للفيد ما ينفعش على صفحات السيو
  html = html.replace(/<head>/i, `<head>\n${head}\n`);
  if (ssr) html = html.replace(anchor, m => m + ssr);
  return html;
}

const send = (res, code, type, body, cache) => {
  res.statusCode = code; res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cache || 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.end(body);
};

async function robots(req, res, base) {
  const dis = ['feed', 'dashboard', 'cases', 'calendar', 'referrals', 'groups', 'group', 'notifications', 'track', 'register', 'room', 'consultations', 'consult'].map(p => `Disallow: /${p}.html`).join('\n');
  send(res, 200, 'text/plain; charset=utf-8', `User-agent: *\nAllow: /\n${dis}\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`);
}

async function sitemap(req, res, base) {
  const rows = await sb(`public_lawyers?select=id,city,served,specialties&limit=5000`);
  const urls = new Set([base + '/']);
  const combos = new Set();
  for (const l of rows) {
    urls.add(base + lawyerUrl(l.id));
    const places = new Set([l.city, ...(l.served || [])].filter(g => GOVS.includes(g)));
    for (const c of (l.specialties || []).filter(k => CATS[k])) {
      combos.add(c);
      for (const g of places) combos.add(c + '|' + g);
    }
  }
  for (const k of combos) { const [c, g] = k.split('|'); urls.add(base + listUrl(c, g)); }
  urls.add(base + '/qa');
  for (const k of Object.keys(CATS)) urls.add(base + '/qa/c/' + k);
  try { for (const q of await rpcSb('qa_sitemap')) urls.add(base + '/qa/' + q.id); } catch {}
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + [...urls].slice(0, 45000).map(u => `<url><loc>${esc(u)}</loc></url>`).join('\n') + '\n</urlset>\n';
  send(res, 200, 'application/xml; charset=utf-8', xml);
}

async function lawyer(req, res, base, id) {
  if (!UUID.test(id || '')) return send(res, 404, 'text/plain; charset=utf-8', 'غير موجود', 'public, s-maxage=60');
  const [rows, html] = await Promise.all([sb(`public_lawyers?select=${COLS}&id=eq.${id}`), page(base, 'lawyer.html')]);
  const l = rows[0];
  if (!l) return send(res, 404, 'text/html; charset=utf-8', inject(html, { title: 'المحامي غير موجود | ' + SITE_NAME, desc: 'البروفايل ده مش متاح.', canonical: base + '/', robots: 'noindex,follow' }), 'public, s-maxage=60');
  const cats = (l.specialties || []).map(k => CATS[k]).filter(Boolean);
  const places = [...new Set([l.city, ...(l.served || [])].filter(Boolean))];
  const what = cats.length ? cats.slice(0, 2).join(' و') : 'محاماة';
  const title = `${l.display_name} - محامي ${what}${l.city ? ' في ' + l.city : ''} | ${SITE_NAME}`;
  const bits = [l.verified ? 'محامي موثّق' : 'محامي', cats.length ? 'متخصص في ' + cats.join('، ') : '', places.length ? 'يخدم ' + places.slice(0, 4).join('، ') : '', l.experience_years ? `خبرة ${l.experience_years} سنة` : '', l.rating_count ? `تقييم ${Number(l.rating_avg).toFixed(1)} من ${l.rating_count} موكل` : ''].filter(Boolean);
  const desc = cut(bits.join(' • ') + '. ' + (l.bio || 'تواصل مباشرة بالاتصال أو الواتساب.'), 158);
  const canonical = base + lawyerUrl(l.id);
  const person = { '@context': 'https://schema.org', '@type': 'Attorney', name: l.display_name, url: canonical, description: cut(l.bio, 300) || undefined, image: photo(l.photo_path) || undefined,
    address: l.city ? { '@type': 'PostalAddress', addressLocality: l.city, addressCountry: 'EG' } : undefined, areaServed: places.map(p => ({ '@type': 'AdministrativeArea', name: p })), knowsAbout: cats };
  if (l.rating_count > 0) person.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(l.rating_avg).toFixed(1), reviewCount: l.rating_count, bestRating: 5, worstRating: 1 };
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: SITE_NAME, item: base + '/' }, { '@type': 'ListItem', position: 2, name: 'المحامين', item: base + '/lawyers' }, { '@type': 'ListItem', position: 3, name: l.display_name, item: canonical }] };
  const ssr = `<article id="ssr" class="py-8"><h1 class="text-2xl font-extrabold">${esc(l.display_name)}${l.verified ? ' (موثّق)' : ''}</h1><p class="mt-2 text-sm">${esc(bits.join(' • '))}</p>${l.bio ? `<p class="mt-3 text-sm">${esc(l.bio)}</p>` : ''}`
    + (cats.length ? `<p class="mt-3 text-sm">${cats.map(k => { const key = Object.keys(CATS).find(x => CATS[x] === k); return `<a href="${listUrl(key, l.city)}">محامي ${esc(k)}${l.city ? ' في ' + esc(l.city) : ''}</a>`; }).join(' • ')}</p>` : '') + '</article>';
  send(res, 200, 'text/html; charset=utf-8', inject(html, { title, desc, canonical, image: photo(l.photo_path), jsonld: [person, crumbs], ssr, anchor: /<div id="app"[^>]*>/ }));
}

async function list(req, res, base, cat, city) {
  if (cat && !CATS[cat]) return send(res, 404, 'text/plain; charset=utf-8', 'غير موجود', 'public, s-maxage=60');
  if (city && !GOVS.includes(city)) return send(res, 404, 'text/plain; charset=utf-8', 'غير موجود', 'public, s-maxage=60');
  let q = `public_lawyers?select=${COLS}&order=rating_score.desc.nullslast,verified.desc&limit=30`;
  if (cat) q += `&specialties=cs.${encodeURIComponent('{' + cat + '}')}`;
  if (city) q += `&or=${encodeURIComponent(`(city.eq."${city}",served.cs.{"${city}"})`)}`;
  const [rows, html] = await Promise.all([sb(q), page(base, 'index.html')]);
  const what = cat ? CATS[cat] : '';
  const title = `أفضل محامي ${what}${city ? ' في ' + city : ''} | ${SITE_NAME}`.replace('محامي  ', 'محامي ');
  const desc = rows.length
    ? cut(`${rows.length} محامي ${what}${city ? ' في ' + city : ''} على ${SITE_NAME}: ${rows.slice(0, 3).map(r => r.display_name).join('، ')}. قارن بين التقييمات والتخصصات وتواصل مباشرة بالاتصال أو الواتساب.`, 158)
    : `ابحث عن محامي ${what}${city ? ' في ' + city : ''} على ${SITE_NAME} وتواصل مباشرة.`;
  const canonical = base + listUrl(cat, city);
  const items = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: rows.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: base + lawyerUrl(r.id), name: r.display_name })) };
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: SITE_NAME, item: base + '/' }, ...(cat ? [{ '@type': 'ListItem', position: 2, name: what, item: base + listUrl(cat) }] : []), ...(city ? [{ '@type': 'ListItem', position: cat ? 3 : 2, name: city, item: canonical }] : [])] };
  const others = Object.keys(CATS).filter(k => k !== cat).map(k => `<a href="${listUrl(k, city)}">${esc(CATS[k])}</a>`).join(' • ');
  const ssr = `<section id="ssr" class="mx-auto max-w-4xl px-4 py-6"><h2 class="text-xl font-extrabold">${esc(title.replace(' | ' + SITE_NAME, ''))}</h2><ul class="mt-3 space-y-2 text-sm">${rows.map(r => `<li><a href="${lawyerUrl(r.id)}"><b>${esc(r.display_name)}</b></a> — ${esc([(r.specialties || []).map(k => CATS[k]).filter(Boolean).join('، '), r.city].filter(Boolean).join(' • '))}${r.rating_count ? ` • ★${Number(r.rating_avg).toFixed(1)}` : ''}</li>`).join('')}</ul><p class="mt-3 text-sm">${others}</p></section>`;
  // قايمة فاضية = صفحة رفيعة، ما نخليش جوجل يفهرسها
  send(res, 200, 'text/html; charset=utf-8', inject(html, { title, desc, canonical, jsonld: rows.length ? [items, crumbs] : [crumbs], ssr, anchor: /<div id="lawyerGrid"[^>]*>/, preset: { cat: cat || 'all', city: city || '' }, robots: rows.length ? undefined : 'noindex,follow' }));
}

// ---------- اسأل محامي ----------
const qaTemplate = async base => (await page(base, 'qa.html')).replace(/<meta name="robots"[^>]*>\s*/i, '').replace(/(<div id="qaApp">)<p[^>]*>[\s\S]*?<\/p>/i, '$1');
const qaUrl = id => '/qa/' + id;

async function qaList(req, res, base, cat) {
  if (cat && !CATS[cat]) return send(res, 404, 'text/plain; charset=utf-8', 'غير موجود', 'public, s-maxage=60');
  const [rows, html] = await Promise.all([rpcSb('qa_list', { p_category: cat || null, p_q: null, p_unanswered: false, p_limit: 30, p_offset: 0 }), qaTemplate(base)]);
  const what = cat ? CATS[cat] : '';
  const title = `اسأل محامي${what ? ' - ' + what : ''} مجاناً | ${SITE_NAME}`;
  const desc = cut(`اكتب سؤالك القانوني${what ? ' في ' + what : ''} مجاناً وتلاقي إجابة من محامين موثّقين. ${rows.slice(0, 2).map(r => r.title).join(' • ')}`, 158);
  const canonical = base + '/qa' + (cat ? '/c/' + cat : '');
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: SITE_NAME, item: base + '/' }, { '@type': 'ListItem', position: 2, name: 'اسأل محامي', item: base + '/qa' }, ...(cat ? [{ '@type': 'ListItem', position: 3, name: what, item: canonical }] : [])] };
  const ssr = `<section id="ssr"><h1>اسأل محامي${what ? ' - ' + esc(what) : ''}</h1><ul>${rows.map(r => `<li><a href="${qaUrl(r.id)}">${esc(r.title)}</a> — ${esc(CATS[r.category] || '')}${r.answers_count ? ` • ${r.answers_count} إجابة` : ''}</li>`).join('')}</ul></section>`;
  send(res, 200, 'text/html; charset=utf-8', inject(html, { title, desc, canonical, jsonld: [crumbs], ssr, anchor: /<div id="qaApp">/, preset: { cat: cat || '' } }), 'public, s-maxage=120, stale-while-revalidate=600');
}

async function question(req, res, base, id) {
  if (!UUID.test(id || '')) return send(res, 404, 'text/plain; charset=utf-8', 'غير موجود', 'public, s-maxage=60');
  const [q, html] = await Promise.all([rpcSb('qa_get', { p_id: id }), qaTemplate(base)]);
  if (!q) return send(res, 404, 'text/html; charset=utf-8', inject(html, { title: 'السؤال غير متاح | ' + SITE_NAME, desc: 'السؤال ده مش متاح.', canonical: base + '/qa', robots: 'noindex,follow', preset: { q: '' } }), 'public, s-maxage=60');
  const answers = q.answers || [];
  const title = cut(q.title, 70) + ' | اسأل محامي - ' + SITE_NAME;
  const desc = cut(answers.length ? `${answers[0].lawyer.display_name}: ${answers[0].body}` : q.body, 158);
  const canonical = base + qaUrl(q.id);
  const qa = { '@context': 'https://schema.org', '@type': 'QAPage', mainEntity: { '@type': 'Question', name: q.title, text: q.body, answerCount: answers.length, dateCreated: q.created_at, author: { '@type': 'Person', name: q.asker_name || 'زائر' },
    suggestedAnswer: answers.map(a => ({ '@type': 'Answer', text: a.body, dateCreated: a.created_at, url: canonical + '#a-' + a.id, author: { '@type': 'Person', name: a.lawyer.display_name, url: base + lawyerUrl(a.lawyer.id) } })) } };
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: SITE_NAME, item: base + '/' }, { '@type': 'ListItem', position: 2, name: 'اسأل محامي', item: base + '/qa' }, { '@type': 'ListItem', position: 3, name: CATS[q.category] || 'سؤال', item: base + '/qa/c/' + q.category }] };
  const ssr = `<article id="ssr"><h1>${esc(q.title)}</h1><p>${esc(q.body)}</p>${answers.map(a => `<section id="a-${esc(a.id)}"><h2>إجابة ${esc(a.lawyer.display_name)}</h2><p>${esc(a.body)}</p><a href="${lawyerUrl(a.lawyer.id)}">${esc(a.lawyer.display_name)}</a></section>`).join('')}</article>`;
  // سؤال من غير إجابات = محتوى رفيع، ما نفهرسوش لحد ما محامي يجاوب
  send(res, 200, 'text/html; charset=utf-8', inject(html, { title, desc, canonical, jsonld: answers.length ? [qa, crumbs] : [crumbs], ssr, anchor: /<div id="qaApp">/, preset: { q: q.id }, robots: answers.length ? undefined : 'noindex,follow' }), 'public, s-maxage=300, stale-while-revalidate=1800');
}

module.exports = async (req, res) => {
  try {
    const base = origin(req);
    if (!base) return send(res, 400, 'text/plain', 'bad host', 'no-store');
    const q = req.query || Object.fromEntries(new URL(req.url, base).searchParams);
    const r = q.r;
    if (r === 'robots') return await robots(req, res, base);
    if (r === 'sitemap') return await sitemap(req, res, base);
    if (r === 'lawyer') return await lawyer(req, res, base, String(q.id || ''));
    if (r === 'list') return await list(req, res, base, String(q.cat || ''), (() => { const c = String(q.city || ''); try { return decodeURIComponent(c); } catch { return c; } })());
    if (r === 'qa_list') return await qaList(req, res, base, String(q.cat || ''));
    if (r === 'question') return await question(req, res, base, String(q.id || ''));
    return send(res, 404, 'text/plain', 'not found', 'no-store');
  } catch (e) {
    send(res, 502, 'text/plain; charset=utf-8', 'خطأ مؤقت، جرّب تاني', 'no-store');
  }
};

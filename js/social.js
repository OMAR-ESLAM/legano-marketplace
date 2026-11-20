// الطبقة الاجتماعية: منشورات (بجمهور محدد)، ريأكشنز، كومنتات وردود، متابعة، إشعارات، مشاهدات، وتقييم المحامين.
// بتشتغل فوق جداول Supabase والـ RLS الموجودة، ومفيش أي صلاحية بتتفرض من هنا (الحماية على السيرفر).
(() => {
  const SB = 'https://qlboprdqnjvsmcwfpjwl.supabase.co';
  const KEY = 'sb_publishable_i-9FiXSNKe5xf_mEawmEfQ_PjSjf2_i';
  const SKEY = 'lg_s'; // نفس مفتاح الجلسة اللي بتستخدمه لوحة المحامي
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const TOPICS = [
    ['rent', 'إيجارات وعقارات'], ['labor', 'عمالي'], ['criminal', 'جنائي'], ['family', 'أحوال شخصية'],
    ['contracts', 'عقود وتحكيم'], ['commercial', 'تجاري وشركات'], ['other', 'حاجة تانية'],
  ];
  const topicLabel = k => (TOPICS.find(t => t[0] === k) || [])[1] || '';
  // جمهور المنشور: مين يقدر يشوفه (السيرفر هو اللي بيفرض ده)
  const AUDIENCES = [
    ['lawyers', 'المحامين فقط', 'زمايلك المحامين بس هما اللي هيشوفوه.'],
    ['clients', 'الموكلين فقط', 'هيظهر للموكلين وسط نتايج البحث، ومش هيظهر لزمايلك.'],
    ['all', 'المحامين والموكلين', 'الكل يقدر يشوفه.'],
  ];
  const audLabel = k => (AUDIENCES.find(a => a[0] === k) || [])[1] || '';
  const REACTIONS = [
    ['like', '👍', 'إعجاب'], ['love', '❤️', 'أحببته'], ['insightful', '💡', 'مفيد'], ['support', '🤝', 'دعم'], ['celebrate', '👏', 'برافو'],
  ];
  const RX = Object.fromEntries(REACTIONS.map(r => [r[0], r]));

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(SKEY)); } catch { return null; } },
    set(v) { try { v ? localStorage.setItem(SKEY, JSON.stringify(v)) : localStorage.removeItem(SKEY); } catch {} },
  };
  const pref = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  let S = store.get();
  const me = () => (S && S.user ? S.user.id : null);

  // ---------- الجلسة والطلبات ----------
  let refreshing = null;
  async function freshToken() {
    if (!S) return KEY;
    const exp = S.expires_at ? S.expires_at * 1000 : 0;
    if (exp && exp - Date.now() < 60000 && S.refresh_token) {
      refreshing = refreshing || (async () => {
        try {
          const r = await fetch(`${SB}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: S.refresh_token }) });
          const j = await r.json();
          if (r.ok && j.access_token) { S = j; store.set(j); } else { S = null; store.set(null); }
        } catch {}
        refreshing = null;
      })();
      await refreshing;
    }
    return S ? S.access_token : KEY;
  }
  async function call(path, o = {}) {
    const tok = await freshToken();
    const headers = { apikey: KEY, Authorization: 'Bearer ' + tok, ...(o.json ? { 'Content-Type': 'application/json' } : {}), ...(o.headers || {}) };
    const r = await fetch(SB + path, { method: o.method || 'GET', headers, body: o.json ? JSON.stringify(o.json) : o.body });
    const t = await r.text();
    let j = null; if (t) { try { j = JSON.parse(t); } catch { j = t; } }
    if (!r.ok) {
      const e = new Error((j && (j.message || j.msg || j.error_description || j.error)) || 'HTTP ' + r.status);
      e.status = r.status; e.code = j && j.code; throw e;
    }
    return o.raw ? { data: j, res: r } : j;
  }
  function friendly(e) {
    const m = String((e && e.message) || '');
    if (/group_limit/.test(m)) return 'وصلت للحد الأقصى: 5 جروبات لكل محامي.';
    if (/not_member/.test(m)) return 'لازم تنضم للجروب الأول علشان تنشر فيه.';
    if (/contact_first/.test(m)) return 'تقدر تقيّم المحامي بعد ما تتصل بيه أو تبعتله واتساب من هنا.';
    if (/lawyers_cannot_rate/.test(m)) return 'التقييم للموكلين بس.';
    if (e && (e.code === '42501' || /row-level security|permission denied/i.test(m))) return 'علشان تتفاعل لازم بروفايلك يكون ظاهر للزوار. فعّله من لوحتك.';
    if (/rate|limit|too many|تجاوزت/i.test(m)) return 'بتعمل حاجات كتير بسرعة، استنى شوية وحاول تاني.';
    if (/JWT|expired/i.test(m)) return 'الجلسة خلصت، سجّل دخول تاني.';
    if (e && e.message === 'big') return 'الصورة أكبر من 5MB.';
    return 'حصل خطأ، حاول تاني.';
  }

  // ---------- عناصر مشتركة ----------
  let toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'soc-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }
  function needLogin() { toast('سجّل دخول الأول علشان تتفاعل.'); setTimeout(() => { if (confirm('تروح لصفحة الدخول؟')) location.href = 'dashboard.html'; }, 300); }

  const badge = (cls = '') => `<svg class="vbadge ${cls}" viewBox="0 0 24 24" role="img" aria-label="حساب موثّق"><title>حساب موثّق</title><path d="M12 1.6l2.5 1.8 3.1-.1.9 3 2.5 1.9-1 2.9 1 2.9-2.5 1.9-.9 3-3.1-.1L12 22.4l-2.5-1.8-3.1.1-.9-3-2.5-1.9 1-2.9-1-2.9 2.5-1.9.9-3 3.1.1z" fill="#1D9BF0"/><path d="M7.7 12.3l3 3 5.6-6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const photoUrl = p => (p ? `${SB}/storage/v1/object/public/lawyer-photos/${p.split('/').map(encodeURIComponent).join('/')}` : '');
  const imageUrl = p => `${SB}/storage/v1/object/public/post-images/${p.split('/').map(encodeURIComponent).join('/')}`;
  function avatar(a, size = '') {
    const name = (a && a.display_name) || '';
    const init = esc(name.replace(/^(أ\.?|د\.?|المستشار)\s*/, '').trim().charAt(0) || '؟');
    const u = a && photoUrl(a.photo_path);
    return `<span class="avatar ${size}" aria-hidden="true">${u ? `<img src="${esc(u)}" alt="" loading="lazy">` : init}</span>`;
  }
  function ago(d) {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60) return 'دلوقتي';
    const m = s / 60; if (m < 60) return `من ${Math.floor(m)} دقيقة`;
    const h = m / 60; if (h < 24) return `من ${Math.floor(h)} ساعة`;
    const dd = h / 24; if (dd < 30) return `من ${Math.floor(dd)} يوم`;
    return new Date(d).toLocaleDateString('ar-EG');
  }
  const nameHTML = a => `<a class="who" href="lawyer.html?id=${esc(a.id)}">${esc(a.display_name || 'محامي')}${a.verified ? badge() : ''}</a>`;
  const num = n => Number(n || 0).toLocaleString('ar-EG');

  // نجوم التقييم (كسور النجمة بتتحسب بالـ CSS من --p)
  function stars(avg, count, big) {
    const c = Number(count || 0), a = Number(avg || 0);
    if (!c) return '<span class="rate-new">جديد على المنصة</span>';
    const f = a.toLocaleString('ar-EG', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `<span class="rate ${big ? 'lg' : ''}"><span class="starbar" style="--p:${Math.max(0, Math.min(100, a / 5 * 100))}%" aria-hidden="true">★★★★★</span><b>${f}</b><span class="rate-c">(${num(c)})</span><span class="sr-only">تقييم ${f} من 5 من ${num(c)} موكل</span></span>`;
  }

  // ---------- قراءة ----------
  async function authors(ids) {
    ids = [...new Set(ids.filter(x => UUID.test(x || '')))];
    if (!ids.length) return {};
    const rows = await call(`/rest/v1/public_lawyers?select=id,display_name,city,specialties,photo_path,verified&id=in.(${ids.join(',')})`);
    return Object.fromEntries(rows.map(r => [r.id, r]));
  }
  const EMPTY = () => ({ posts: [], authors: {}, liked: new Map() });
  async function listPosts({ authorId, groupId, mode, topic, before, id, limit = 10 } = {}) {
    let q = `/rest/v1/posts?select=*&status=eq.visible&order=created_at.desc&limit=${limit}`;
    if (id) { if (!UUID.test(id)) return EMPTY(); q += `&id=eq.${id}`; }
    else if (groupId) { if (!UUID.test(groupId)) return EMPTY(); q += `&group_id=eq.${groupId}`; }
    else q += '&group_id=is.null'; // منشورات الجروبات ما بتظهرش في الفيد العام
    if (authorId) { if (!UUID.test(authorId)) return EMPTY(); q += `&author_id=eq.${authorId}`; }
    if (topic && TOPICS.some(t => t[0] === topic)) q += `&topic=eq.${topic}`;
    if (before) q += `&created_at=lt.${encodeURIComponent(before)}`;
    if (mode === 'following') {
      if (!me()) return EMPTY();
      const f = await call(`/rest/v1/follows?select=following_id&follower_id=eq.${me()}`);
      if (!f.length) return EMPTY();
      q += `&author_id=in.(${f.map(x => x.following_id).join(',')})`;
    }
    const raw = await call(q);
    const au = await authors(raw.map(p => p.author_id));
    const posts = raw.filter(p => au[p.author_id]); // بنخفي منشورات الحسابات الموقوفة/المخفية
    const liked = new Map();
    if (me() && posts.length) {
      try { (await call(`/rest/v1/post_likes?select=post_id,reaction&post_id=in.(${posts.map(p => p.id).join(',')})`)).forEach(x => liked.set(x.post_id, x.reaction)); } catch {}
    }
    return { posts, authors: au, liked, last: raw.length ? raw[raw.length - 1].created_at : null, more: raw.length === limit };
  }

  // ---------- كتابة ----------
  async function createPost({ body, topic, file, audience, groupId }) {
    let image_path = null;
    if (file) {
      if (!/^image\//.test(file.type)) throw new Error('type');
      if (file.size > 5e6) throw new Error('big');
      const ext = ((file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg').slice(0, 5);
      image_path = `${me()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await call(`/storage/v1/object/post-images/${image_path}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
    }
    const aud = AUDIENCES.some(a => a[0] === audience) ? audience : 'all';
    const rows = await call('/rest/v1/posts', { method: 'POST', json: { author_id: me(), body, topic: topic || null, image_path, audience: groupId ? 'lawyers' : aud, ...(groupId ? { group_id: groupId } : {}) }, headers: { Prefer: 'return=representation' } });
    return rows[0];
  }
  async function deletePost(p) {
    await call(`/rest/v1/posts?id=eq.${p.id}`, { method: 'DELETE' });
    if (p.image_path) call(`/storage/v1/object/post-images/${p.image_path}`, { method: 'DELETE' }).catch(() => {});
  }
  // next = null يعني شيل التفاعل. prev = التفاعل الحالي (لو فيه)
  async function setReaction(postId, next, prev) {
    const row = `/rest/v1/post_likes?post_id=eq.${postId}&user_id=eq.${me()}`;
    if (!next) return call(row, { method: 'DELETE' });
    if (prev) return call(row, { method: 'PATCH', json: { reaction: next }, headers: { Prefer: 'return=minimal' } });
    try { await call('/rest/v1/post_likes', { method: 'POST', json: { post_id: postId, user_id: me(), reaction: next }, headers: { Prefer: 'return=minimal' } }); }
    catch (e) { if (e.code === '23505') return call(row, { method: 'PATCH', json: { reaction: next }, headers: { Prefer: 'return=minimal' } }); throw e; }
  }
  const follow = id => call('/rest/v1/follows', { method: 'POST', json: { follower_id: me(), following_id: id }, headers: { Prefer: 'return=minimal' } }).catch(e => { if (e.code !== '23505') throw e; });
  const unfollow = id => call(`/rest/v1/follows?follower_id=eq.${me()}&following_id=eq.${id}`, { method: 'DELETE' });
  const report = (post_id, comment_id, reason) => call('/rest/v1/post_reports', { method: 'POST', json: { post_id, comment_id: comment_id || null, reporter_id: me(), reason: reason ? reason.slice(0, 300) : null }, headers: { Prefer: 'return=minimal' } });
  async function listComments(post_id) {
    const rows = await call(`/rest/v1/post_comments?select=*&post_id=eq.${post_id}&order=created_at.asc&limit=300`);
    return { rows, authors: await authors(rows.map(r => r.author_id)) };
  }
  async function addComment(post_id, body, extra = {}) {
    const json = { post_id, author_id: me(), body };
    if (extra.parent_id) json.parent_id = extra.parent_id;
    if (extra.reply_to_id) json.reply_to_id = extra.reply_to_id;
    const r = await call('/rest/v1/post_comments', { method: 'POST', json, headers: { Prefer: 'return=representation' } });
    return r[0];
  }
  const deleteComment = id => call(`/rest/v1/post_comments?id=eq.${id}`, { method: 'DELETE' });
  const profileSocial = id => call('/rest/v1/rpc/get_profile_social', { method: 'POST', json: { p_lawyer: id } });

  // ---------- التقييم (للموكلين بس، بعد التواصل مع المحامي) ----------
  let devMem = null;
  function deviceId() {
    let d = pref.get('lg_dev');
    if (!d || d.length < 16) {
      d = devMem || (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
      pref.set('lg_dev', d);
    }
    devMem = d; return d;
  }
  const ratingStatus = id => call('/rest/v1/rpc/rating_status', { method: 'POST', json: { p_lawyer: id, p_device: deviceId() } });
  const rate = (id, n) => call('/rest/v1/rpc/rate_lawyer', { method: 'POST', json: { p_lawyer: id, p_stars: n, p_device: deviceId() } });

  // ---------- المشاهدات: نجمّع الـ ids ونبعتها دفعة واحدة ----------
  const seen = new Set(); let pending = new Set(), flushT;
  function flushViews() {
    if (!pending.size) return;
    const ids = [...pending]; pending = new Set();
    call('/rest/v1/rpc/track_post_views', { method: 'POST', json: { p_ids: ids } }).catch(() => {});
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      const id = e.target.dataset.id; io.unobserve(e.target);
      if (id && !seen.has(id)) { seen.add(id); pending.add(id); clearTimeout(flushT); flushT = setTimeout(flushViews, 1500); }
    });
  }, { threshold: 0.6 }) : null;
  addEventListener('pagehide', flushViews);

  // ---------- الإشعارات ----------
  async function unreadCount() {
    if (!me()) return 0;
    try {
      const { res } = await call('/rest/v1/notifications?select=id&read=eq.false', { raw: true, headers: { Prefer: 'count=exact', Range: '0-0' } });
      return Number((res.headers.get('content-range') || '').split('/')[1]) || 0;
    } catch { return 0; }
  }
  async function listNotifications() {
    const rows = await call('/rest/v1/notifications?select=*&order=created_at.desc&limit=60');
    const au = await authors(rows.map(r => r.actor_id));
    const pids = [...new Set(rows.map(r => r.post_id).filter(Boolean))];
    let posts = {};
    if (pids.length) { try { posts = Object.fromEntries((await call(`/rest/v1/posts?select=id,body&id=in.(${pids.join(',')})`)).map(p => [p.id, p.body])); } catch {} }
    return { rows, authors: au, posts };
  }
  const markAllRead = () => call('/rest/v1/notifications?read=eq.false', { method: 'PATCH', json: { read: true }, headers: { Prefer: 'return=minimal' } });

  const BELL = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/></svg>';
  // الزائر (الموكل) مفيش له منشورات ولا إشعارات. المحامي بيشوف المنشورات وسوق المحامين والجرس ولوحته.
  async function mountNav(el) {
    if (!el) return;
    if (!me()) { if (!el.children.length) el.innerHTML = '<a href="register.html" class="btn-ghost-link">سجّل كمحامي</a><a href="dashboard.html" class="btn-ghost-link">دخول المحامين</a>'; return; }
    el.innerHTML = `<a href="feed.html" class="btn-ghost-link">المنشورات</a><a href="groups.html" class="btn-ghost-link">الجروبات</a><a href="index.html?browse=1" class="btn-ghost-link">سوق المحامين</a><a href="notifications.html" class="nav-bell" aria-label="الإشعارات">${BELL}<span class="nav-dot" hidden></span></a><a href="dashboard.html" class="btn-ghost-link">لوحتي</a>`;
    const n = await unreadCount();
    const dot = el.querySelector('.nav-dot');
    if (n && dot) { dot.textContent = n > 99 ? '99+' : n; dot.hidden = false; }
  }

  // ---------- كارت المنشور ----------
  const SHORT = 320;
  const THUMB = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7 11l4-8a2.5 2.5 0 0 1 2.500 2.800L13 9h6a2 2 0 0 1 2 2.300l-1.300 7A2 2 0 0 1 17.700 20H7"/></svg>';
  const CHAT = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.800 7L3 20.500l1.600-5.100A8 8 0 1 1 21 12z"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/></svg>';

  function rxSummary(p) {
    if (!p.likes_count) return '';
    const rx = p.reactions || {};
    const keys = Object.keys(rx).filter(k => RX[k] && rx[k] > 0).sort((a, b) => rx[b] - rx[a]);
    const tip = keys.map(k => `${RX[k][2]} ${num(rx[k])}`).join('، ');
    return `<span class="rx-sum" title="${esc(tip)}"><span class="rx-emo" aria-hidden="true">${keys.slice(0, 3).map(k => RX[k][1]).join('')}</span><span>${num(p.likes_count)}</span><span class="sr-only"> تفاعل</span></span>`;
  }
  function reactBtnHTML(cur) {
    const r = cur ? RX[cur] : null;
    return r ? `<span class="rx-e" aria-hidden="true">${r[1]}</span>${r[2]}` : `${THUMB}إعجاب`;
  }
  function cardHTML(p, a, st, o) {
    const mine = p.author_id === me();
    const long = p.body.length > SHORT;
    const text = esc(long ? p.body.slice(0, SHORT).trimEnd() + '…' : p.body);
    const sub = [a.city, topicLabel(p.topic)].filter(Boolean).map(esc).join(' • ');
    const cur = st.liked.get(p.id);
    const audChip = mine && p.audience && p.audience !== 'all' ? `<span class="aud-chip" title="مين يشوف المنشور">${esc(audLabel(p.audience))}</span>` : (mine ? '<span class="aud-chip all" title="مين يشوف المنشور">للكل</span>' : (p.audience === 'lawyers' ? '<span class="aud-chip" title="المنشور ده للمحامين بس">للمحامين</span>' : ''));
    const actions = o.readonly
      ? `<button type="button" data-act="comments">${CHAT}تعليقات</button><button type="button" data-act="share">${SHARE}مشاركة</button>${o.noProfileLink ? '' : `<a class="act-link" href="lawyer.html?id=${esc(a.id)}">عرض البروفايل والتواصل</a>`}`
      : `<div class="rx-wrap"><button type="button" data-act="react" class="rx-main ${cur ? 'on' : ''}" aria-haspopup="menu" aria-pressed="${!!cur}" aria-label="تفاعل (اضغط مطولاً أو مرّر الماوس لاختيار تفاعل تاني)">${reactBtnHTML(cur)}</button>
          <div class="rx-pop" role="menu" aria-label="اختار تفاعل" hidden>${REACTIONS.map(x => `<button type="button" role="menuitem" data-act="pick" data-rx="${x[0]}" aria-label="${x[2]}"><span>${x[1]}</span><i>${x[2]}</i></button>`).join('')}</div></div>
        <button type="button" data-act="comments">${CHAT}تعليق</button>
        <button type="button" data-act="share">${SHARE}مشاركة</button>
        ${mine ? '<button type="button" data-act="delete" class="danger">حذف</button>' : '<button type="button" data-act="report" class="danger">إبلاغ</button>'}`;
    return `<article class="post-card" data-id="${p.id}" data-author="${p.author_id}">
      <header class="post-head">
        <a href="lawyer.html?id=${esc(a.id)}">${avatar(a)}</a>
        <div class="post-meta">${nameHTML(a)}<div class="post-sub">${sub ? sub + ' • ' : ''}<time datetime="${esc(p.created_at)}">${ago(p.created_at)}</time></div></div>
        ${audChip}
      </header>
      <div class="post-body" data-full="${esc(p.body)}">${text}</div>${long ? '<button type="button" class="more" data-act="expand">اقرأ المزيد</button>' : ''}
      ${p.image_path ? `<img class="post-img" src="${esc(imageUrl(p.image_path))}" alt="" loading="lazy">` : ''}
      <div class="post-stats"><span data-r="likes">${rxSummary(p)}</span><span data-r="comments">${num(p.comments_count)} تعليق</span>${mine ? `<span title="المشاهدات تظهر لصاحب المنشور بس">${num(p.views_count)} مشاهدة</span>` : ''}</div>
      <div class="post-actions ${o.readonly ? 'ro' : ''}">${actions}</div>
      <section class="cm" hidden></section>
    </article>`;
  }

  // ---------- الكومنتات والردود ----------
  const authOf = (au, c) => au[c.author_id] || { id: c.author_id, display_name: 'محامي' };
  function commentHTML(c, a, ctx) {
    const can = me() && (c.author_id === me() || ctx.postAuthor === me());
    const tools = [
      ctx.readonly ? '' : '<button type="button" data-act="creply">رد</button>',
      !me() ? '' : (can ? '<button type="button" data-act="cdel">حذف</button>' : '<button type="button" data-act="crep">إبلاغ</button>'),
    ].join('');
    return `<div class="cmt ${ctx.reply ? 'reply' : ''}" data-cid="${c.id}">${avatar(a, 'sm')}<div class="cmt-b"><div class="cmt-h">${nameHTML(a)}<time>${ago(c.created_at)}</time></div><div class="cmt-t">${esc(c.body)}</div><div class="cmt-a">${tools}</div></div></div>`;
  }
  function threadHTML(root, replies, au, ctx) {
    return `<div class="cmt-thread" data-root="${root.id}">${commentHTML(root, authOf(au, root), ctx)}<div class="cmt-replies">${replies.map(r => commentHTML(r, authOf(au, r), { ...ctx, reply: true })).join('')}</div><div class="cmt-rform" hidden></div></div>`;
  }
  function threadsHTML(rows, au, ctx) {
    const kids = {};
    rows.filter(r => r.parent_id).forEach(r => { (kids[r.parent_id] = kids[r.parent_id] || []).push(r); });
    return rows.filter(r => !r.parent_id).map(r => threadHTML(r, kids[r.id] || [], au, ctx)).join('');
  }

  // ---------- تحديث الكارت ----------
  function applyLocal(p, prev, next) {
    const rx = p.reactions = { ...(p.reactions || {}) };
    if (prev) { rx[prev] = (rx[prev] || 1) - 1; if (rx[prev] <= 0) delete rx[prev]; }
    if (next) rx[next] = (rx[next] || 0) + 1;
    p.likes_count = Math.max(0, (p.likes_count || 0) + (next ? 1 : 0) - (prev ? 1 : 0));
  }
  function paintReaction(card, p, st) {
    const cur = st.liked.get(p.id), btn = card.querySelector('.rx-main');
    if (btn) { btn.innerHTML = reactBtnHTML(cur); btn.classList.toggle('on', !!cur); btn.setAttribute('aria-pressed', !!cur); }
    card.querySelector('[data-r=likes]').innerHTML = rxSummary(p);
  }
  const paintCount = (card, p) => { card.querySelector('[data-r=comments]').textContent = `${num(p.comments_count)} تعليق`; };
  const showPop = w => { const pop = w.querySelector('.rx-pop'); if (pop) pop.hidden = false; };
  const hidePop = w => { const pop = w.querySelector('.rx-pop'); if (pop) pop.hidden = true; };
  document.addEventListener('click', e => { document.querySelectorAll('.rx-pop:not([hidden])').forEach(p => { if (!p.parentNode.contains(e.target)) p.hidden = true; }); });

  // بيضيف الكروت للـ container ويربط الأحداث مرة واحدة بالتفويض
  function mount(container, data, opts = {}) {
    const st = container.__st = container.__st || { authors: {}, liked: new Map(), posts: {} };
    const o = { readonly: opts.readonly !== undefined ? opts.readonly : !me(), noProfileLink: !!opts.noProfileLink };
    container.__o = o;
    Object.assign(st.authors, data.authors); (data.liked || new Map()).forEach((v, k) => st.liked.set(k, v));
    const html = data.posts.map(p => { st.posts[p.id] = p; return cardHTML(p, st.authors[p.author_id], st, o); }).join('');
    container.insertAdjacentHTML(opts.prepend ? 'afterbegin' : 'beforeend', html);
    if (io) container.querySelectorAll('.post-card').forEach(c => io.observe(c));
    if (container.__bound) return;
    container.__bound = true;

    // فتح قايمة التفاعلات: ماوس (تأخير بسيط) / ضغطة مطوّلة على الموبايل / سهم لفوق بالكيبورد
    container.addEventListener('mouseover', e => { const w = e.target.closest('.rx-wrap'); if (!w || w.contains(e.relatedTarget)) return; clearTimeout(w._h); w._s = setTimeout(() => showPop(w), 320); });
    container.addEventListener('mouseout', e => { const w = e.target.closest('.rx-wrap'); if (!w || w.contains(e.relatedTarget)) return; clearTimeout(w._s); w._h = setTimeout(() => hidePop(w), 260); });
    container.addEventListener('touchstart', e => { const w = e.target.closest('.rx-main') && e.target.closest('.rx-wrap'); if (!w) return; w._lp = false; w._t = setTimeout(() => { w._lp = true; showPop(w); }, 420); }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(t => container.addEventListener(t, e => { const w = e.target.closest('.rx-wrap'); if (w) clearTimeout(w._t); }, { passive: true }));
    container.addEventListener('contextmenu', e => { if (e.target.closest('.rx-main')) e.preventDefault(); });
    container.addEventListener('keydown', e => {
      const w = e.target.closest('.rx-wrap'); if (!w) return;
      if (e.key === 'ArrowUp' && e.target.classList.contains('rx-main')) { e.preventDefault(); showPop(w); w.querySelector('.rx-pop button')?.focus(); }
      else if (e.key === 'Escape') { hidePop(w); w.querySelector('.rx-main')?.focus(); }
    });

    container.addEventListener('click', async ev => {
      const btn = ev.target.closest('[data-act]'); if (!btn) return;
      const card = btn.closest('.post-card'); const p = st.posts[card.dataset.id]; const act = btn.dataset.act;
      try {
        if (act === 'expand') { card.querySelector('.post-body').textContent = p.body; btn.remove(); }
        else if (act === 'react' || act === 'pick') {
          if (!me()) return needLogin();
          const w = btn.closest('.rx-wrap');
          if (act === 'react' && w._lp) { w._lp = false; return; } // الضغطة المطوّلة فتحت القايمة بس
          const prev = st.liked.get(p.id) || null;
          const next = act === 'pick' ? btn.dataset.rx : (prev ? null : 'like');
          hidePop(w);
          if (next === prev) return;
          // تحديث فوري، وبنرجّعه لو السيرفر رفض
          const undo = () => { applyLocal(p, next, prev); prev ? st.liked.set(p.id, prev) : st.liked.delete(p.id); paintReaction(card, p, st); };
          applyLocal(p, prev, next); next ? st.liked.set(p.id, next) : st.liked.delete(p.id); paintReaction(card, p, st);
          try { await setReaction(p.id, next, prev); } catch (e) { undo(); toast(friendly(e)); }
        }
        else if (act === 'comments') openComments(card, p, st, o);
        else if (act === 'share') {
          const url = new URL(`${me() ? 'feed' : 'lawyer'}.html?${me() ? 'post=' + p.id : 'id=' + p.author_id}`, location.href).href;
          if (navigator.share) { try { await navigator.share({ url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
          try { await navigator.clipboard.writeText(url); toast('تم نسخ الرابط'); } catch { toast(url); }
        }
        else if (act === 'delete') {
          if (!confirm('تحذف المنشور ده نهائياً؟')) return;
          await deletePost(p); card.remove(); toast('اتحذف المنشور');
          if (opts.onDelete) opts.onDelete(p);
        }
        else if (act === 'report') {
          if (!me()) return needLogin();
          const r = prompt('سبب الإبلاغ (اختياري):'); if (r === null) return;
          await report(p.id, null, r.trim()); toast('وصلنا بلاغك، شكراً');
        }
        else if (act === 'cdel') {
          const row = btn.closest('.cmt'); const thread = btn.closest('.cmt-thread');
          if (!confirm('تحذف التعليق؟')) return;
          await deleteComment(row.dataset.cid);
          // حذف تعليق رئيسي بيمسح الردود اللي عليه كمان
          const gone = thread && !row.classList.contains('reply') ? thread.querySelectorAll('.cmt').length : 1;
          if (thread && !row.classList.contains('reply')) thread.remove(); else row.remove();
          p.comments_count = Math.max(0, p.comments_count - gone); paintCount(card, p);
        }
        else if (act === 'crep') {
          if (!me()) return needLogin();
          const r = prompt('سبب الإبلاغ (اختياري):'); if (r === null) return;
          await report(p.id, btn.closest('.cmt').dataset.cid, r.trim()); toast('وصلنا بلاغك، شكراً');
        }
        else if (act === 'creply') openReplyForm(btn, card, p, st);
      } catch (e) { toast(friendly(e)); }
    });
  }

  async function myAuthor(st) {
    if (st.me) return st.me;
    st.me = (await authors([me()]).catch(() => ({})))[me()] || { id: me(), display_name: (S.user.user_metadata || {}).display_name || 'أنا' };
    return st.me;
  }

  async function openComments(card, p, st, o) {
    const box = card.querySelector('.cm');
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    if (box.dataset.ready) return;
    box.dataset.ready = '1'; box.innerHTML = '<div class="cm-load">بنحمّل التعليقات…</div>';
    try {
      const { rows, authors: au } = await listComments(p.id);
      Object.assign(st.authors, au);
      const ctx = { postAuthor: p.author_id, readonly: o.readonly };
      const list = threadsHTML(rows, au, ctx);
      box.innerHTML = `<div class="cm-list">${list || '<div class="cm-empty">مفيش تعليقات لسه.</div>'}</div>
        ${o.readonly ? '<div class="cm-empty ro-note">التعليق متاح للمحامين المسجّلين بس.</div>' : (me() ? '<div class="cm-form"><textarea rows="1" maxlength="1000" placeholder="اكتب تعليقك…" aria-label="تعليقك"></textarea><button type="button" class="soc-btn primary">نشر</button></div>' : '<div class="cm-empty"><a href="dashboard.html">سجّل دخول</a> علشان تعلّق.</div>')}`;
      const ta = box.querySelector('.cm-form textarea'), go = box.querySelector('.cm-form .soc-btn');
      if (!ta) return;
      const send = async () => {
        const body = ta.value.trim(); if (!body) return;
        go.disabled = true;
        try {
          const c = await addComment(p.id, body);
          const l = box.querySelector('.cm-list'); l.querySelector('.cm-empty')?.remove();
          l.insertAdjacentHTML('beforeend', threadHTML(c, [], { [me()]: await myAuthor(st) }, ctx));
          ta.value = ''; p.comments_count++; paintCount(card, p);
        } catch (e) { toast(friendly(e)); }
        go.disabled = false;
      };
      go.onclick = send;
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    } catch (e) { box.dataset.ready = ''; box.innerHTML = `<div class="cm-empty">${esc(friendly(e))}</div>`; }
  }

  // الرد على كومنت: الرد دايماً بيتحط تحت الكومنت الرئيسي (زي فيسبوك)، والإشعار بيروح لصاحب الكومنت اللي اتردّ عليه
  function openReplyForm(btn, card, p, st) {
    if (!me()) return needLogin();
    const thread = btn.closest('.cmt-thread'), target = btn.closest('.cmt'), form = thread.querySelector('.cmt-rform');
    const isReply = target.classList.contains('reply');
    const tName = target.querySelector('.who')?.firstChild?.textContent || '';
    form.dataset.to = isReply ? target.dataset.cid : '';
    form.hidden = false;
    form.innerHTML = `<div class="cm-form"><textarea rows="1" maxlength="1000" placeholder="رد على ${esc(tName.trim())}…" aria-label="اكتب ردك"></textarea><button type="button" class="soc-btn primary">رد</button><button type="button" class="soc-btn" data-x>إلغاء</button></div>`;
    const ta = form.querySelector('textarea'), go = form.querySelector('.primary'); ta.focus();
    form.querySelector('[data-x]').onclick = () => { form.hidden = true; form.innerHTML = ''; };
    const send = async () => {
      const body = ta.value.trim(); if (!body) return;
      go.disabled = true;
      try {
        const c = await addComment(p.id, body, { parent_id: thread.dataset.root, reply_to_id: form.dataset.to || null });
        thread.querySelector('.cmt-replies').insertAdjacentHTML('beforeend', commentHTML(c, await myAuthor(st), { postAuthor: p.author_id, readonly: false, reply: true }));
        form.hidden = true; form.innerHTML = ''; p.comments_count++; paintCount(card, p);
      } catch (e) { toast(friendly(e)); go.disabled = false; }
    };
    go.onclick = send;
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } else if (e.key === 'Escape') form.querySelector('[data-x]').click(); });
  }

  // ---------- صندوق كتابة المنشور (شريط مختصر + نافذة زي فيسبوك) ----------
  const lastAud = () => { const v = pref.get('lg_aud'); return AUDIENCES.some(a => a[0] === v) ? v : 'all'; };

  function openComposeModal(meA, onPosted, opener, grp) {
    const ov = document.createElement('div'); ov.className = 'modal-ov';
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle">
      <div class="modal-h"><h2 id="mTitle">إنشاء منشور</h2><button type="button" class="modal-x" aria-label="إغلاق">×</button></div>
      <div class="modal-b">
        <div class="m-who">${avatar(meA)}<b>${esc(meA.display_name || '')}${meA.verified ? badge() : ''}</b></div>
        ${grp ? `<p class="m-grp">بتنشر في جروب <b>${esc(grp.name)}</b>. المنشور هيظهر لأعضاء الجروب بس.</p>` : `<fieldset class="aud"><legend>مين يشوف المنشور ده؟</legend>
          ${AUDIENCES.map(a => `<label class="aud-opt"><input type="radio" name="aud" value="${a[0]}" ${a[0] === lastAud() ? 'checked' : ''}><span><b>${a[1]}</b><small>${a[2]}</small></span></label>`).join('')}
        </fieldset>`}
        <textarea id="mBody" rows="5" maxlength="3000" placeholder="شارك معلومة قانونية أو خبرة من شغلك…" aria-label="نص المنشور"></textarea>
        <div id="mPrev" class="c-prev" hidden><img alt=""><button type="button" aria-label="شيل الصورة">×</button></div>
        <div class="composer-bar">
          <label class="soc-btn attach"><input id="mFile" type="file" accept="image/*" hidden>إضافة صورة</label>
          <select id="mTopic" aria-label="التصنيف"><option value="">التصنيف (اختياري)</option>${TOPICS.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select>
          <span id="mCount" class="c-count">0 / 3000</span>
        </div>
        <p id="mNote" class="m-note" hidden>المنشورات اللي الموكلين بيشوفوها لازم تلتزم بقواعد نقابة المحامين في الإعلان: من غير مبالغة ولا وعود بنتايج.</p>
      </div>
      <div class="modal-f"><button id="mGo" type="button" class="soc-btn primary" disabled>نشر</button></div>
    </div>`;
    document.body.appendChild(ov);
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const $ = s => ov.querySelector(s), body = $('#mBody'), go = $('#mGo'), file = $('#mFile'), prev = $('#mPrev');
    const close = () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; ov.remove(); opener && opener.focus(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    $('.modal-x').onclick = close;
    const aud = () => grp ? 'lawyers' : (ov.querySelector('input[name=aud]:checked') || {}).value || 'all';
    const sync = () => { $('#mCount').textContent = `${body.value.length} / 3000`; go.disabled = !body.value.trim(); $('#mNote').hidden = aud() === 'lawyers'; };
    ov.querySelectorAll('input[name=aud]').forEach(r => r.addEventListener('change', sync));
    body.addEventListener('input', sync); sync();
    file.addEventListener('change', () => {
      const f = file.files[0]; if (!f) return;
      if (f.size > 5e6 || !/^image\//.test(f.type)) { file.value = ''; return toast('اختار صورة أقل من 5MB'); }
      prev.querySelector('img').src = URL.createObjectURL(f); prev.hidden = false;
    });
    prev.querySelector('button').onclick = () => { file.value = ''; prev.hidden = true; };
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'بننشر…';
      try {
        const a = aud(); if (!grp) pref.set('lg_aud', a);
        const p = await createPost({ body: body.value.trim(), topic: $('#mTopic').value, file: file.files[0], audience: a, groupId: grp && grp.id });
        toast('اتنشر المنشور'); close(); onPosted && onPosted(p, meA);
      } catch (e) { toast(friendly(e)); go.textContent = 'نشر'; sync(); }
    };
    body.focus();
  }

  async function mountComposer(el, onPosted, grp) {
    if (!me()) {
      el.innerHTML = '<div class="composer-guest"><b>شارك خبرتك مع زمايلك المحامين.</b><span>سجّل دخول علشان تنشر وتعلّق وتتابع.</span><a class="soc-btn primary" href="dashboard.html">دخول المحامين</a><a class="soc-btn" href="register.html">سجّل كمحامي</a></div>';
      return;
    }
    const meA = (await authors([me()]).catch(() => ({})))[me()] || { id: me(), display_name: (S.user.user_metadata || {}).display_name || '' };
    const first = (meA.display_name || '').replace(/^(أ\.?|د\.?|المستشار)\s*/, '').trim().split(/\s+/)[0] || '';
    el.innerHTML = `<div class="comp-trig">${avatar(meA)}<button type="button" class="comp-input">بتفكر في إيه${first ? ' يا أستاذ ' + esc(first) : ''}؟</button><button type="button" class="comp-photo" aria-label="إضافة صورة للمنشور">${'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>'}</button></div>`;
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => openComposeModal(meA, onPosted, b, grp)));
  }

  // ---------- منشورات بروفايل المحامي ----------
  async function mountProfilePosts(root, lawyer) {
    if (!root) return;
    const isMe = me() === lawyer.id;
    root.innerHTML = `${isMe ? '<div id="pComposer" class="soc-card composer-card"></div>' : ''}<div id="profPosts"></div><div class="feed-foot"><button id="profMore" type="button" class="soc-btn" hidden>عرض المزيد</button></div>`;
    const list = root.querySelector('#profPosts'), more = root.querySelector('#profMore'); let cur = null;
    const mo = { noProfileLink: true };
    if (isMe) mountComposer(root.querySelector('#pComposer'), p => {
      list.querySelector('.empty')?.remove();
      listPosts({ id: p.id, limit: 1 }).then(d => mount(list, d, { ...mo, prepend: true }));
    });
    async function page() {
      more.disabled = true;
      try {
        const d = await listPosts({ authorId: lawyer.id, before: cur, limit: 8 });
        if (!d.posts.length && !cur) list.innerHTML = `<div class="empty">${isMe ? 'لسه منشرتش حاجة. اكتب أول منشور من الشريط اللي فوق.' : 'المحامي ده لسه منشرش حاجة.'}</div>`;
        else mount(list, d, mo);
        cur = d.last; more.hidden = !d.more;
      } catch { list.insertAdjacentHTML('beforeend', '<div class="empty">تعذر تحميل المنشورات.</div>'); }
      more.disabled = false;
    }
    more.onclick = page; page();
  }

  // ---------- الجروبات ----------
  const GCOLS = 'id,name,description,owner_id,member_count,created_at';
  const listGroups = async ({ q } = {}) => {
    let url = `/rest/v1/groups?select=${GCOLS}&order=member_count.desc,created_at.desc&limit=60`;
    const t = (q || '').trim().replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 40);
    if (t) url += `&name=ilike.*${encodeURIComponent(t)}*`;
    return call(url);
  };
  const myGroups = async () => {
    if (!me()) return [];
    const m = await call(`/rest/v1/group_members?select=group_id&lawyer_id=eq.${me()}`);
    if (!m.length) return [];
    return call(`/rest/v1/groups?select=${GCOLS}&id=in.(${m.map(x => x.group_id).join(',')})&order=member_count.desc`);
  };
  const getGroup = async id => UUID.test(id || '') ? (await call(`/rest/v1/groups?select=${GCOLS}&id=eq.${id}`))[0] || null : null;
  const createGroup = async ({ name, description }) => (await call('/rest/v1/groups', { method: 'POST', json: { name: name.trim(), description: (description || '').trim() || null, owner_id: me() }, headers: { Prefer: 'return=representation' } }))[0];
  const joinGroup = id => call('/rest/v1/group_members', { method: 'POST', json: { group_id: id, lawyer_id: me() } });
  const leaveGroup = id => call(`/rest/v1/group_members?group_id=eq.${id}&lawyer_id=eq.${me()}`, { method: 'DELETE' });
  const deleteGroup = id => call(`/rest/v1/groups?id=eq.${id}`, { method: 'DELETE' });
  const addGroupMember = (gid, lid) => call('/rest/v1/group_members', { method: 'POST', json: { group_id: gid, lawyer_id: lid } });
  const removeGroupMember = (gid, lid) => call(`/rest/v1/group_members?group_id=eq.${gid}&lawyer_id=eq.${lid}`, { method: 'DELETE' });
  const searchLawyers = async q => {
    const t = (q || '').trim().replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 40);
    if (t.length < 2) return [];
    return call(`/rest/v1/public_lawyers?select=id,display_name,city,photo_path,verified&display_name=ilike.*${encodeURIComponent(t)}*&limit=8`);
  };
  const groupMembers = async id => {
    const m = await call(`/rest/v1/group_members?select=lawyer_id,role&group_id=eq.${id}&order=joined_at.asc&limit=100`);
    const au = await authors(m.map(x => x.lawyer_id));
    return m.map(x => ({ ...x, a: au[x.lawyer_id] })).filter(x => x.a);
  };

  window.Social = {
    addGroupMember, removeGroupMember, searchLawyers, listGroups, myGroups, getGroup, createGroup, joinGroup, leaveGroup, deleteGroup, groupMembers,
    me, call, esc, badge, avatar, ago, num, stars, toast, needLogin, friendly, TOPICS, AUDIENCES, REACTIONS, topicLabel, audLabel,
    listPosts, mount, mountComposer, mountNav, mountProfilePosts, profileSocial, follow, unfollow,
    unreadCount, listNotifications, markAllRead, nameHTML, ratingStatus, rate, deviceId, photoUrl,
  };
})();

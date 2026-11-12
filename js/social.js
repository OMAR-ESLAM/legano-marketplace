// الطبقة الاجتماعية: منشورات، لايكات، كومنتات، متابعة، إشعارات، مشاهدات.
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

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(SKEY)); } catch { return null; } },
    set(v) { try { v ? localStorage.setItem(SKEY, JSON.stringify(v)) : localStorage.removeItem(SKEY); } catch {} },
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

  // ---------- قراءة ----------
  async function authors(ids) {
    ids = [...new Set(ids.filter(x => UUID.test(x || '')))];
    if (!ids.length) return {};
    const rows = await call(`/rest/v1/public_lawyers?select=id,display_name,city,specialties,photo_path,verified&id=in.(${ids.join(',')})`);
    return Object.fromEntries(rows.map(r => [r.id, r]));
  }
  async function listPosts({ authorId, mode, topic, before, id, limit = 10 } = {}) {
    let q = `/rest/v1/posts?select=*&status=eq.visible&order=created_at.desc&limit=${limit}`;
    if (id) { if (!UUID.test(id)) return { posts: [], authors: {}, liked: new Set() }; q += `&id=eq.${id}`; }
    if (authorId) { if (!UUID.test(authorId)) return { posts: [], authors: {}, liked: new Set() }; q += `&author_id=eq.${authorId}`; }
    if (topic && TOPICS.some(t => t[0] === topic)) q += `&topic=eq.${topic}`;
    if (before) q += `&created_at=lt.${encodeURIComponent(before)}`;
    if (mode === 'following') {
      if (!me()) return { posts: [], authors: {}, liked: new Set() };
      const f = await call(`/rest/v1/follows?select=following_id&follower_id=eq.${me()}`);
      if (!f.length) return { posts: [], authors: {}, liked: new Set() };
      q += `&author_id=in.(${f.map(x => x.following_id).join(',')})`;
    }
    const raw = await call(q);
    const au = await authors(raw.map(p => p.author_id));
    const posts = raw.filter(p => au[p.author_id]); // بنخفي منشورات الحسابات الموقوفة/المخفية
    let liked = new Set();
    if (me() && posts.length) {
      try { liked = new Set((await call(`/rest/v1/post_likes?select=post_id&post_id=in.(${posts.map(p => p.id).join(',')})`)).map(x => x.post_id)); } catch {}
    }
    return { posts, authors: au, liked, last: raw.length ? raw[raw.length - 1].created_at : null, more: raw.length === limit };
  }

  // ---------- كتابة ----------
  async function createPost({ body, topic, file }) {
    let image_path = null;
    if (file) {
      if (!/^image\//.test(file.type)) throw new Error('type');
      if (file.size > 5e6) throw new Error('big');
      const ext = ((file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg').slice(0, 5);
      image_path = `${me()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await call(`/storage/v1/object/post-images/${image_path}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
    }
    const rows = await call('/rest/v1/posts', { method: 'POST', json: { author_id: me(), body, topic: topic || null, image_path }, headers: { Prefer: 'return=representation' } });
    return rows[0];
  }
  async function deletePost(p) {
    await call(`/rest/v1/posts?id=eq.${p.id}`, { method: 'DELETE' });
    if (p.image_path) call(`/storage/v1/object/post-images/${p.image_path}`, { method: 'DELETE' }).catch(() => {});
  }
  const like = id => call('/rest/v1/post_likes', { method: 'POST', json: { post_id: id, user_id: me() }, headers: { Prefer: 'return=minimal' } }).catch(e => { if (e.code !== '23505') throw e; });
  const unlike = id => call(`/rest/v1/post_likes?post_id=eq.${id}&user_id=eq.${me()}`, { method: 'DELETE' });
  const follow = id => call('/rest/v1/follows', { method: 'POST', json: { follower_id: me(), following_id: id }, headers: { Prefer: 'return=minimal' } }).catch(e => { if (e.code !== '23505') throw e; });
  const unfollow = id => call(`/rest/v1/follows?follower_id=eq.${me()}&following_id=eq.${id}`, { method: 'DELETE' });
  const report = (post_id, comment_id, reason) => call('/rest/v1/post_reports', { method: 'POST', json: { post_id, comment_id: comment_id || null, reporter_id: me(), reason: reason ? reason.slice(0, 300) : null }, headers: { Prefer: 'return=minimal' } });
  async function listComments(post_id) {
    const rows = await call(`/rest/v1/post_comments?select=*&post_id=eq.${post_id}&order=created_at.asc&limit=100`);
    return { rows, authors: await authors(rows.map(r => r.author_id)) };
  }
  async function addComment(post_id, body) {
    const r = await call('/rest/v1/post_comments', { method: 'POST', json: { post_id, author_id: me(), body }, headers: { Prefer: 'return=representation' } });
    return r[0];
  }
  const deleteComment = id => call(`/rest/v1/post_comments?id=eq.${id}`, { method: 'DELETE' });
  const profileSocial = id => call('/rest/v1/rpc/get_profile_social', { method: 'POST', json: { p_lawyer: id } });

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
  async function mountNav(el) {
    if (!el) return;
    if (!me()) { el.insertAdjacentHTML('afterbegin', '<a href="feed.html" class="btn-ghost-link">المنشورات</a>'); return; }
    el.innerHTML = `<a href="feed.html" class="btn-ghost-link">المنشورات</a><a href="notifications.html" class="nav-bell" aria-label="الإشعارات">${BELL}<span class="nav-dot" hidden></span></a><a href="dashboard.html" class="btn-ghost-link">لوحتي</a>`;
    const n = await unreadCount();
    const dot = el.querySelector('.nav-dot');
    if (n && dot) { dot.textContent = n > 99 ? '99+' : n; dot.hidden = false; }
  }

  // ---------- كارت المنشور ----------
  const SHORT = 320;
  function cardHTML(p, a, st) {
    const mine = p.author_id === me();
    const long = p.body.length > SHORT;
    const text = esc(long ? p.body.slice(0, SHORT).trimEnd() + '…' : p.body);
    const sub = [a.city, topicLabel(p.topic)].filter(Boolean).map(esc).join(' • ');
    return `<article class="post-card" data-id="${p.id}" data-author="${p.author_id}">
      <header class="post-head">
        <a href="lawyer.html?id=${esc(a.id)}">${avatar(a)}</a>
        <div class="post-meta">${nameHTML(a)}<div class="post-sub">${sub ? sub + ' • ' : ''}<time datetime="${esc(p.created_at)}">${ago(p.created_at)}</time></div></div>
      </header>
      <div class="post-body" data-full="${esc(p.body)}">${text}</div>${long ? '<button type="button" class="more" data-act="expand">اقرأ المزيد</button>' : ''}
      ${p.image_path ? `<img class="post-img" src="${esc(imageUrl(p.image_path))}" alt="" loading="lazy">` : ''}
      <div class="post-stats"><span data-r="likes">${num(p.likes_count)} إعجاب</span><span data-r="comments">${num(p.comments_count)} تعليق</span>${mine ? `<span title="المشاهدات تظهر لصاحب المنشور بس">${num(p.views_count)} مشاهدة</span>` : ''}</div>
      <div class="post-actions">
        <button type="button" data-act="like" class="${st.liked.has(p.id) ? 'on' : ''}" aria-pressed="${st.liked.has(p.id)}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.4 3 5 6.3 5c2 0 3.3 1 5.7 3.3C14.4 6 15.700 5 17.700 5 21 5 22.800 8.400 21.500 11.700 19.500 16.400 12 21 12 21z"/></svg>إعجاب</button>
        <button type="button" data-act="comments"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.800 7L3 20.500l1.600-5.100A8 8 0 1 1 21 12z"/></svg>تعليق</button>
        <button type="button" data-act="share"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/></svg>مشاركة</button>
        ${mine ? '<button type="button" data-act="delete" class="danger">حذف</button>' : '<button type="button" data-act="report" class="danger">إبلاغ</button>'}
      </div>
      <section class="cm" hidden></section>
    </article>`;
  }
  function commentHTML(c, a, postAuthor) {
    const can = c.author_id === me() || postAuthor === me();
    return `<div class="cmt" data-cid="${c.id}">${avatar(a, 'sm')}<div class="cmt-b"><div class="cmt-h">${nameHTML(a)}<time>${ago(c.created_at)}</time></div><div class="cmt-t">${esc(c.body)}</div>
      <div class="cmt-a">${can ? '<button type="button" data-act="cdel">حذف</button>' : '<button type="button" data-act="crep">إبلاغ</button>'}</div></div></div>`;
  }

  // بيضيف الكروت للـ container ويربط الأحداث مرة واحدة بالتفويض
  function mount(container, data, opts = {}) {
    const st = container.__st = container.__st || { authors: {}, liked: new Set(), posts: {} };
    Object.assign(st.authors, data.authors); data.liked.forEach(x => st.liked.add(x));
    const html = data.posts.map(p => { st.posts[p.id] = p; return cardHTML(p, st.authors[p.author_id], st); }).join('');
    container.insertAdjacentHTML(opts.prepend ? 'afterbegin' : 'beforeend', html);
    if (io) container.querySelectorAll('.post-card').forEach(c => io.observe(c));
    if (container.__bound) return;
    container.__bound = true;
    container.addEventListener('click', async ev => {
      const btn = ev.target.closest('[data-act]'); if (!btn) return;
      const card = btn.closest('.post-card'); const p = st.posts[card.dataset.id]; const act = btn.dataset.act;
      try {
        if (act === 'expand') { card.querySelector('.post-body').textContent = p.body; btn.remove(); }
        else if (act === 'like') {
          if (!me()) return needLogin();
          const on = !st.liked.has(p.id); btn.disabled = true;
          // تحديث فوري، وبنرجّعه لو السيرفر رفض
          const set = v => { v ? st.liked.add(p.id) : st.liked.delete(p.id); p.likes_count = Math.max(0, p.likes_count + (v ? 1 : -1)); btn.classList.toggle('on', v); btn.setAttribute('aria-pressed', v); card.querySelector('[data-r=likes]').textContent = `${num(p.likes_count)} إعجاب`; };
          set(on);
          try { await (on ? like(p.id) : unlike(p.id)); } catch (e) { set(!on); toast(friendly(e)); }
          btn.disabled = false;
        }
        else if (act === 'comments') openComments(card, p, st);
        else if (act === 'share') {
          const url = new URL(`feed.html?post=${p.id}`, location.href).href;
          if (navigator.share) { try { await navigator.share({ url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
          try { await navigator.clipboard.writeText(url); toast('تم نسخ رابط المنشور'); } catch { toast(url); }
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
          const row = btn.closest('.cmt');
          if (!confirm('تحذف التعليق؟')) return;
          await deleteComment(row.dataset.cid); row.remove(); p.comments_count = Math.max(0, p.comments_count - 1);
          card.querySelector('[data-r=comments]').textContent = `${num(p.comments_count)} تعليق`;
        }
        else if (act === 'crep') {
          if (!me()) return needLogin();
          const r = prompt('سبب الإبلاغ (اختياري):'); if (r === null) return;
          await report(p.id, btn.closest('.cmt').dataset.cid, r.trim()); toast('وصلنا بلاغك، شكراً');
        }
      } catch (e) { toast(friendly(e)); }
    });
  }

  async function openComments(card, p, st) {
    const box = card.querySelector('.cm');
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    if (box.dataset.ready) return;
    box.dataset.ready = '1'; box.innerHTML = '<div class="cm-load">بنحمّل التعليقات…</div>';
    try {
      const { rows, authors: au } = await listComments(p.id);
      Object.assign(st.authors, au);
      const list = rows.map(c => commentHTML(c, au[c.author_id] || { id: c.author_id, display_name: 'محامي' }, p.author_id)).join('');
      box.innerHTML = `<div class="cm-list">${list || '<div class="cm-empty">مفيش تعليقات لسه. كن أول واحد يعلّق.</div>'}</div>
        ${me() ? '<div class="cm-form"><textarea rows="1" maxlength="1000" placeholder="اكتب تعليقك…" aria-label="تعليقك"></textarea><button type="button" class="soc-btn primary">نشر</button></div>' : '<div class="cm-empty"><a href="dashboard.html">سجّل دخول</a> علشان تعلّق.</div>'}`;
      const ta = box.querySelector('textarea'), go = box.querySelector('.cm-form .soc-btn');
      if (!ta) return;
      const send = async () => {
        const body = ta.value.trim(); if (!body) return;
        go.disabled = true;
        try {
          const c = await addComment(p.id, body);
          const me0 = (await authors([me()]))[me()] || { id: me(), display_name: (S.user.user_metadata || {}).display_name || 'أنا' };
          const l = box.querySelector('.cm-list'); l.querySelector('.cm-empty')?.remove();
          l.insertAdjacentHTML('beforeend', commentHTML(c, me0, p.author_id));
          ta.value = ''; p.comments_count++; card.querySelector('[data-r=comments]').textContent = `${num(p.comments_count)} تعليق`;
        } catch (e) { toast(friendly(e)); }
        go.disabled = false;
      };
      go.onclick = send;
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    } catch (e) { box.dataset.ready = ''; box.innerHTML = `<div class="cm-empty">${esc(friendly(e))}</div>`; }
  }

  // ---------- صندوق كتابة المنشور ----------
  async function mountComposer(el, onPosted) {
    if (!me()) {
      el.innerHTML = '<div class="composer-guest"><b>شارك خبرتك مع زمايلك المحامين.</b><span>سجّل دخول علشان تنشر وتعلّق وتتابع.</span><a class="soc-btn primary" href="dashboard.html">دخول المحامين</a><a class="soc-btn" href="register.html">سجّل كمحامي</a></div>';
      return;
    }
    const meA = (await authors([me()]).catch(() => ({})))[me()] || { display_name: (S.user.user_metadata || {}).display_name || '' };
    el.innerHTML = `<div class="composer-row">${avatar(meA)}<textarea id="cBody" rows="3" maxlength="3000" placeholder="شارك معلومة قانونية أو خبرة من شغلك…" aria-label="نص المنشور"></textarea></div>
      <div id="cPrev" class="c-prev" hidden><img alt=""><button type="button" aria-label="شيل الصورة">×</button></div>
      <div class="composer-bar">
        <label class="soc-btn attach"><input id="cFile" type="file" accept="image/*" hidden>إضافة صورة</label>
        <select id="cTopic" aria-label="التصنيف"><option value="">التصنيف (اختياري)</option>${TOPICS.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select>
        <span id="cCount" class="c-count">0 / 3000</span>
        <button id="cGo" type="button" class="soc-btn primary" disabled>نشر</button>
      </div>`;
    const $ = s => el.querySelector(s), body = $('#cBody'), go = $('#cGo'), file = $('#cFile'), prev = $('#cPrev');
    const sync = () => { $('#cCount').textContent = `${body.value.length} / 3000`; go.disabled = !body.value.trim(); };
    body.addEventListener('input', sync);
    file.addEventListener('change', () => {
      const f = file.files[0]; if (!f) return;
      if (f.size > 5e6 || !/^image\//.test(f.type)) { file.value = ''; return toast('اختار صورة أقل من 5MB'); }
      prev.querySelector('img').src = URL.createObjectURL(f); prev.hidden = false;
    });
    prev.querySelector('button').onclick = () => { file.value = ''; prev.hidden = true; };
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'بننشر…';
      try {
        const p = await createPost({ body: body.value.trim(), topic: $('#cTopic').value, file: file.files[0] });
        body.value = ''; file.value = ''; prev.hidden = true; $('#cTopic').value = ''; sync();
        toast('اتنشر المنشور');
        onPosted && onPosted(p, meA);
      } catch (e) { toast(friendly(e)); }
      go.textContent = 'نشر'; sync();
    };
  }

  // ---------- جزء المنشورات في بروفايل المحامي ----------
  async function mountProfileSocial(root, lawyer) {
    if (!root) return;
    const isMe = me() === lawyer.id;
    let st = null; try { st = await profileSocial(lawyer.id); } catch {}
    st = st || { followers: 0, following: 0, posts: 0, views: 0, i_follow: false };
    const stat = (n, l) => `<div class="ps"><b>${num(n)}</b><span>${l}</span></div>`;
    root.innerHTML = `<div class="ps-row">${stat(st.followers, 'متابع')}${stat(st.following, 'بيتابع')}${stat(st.posts, 'منشور')}${isMe ? stat(st.views, 'مشاهدة') : ''}
      <div class="ps-act">${isMe ? '<a class="soc-btn primary" href="feed.html">اكتب منشور</a>' : `<button id="fBtn" type="button" class="soc-btn ${st.i_follow ? '' : 'primary'}">${st.i_follow ? 'بتتابعه ✓' : 'متابعة'}</button>`}</div></div>
      <div id="profPosts"></div><div class="feed-foot"><button id="profMore" type="button" class="soc-btn" hidden>عرض المزيد</button></div>`;
    const fBtn = root.querySelector('#fBtn');
    if (fBtn) fBtn.onclick = async () => {
      if (!me()) return needLogin();
      fBtn.disabled = true;
      try {
        if (st.i_follow) { await unfollow(lawyer.id); st.i_follow = false; st.followers = Math.max(0, st.followers - 1); }
        else { await follow(lawyer.id); st.i_follow = true; st.followers++; }
        fBtn.textContent = st.i_follow ? 'بتتابعه ✓' : 'متابعة'; fBtn.classList.toggle('primary', !st.i_follow);
        root.querySelector('.ps b').textContent = num(st.followers);
      } catch (e) { toast(friendly(e)); }
      fBtn.disabled = false;
    };
    const list = root.querySelector('#profPosts'), more = root.querySelector('#profMore'); let cur = null;
    async function page() {
      more.disabled = true;
      try {
        const d = await listPosts({ authorId: lawyer.id, before: cur, limit: 8 });
        if (!d.posts.length && !cur) list.innerHTML = '<div class="empty">المحامي ده لسه منشرش حاجة.</div>';
        else mount(list, d);
        cur = d.last; more.hidden = !d.more;
      } catch { list.insertAdjacentHTML('beforeend', '<div class="empty">تعذر تحميل المنشورات.</div>'); }
      more.disabled = false;
    }
    more.onclick = page; page();
  }

  window.Social = { me, call, esc, badge, avatar, ago, num, toast, needLogin, friendly, TOPICS, topicLabel, listPosts, mount, mountComposer, mountNav, mountProfileSocial, unreadCount, listNotifications, markAllRead, nameHTML };
})();

// تفعيل الإشعارات + تثبيت الموقع كتطبيق (PWA). الاستخدام: Push.mount(element)
(() => {
  'use strict';
  const VAPID = 'BOm9arFMQ3k9axgNhe179YUq95IgirOILm5X_Q7uV6pX0IYPT-mdy9MGuzV_B2g_zTaD7gigGzCBlvc4XNUch60';
  const S = () => window.Social, ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
  let deferred = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; try { document.dispatchEvent(new Event('lg-install-ready')); } catch {} });

  const reg = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(() => navigator.serviceWorker.ready);

  async function current() { if (!supported()) return null; try { return await (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription() || null; } catch { return null; } }

  async function save(sub) {
    const j = sub.toJSON();
    await S().call('/rest/v1/rpc/push_save', { method: 'POST', json: { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: ua.slice(0, 150) } });
  }
  async function enable() {
    if (!supported()) throw new Error('unsupported');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('denied');
    const r = await reg();
    let sub = await r.pushManager.getSubscription();
    if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) });
    await save(sub);
    return true;
  }
  async function disable() {
    const sub = await current();
    if (sub) { try { await S().call('/rest/v1/rpc/push_remove', { method: 'POST', json: { p_endpoint: sub.endpoint } }); } catch {} try { await sub.unsubscribe(); } catch {} }
  }
  async function install() { if (!deferred) return false; deferred.prompt(); try { await deferred.userChoice; } catch {} deferred = null; return true; }

  // كارت جاهز بيتحط في أي صفحة
  async function mount(el) {
    if (!el) return;
    const render = async () => {
      const sub = await current(), perm = supported() ? Notification.permission : 'unsupported';
      let h = '';
      const iosNeeds = ios && !standalone();
      if (iosNeeds) {
        h = `<h3>📲 ثبّت ليجانو على الآيفون عشان توصلك الإشعارات</h3><ol class="pu-st"><li>افتح الموقع من <b>سفاري</b>.</li><li>دوس على زرار المشاركة <b>⬆️</b> تحت.</li><li>اختار <b>«إضافة إلى الشاشة الرئيسية»</b>.</li><li>افتح التطبيق من الأيقونة وارجع هنا وفعّل الإشعارات.</li></ol><small>الآيفون مابيدعمش إشعارات المواقع غير بعد الإضافة للشاشة الرئيسية (iOS 16.4 أو أحدث).</small>`;
      } else if (!supported()) {
        h = `<h3>🔕 المتصفح ده مابيدعمش الإشعارات</h3><small>جرّب كروم على أندرويد، أو افتح الموقع من التطبيق المثبّت.</small>`;
      } else if (perm === 'denied') {
        h = `<h3>🔕 الإشعارات متقفلة</h3><small>اضغط على القفل 🔒 جنب عنوان الموقع واسمح بالإشعارات، وبعدين حدّث الصفحة.</small>`;
      } else if (sub && perm === 'granted') {
        h = `<h3>🔔 الإشعارات شغّالة على الجهاز ده</h3><small>هيجيلك إشعار فوري مع كل طلب استشارة، وإشعار بالأسئلة الجديدة في تخصصك، حتى لو المتصفح مقفول.</small><div class="pu-a"><button type="button" class="soc-btn" data-a="test">جرّب إشعار</button><button type="button" class="soc-btn" data-a="off">إيقاف</button></div>`;
      } else {
        h = `<h3>🔔 فعّل الإشعارات واستقبل الطلبات فوراً</h3><small>طلبات الاستشارة بتخلص في دقيقتين، وكمان هيجيلك إشعار بأي سؤال جديد في تخصصك (مرة كل 3 ساعات على الأكتر). بيوصلك حتى والموقع مقفول.</small><div class="pu-a"><button type="button" class="soc-btn primary" data-a="on">فعّل الإشعارات</button></div>`;
      }
      if (!standalone() && !iosNeeds && deferred) h += `<div class="pu-a"><button type="button" class="soc-btn" data-a="inst">📲 ثبّت التطبيق</button></div>`;
      el.innerHTML = h + '<div class="pu-msg" id="puMsg" role="status"></div>';
    };
    const msg = t => { const m = el.querySelector('#puMsg'); if (m) m.textContent = t; };
    el.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      try {
        if (a === 'on') { msg('بنفعّل...'); await enable(); await render(); }
        else if (a === 'off') { await disable(); await render(); }
        else if (a === 'inst') { await install(); await render(); }
        else if (a === 'test') { const r = await reg(); await r.showNotification('⚖️ ليجانو', { body: 'الإشعارات شغّالة عندك تمام ✅', icon: '/icons/icon-192.png', tag: 'test' }); }
      } catch (er) { msg(er.message === 'denied' ? 'الإشعارات اترفضت. اسمح بيها من إعدادات المتصفح.' : 'حصل خطأ، جرّب تاني.'); }
    });
    document.addEventListener('lg-install-ready', render);
    await render();
    // لو متفعّلة: نجدّد تسجيل الاشتراك في الخلفية (لو الجهاز بدّل المفتاح)
    try { const sub = await current(); if (sub && Notification.permission === 'granted') await save(sub); } catch {}
  }

  window.Push = { supported, enable, disable, mount, install, current };
})();

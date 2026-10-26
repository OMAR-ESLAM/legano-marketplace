// طبقة بيانات Supabase (بديل data.js التجريبي). بتوفّر window.CaseWidget بنفس الواجهة.
// المفتاح ده publishable (عام بطبيعته) والحماية الحقيقية من RLS على السيرفر.
const SB_URL = 'https://qlboprdqnjvsmcwfpjwl.supabase.co';
const SB_KEY = 'sb_publishable_i-9FiXSNKe5xf_mEawmEfQ_PjSjf2_i';

const LEAD_CATEGORIES = [
  { key: 'rent', label: 'إيجارات وعقارات' }, { key: 'labor', label: 'عمالي' }, { key: 'criminal', label: 'جنائي' },
  { key: 'family', label: 'أحوال شخصية' }, { key: 'contracts', label: 'عقود وتحكيم' },
  { key: 'commercial', label: 'تجاري وشركات' }, { key: 'other', label: 'حاجة تانية' },
];
const EGYPT_GOVERNORATES = [
  'القاهرة','الجيزة','الإسكندرية','القليوبية','الشرقية','الدقهلية','الغربية','المنوفية','البحيرة','كفر الشيخ',
  'دمياط','بورسعيد','الإسماعيلية','السويس','الفيوم','بني سويف','المنيا','أسيوط','سوهاج','قنا',
  'الأقصر','أسوان','البحر الأحمر','الوادي الجديد','مطروح','شمال سيناء','جنوب سيناء',
];

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toWaNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('20')) return d;
  if (d.startsWith('0')) return '2' + d;
  return '20' + d;
}

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const body = await r.text();
  const json = body ? JSON.parse(body) : null;
  if (!r.ok) throw new Error((json && (json.message || json.error)) || `HTTP ${r.status}`);
  return json;
}

// صف قاعدة البيانات -> نفس الشكل اللي الواجهة متعودة عليه (من غير رقم التليفون)
function mapRow(r) {
  return {
    id: r.id, name: r.display_name, verified: !!r.verified, featured: !!r.featured,
    publicProfile: {
      displayName: r.display_name, specialties: r.specialties || [], city: r.city, served: (r.served && r.served.length) ? r.served : [r.city].filter(Boolean),
      experienceYears: r.experience_years, licenseLevel: r.license_level, languages: r.languages || [],
      hours: r.hours, consultationFee: r.consultation_fee, bio: r.bio, services: r.services || [], courts: r.courts || [],
      photoBase64: r.photo_path ? `${SB_URL}/storage/v1/object/public/lawyer-photos/${r.photo_path.split('/').map(encodeURIComponent).join('/')}` : '',
    },
  };
}

async function listAllPublicLawyers() {
  const rows = (await sb('public_lawyers?select=*')).map(mapRow);
  // المميز أولاً ثم الموثّق ثم الباقي، وعشوائي جوه كل مجموعة
  const tier = l => (l.featured ? 0 : l.verified ? 1 : 2);
  return rows.map(l => ({ l, r: Math.random() })).sort((a, b) => tier(a.l) - tier(b.l) || a.r - b.r).map(x => x.l);
}

async function getLawyerById(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await sb(`public_lawyers?select=*&id=eq.${id}`);
  return rows[0] ? mapRow(rows[0]) : null;
}

// الرقم بيتجاب من السيرفر بس لما الزائر يضغط، والسيرفر بيسجّل الحدث ويطبّق حد الطلبات
async function getContact(id, type) {
  return sb('rpc/get_contact', { method: 'POST', body: JSON.stringify({ p_lawyer: id, p_type: type }) });
}
async function openContact(id, type, msg) {
  try {
    const phone = await getContact(id, type);
    if (!phone) return alert('الرقم غير متاح دلوقتي');
    location.href = type === 'call' ? `tel:${phone}` : `https://wa.me/${toWaNumber(phone)}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;
  } catch (e) {
    alert(String(e.message).includes('rate_limited') ? 'طلبات كتير، استنى دقيقة وحاول تاني' : 'حصل خطأ، حاول تاني');
  }
}

// المشاهدات بس بتتسجّل من هنا. الاتصال/واتساب/إظهار الرقم بيتسجلوا جوه get_contact نفسها.
function trackContact(id, type) {
  if (type === 'view') sb('rpc/track_view', { method: 'POST', body: JSON.stringify({ p_lawyer: id }) }).catch(() => {});
}
function incrementProfileImpression() {}

window.CaseWidget = { LEAD_CATEGORIES, EGYPT_GOVERNORATES, escapeHTML, toWaNumber, listAllPublicLawyers, getLawyerById, getContact, openContact, trackContact, incrementProfileImpression };

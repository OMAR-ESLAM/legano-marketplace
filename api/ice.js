// خوادم الاتصال (ICE) للغرفة. افتراضياً STUN مجاني بس. لو عندك خادم TURN حطّه في متغيّر البيئة ICE_SERVERS بصيغة JSON، مثلاً:
// [{"urls":"turn:turn.example.com:443?transport=tcp","username":"u","credential":"p"}]
// الـTURN بيحلّ حالات الشبكات المقفولة اللي الاتصال المباشر ما بينجحش فيها.
module.exports = (req, res) => {
  let extra = [];
  try { if (process.env.ICE_SERVERS) { const j = JSON.parse(process.env.ICE_SERVERS); if (Array.isArray(j)) extra = j; } } catch {}
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }, ...extra] }));
};

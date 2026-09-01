/* Cloudflare Access 登入驗證（共用）
 *
 * 原本三支後台端點的驗證是這樣寫的：
 *   if (!email && !jwt && cookie.indexOf('CF_Authorization=') < 0) → 403
 * 也就是「cookie 裡有那個名字」就放行，內容完全不看。實測
 *   curl -H "Cookie: CF_Authorization=anything"
 * 就能把流量與點擊資料整份拿走。
 *
 * 這裡改成真的驗：CF_Authorization 本身就是 Cloudflare 簽章過的 JWT，
 * 拿團隊的公鑰驗簽章、檢查有效期與簽發者。假 cookie 過不了。
 *
 * 這樣做的另一個好處是不依賴 Access 應用程式的路徑設定——就算哪天
 * 設定被改掉、Cloudflare 沒有幫忙擋，端點自己還是守得住。
 */

const TEAM = 'morning-voice-4f68.cloudflareaccess.com';
const CERTS_URL = 'https://' + TEAM + '/cdn-cgi/access/certs';
const ISSUER = 'https://' + TEAM;
const CERTS_TTL_MS = 60 * 60 * 1000;   // 公鑰很少換，一小時抓一次就夠

let certsCache = null;   // { at, keys }

function b64urlToBytes(s) {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

async function getKeys() {
  if (certsCache && Date.now() - certsCache.at < CERTS_TTL_MS) return certsCache.keys;
  const res = await fetch(CERTS_URL, { cf: { cacheTtl: 3600 } });
  if (!res.ok) throw new Error('取不到 Access 公鑰（' + res.status + '）');
  const data = await res.json();
  const keys = data.keys || [];
  certsCache = { at: Date.now(), keys };
  return keys;
}

/* 驗一個 Access JWT。過了回 payload，沒過回 null。 */
async function verify(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return { reason: 'not-a-jwt' };

  let header, payload;
  try {
    header = b64urlToJson(parts[0]);
    payload = b64urlToJson(parts[1]);
  } catch (e) {
    return { reason: 'bad-encoding' };
  }
  if (header.alg !== 'RS256') return { reason: 'alg-' + header.alg };   // 只收 RS256，不接受 alg:none 那類把戲

  const keys = await getKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return { reason: 'unknown-kid' };

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1])
  );
  if (!ok) return { reason: 'bad-signature' };

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return { reason: 'expired' };
  if (payload.nbf && now < payload.nbf - 60) return { reason: 'not-yet-valid' };
  if (payload.iss && payload.iss !== ISSUER) return { reason: 'wrong-issuer' };

  return { payload };
}

function readCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

/* 後台端點統一用這支。
 * 通過回 { email }；沒通過回 { error: Response }，呼叫端直接 return 那個 Response。 */
export async function requireAccess(request, json) {
  const deny = (msg) => ({ error: json({ error: msg }, 403) });

  const token = request.headers.get('Cf-Access-Jwt-Assertion')
    || readCookie(request, 'CF_Authorization');
  if (!token) return deny('未通過 Cloudflare Access 驗證。');

  let result;
  try {
    result = await verify(token);
  } catch (e) {
    // 取不到公鑰之類的暫時性問題：寧可擋掉，也不要放行
    return deny('無法驗證登入狀態，請稍後再試。');
  }
  if (!result.payload) {
    // reason 只講「卡在哪一關」，不含 token 內容，出問題時才查得下去
    return { error: json({
      error: '登入憑證無效或已過期，請重新登入後台。', reason: result.reason,
    }, 403) };
  }

  const p = result.payload;
  return { email: p.email || p.sub || 'Access 使用者' };
}

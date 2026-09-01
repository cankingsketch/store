/* 測試用的載入器
 *
 * 這些測試要驗的是端點自己的邏輯（查詢、彙總、無損重組），不是 Cloudflare
 * 的登入驗證。真正的驗證需要 Cloudflare 簽章過的 JWT，測試裡沒辦法生一個
 * 出來，所以載入時把 lib/access.js 換成替身。
 *
 * ★ 替身只存在於測試載入的那份副本，正式程式碼裡沒有任何測試後門。
 *   真正的驗證是直接打正式站驗的（見 tests/README 或 commit 訊息）。
 */
import fs from 'fs';

const IMPORT_RE = /import \{ requireAccess \} from '\.\.\/\.\.\/lib\/access\.js';/;

const STUB = `
const requireAccess = async (request, json) =>
  request.headers.get('Cf-Access-Authenticated-User-Email')
    ? { email: request.headers.get('Cf-Access-Authenticated-User-Email') }
    : { error: json({ error: '未通過 Cloudflare Access 驗證。' }, 403) };
`;

/* 讀進 Function 的原始碼，把驗證換成替身，載入成模組。
 * extraExports：想額外掛出來測的內部函式名稱。 */
export async function loadFunction(repoDir, relPath, extraExports) {
  let code = fs.readFileSync(repoDir + relPath, 'utf8');
  if (!IMPORT_RE.test(code) && /requireAccess/.test(code)) {
    throw new Error(relPath + ' 用了 requireAccess 卻沒有預期中的 import，載入器要更新');
  }
  code = code.replace(IMPORT_RE, STUB);
  if (extraExports && extraExports.length) {
    code = code.replace(/export async function/g, 'async function');
    code += '\nexport { ' + extraExports.join(', ') + ' };\n';
  }
  const tmp = repoDir + 'tests/_tmp_' + relPath.replace(/[^a-z0-9]/gi, '_') + '.mjs';
  fs.writeFileSync(tmp, code, 'utf8');
  return import('file://' + tmp + '?v=' + Date.now());
}

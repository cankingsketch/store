/* 把 node:sqlite 包成 Cloudflare D1 的介面，讓 Function 的真實 SQL 直接跑起來 */
import { DatabaseSync } from 'node:sqlite';

export function makeD1(file) {
  const db = new DatabaseSync(file || ':memory:');
  const wrap = (sql) => ({
    _args: [],
    bind(...a) { return { ...this, _args: a }; },
    async run() {
      const s = db.prepare(sql);
      const r = s.run(...this._args);
      return { success: true, meta: { changes: r.changes, last_row_id: r.lastInsertRowid } };
    },
    async all() {
      const s = db.prepare(sql);
      return { success: true, results: s.all(...this._args) };
    },
    async first() {
      const s = db.prepare(sql);
      return s.get(...this._args) ?? null;
    },
  });
  return {
    prepare: wrap,
    async batch(stmts) {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
    _raw: db,
  };
}

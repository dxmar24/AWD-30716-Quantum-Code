const { randomUUID } = require('crypto');
class InMemoryRepository {
  constructor(seed = []) { this.rows = seed.map((r) => ({ id: r.id || randomUUID(), ...r })); }
  all() { return [...this.rows]; }
  findById(id) { return this.rows.find((r) => r.id === id) || null; }
  findBy(field, value) { return this.rows.find((r) => r[field] === value) || null; }
  filter(predicate) { return this.rows.filter(predicate); }
  create(data) { const row = { id: randomUUID(), createdAt: new Date().toISOString(), ...data }; this.rows.push(row); return row; }
  update(id, data) { const row = this.findById(id); if (!row) return null; Object.assign(row, data, { updatedAt: new Date().toISOString() }); return row; }
  deleteWhere(predicate) { const removed = this.rows.filter(predicate); this.rows = this.rows.filter((row) => !predicate(row)); return removed.length; }
}
module.exports = { InMemoryRepository };

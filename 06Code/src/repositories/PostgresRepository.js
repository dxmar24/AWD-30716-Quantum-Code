const { Pool } = require('pg');

function toSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamel(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function camelizeRow(row) {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [toCamel(key), value]));
}

class PostgresRepository {
  constructor(pool, tableName) {
    this.pool = pool;
    this.tableName = tableName;
  }

  async all() {
    const result = await this.pool.query(`SELECT * FROM ${this.tableName}`);
    return result.rows.map(camelizeRow);
  }

  async findById(id) {
    const result = await this.pool.query(`SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1`, [id]);
    return camelizeRow(result.rows[0]);
  }

  async findBy(field, value) {
    const column = toSnake(field);
    const result = await this.pool.query(`SELECT * FROM ${this.tableName} WHERE ${column} = $1 LIMIT 1`, [value]);
    return camelizeRow(result.rows[0]);
  }

  async create(data) {
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);
    const columns = entries.map(([key]) => toSnake(key));
    const values = entries.map(([, value]) => value);
    const placeholders = values.map((_, index) => `$${index + 1}`);
    const result = await this.pool.query(
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values,
    );
    return camelizeRow(result.rows[0]);
  }

  async update(id, data) {
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);
    if (!entries.length) return this.findById(id);
    const assignments = entries.map(([key], index) => `${toSnake(key)} = $${index + 2}`);
    const values = [id, ...entries.map(([, value]) => value)];
    const result = await this.pool.query(
      `UPDATE ${this.tableName} SET ${assignments.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    return camelizeRow(result.rows[0]);
  }
}

class PostgresUserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  mapUser(row) {
    if (!row) return null;
    return {
      id: row.id,
      googleSub: row.google_sub,
      email: row.email,
      name: row.name,
      role: row.role || row.role_name,
      active: row.active,
      mustChangePassword: row.must_change_password,
      passwordChangedAt: row.password_changed_at,
      createdAt: row.created_at,
    };
  }

  async roleId(roleName) {
    const result = await this.pool.query('SELECT id FROM roles WHERE name = $1 LIMIT 1', [roleName]);
    if (!result.rows[0]) throw new Error(`Role not found: ${roleName}`);
    return result.rows[0].id;
  }

  async all() {
    const result = await this.pool.query('SELECT u.*, r.name AS role FROM users u LEFT JOIN roles r ON r.id = u.role_id');
    return result.rows.map((row) => this.mapUser(row));
  }

  async findById(id) {
    const result = await this.pool.query('SELECT u.*, r.name AS role FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1 LIMIT 1', [id]);
    return this.mapUser(result.rows[0]);
  }

  async findBy(field, value) {
    const column = field === 'googleSub' ? 'google_sub' : toSnake(field);
    const result = await this.pool.query(`SELECT u.*, r.name AS role FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.${column} = $1 LIMIT 1`, [value]);
    return this.mapUser(result.rows[0]);
  }

  async findAuthByEmail(email) {
    const result = await this.pool.query('SELECT u.*, r.name AS role FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.email = $1 LIMIT 1', [email]);
    const user = this.mapUser(result.rows[0]);
    return user ? { ...user, passwordHash:result.rows[0].password_hash } : null;
  }

  async create(data) {
    const roleId = await this.roleId(data.role);
    const result = await this.pool.query(
      'INSERT INTO users (google_sub, email, name, password_hash, must_change_password, password_changed_at, role_id, active) VALUES ($1, $2, $3, $4, COALESCE($5, FALSE), $6, $7, COALESCE($8, TRUE)) RETURNING id',
      [data.googleSub || null, data.email, data.name, data.passwordHash || null, data.mustChangePassword, data.passwordChangedAt || null, roleId, data.active],
    );
    return this.findById(result.rows[0].id);
  }

  async update(id, data) {
    const updates = [];
    const values = [id];
    if (data.googleSub !== undefined) { values.push(data.googleSub); updates.push(`google_sub = $${values.length}`); }
    if (data.email !== undefined) { values.push(data.email); updates.push(`email = $${values.length}`); }
    if (data.name !== undefined) { values.push(data.name); updates.push(`name = $${values.length}`); }
    if (data.passwordHash !== undefined) { values.push(data.passwordHash); updates.push(`password_hash = $${values.length}`); }
    if (data.mustChangePassword !== undefined) { values.push(data.mustChangePassword); updates.push(`must_change_password = $${values.length}`); }
    if (data.passwordChangedAt !== undefined) { values.push(data.passwordChangedAt); updates.push(`password_changed_at = $${values.length}`); }
    if (data.active !== undefined) { values.push(data.active); updates.push(`active = $${values.length}`); }
    if (data.role !== undefined) { values.push(await this.roleId(data.role)); updates.push(`role_id = $${values.length}`); }
    if (updates.length) await this.pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $1`, values);
    return this.findById(id);
  }
}

class PostgresUserBranchAccessRepository extends PostgresRepository {
  constructor(pool) {
    super(pool, 'user_branch_access');
  }

  async listByUser(userId) {
    const result = await this.pool.query('SELECT * FROM user_branch_access WHERE user_id = $1', [userId]);
    return result.rows.map(camelizeRow);
  }

  async replaceForUser(userId, branchIds) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM user_branch_access WHERE user_id = $1', [userId]);
      const rows = [];
      for (const branchId of branchIds) {
        const result = await client.query(
          'INSERT INTO user_branch_access (user_id, branch_id) VALUES ($1, $2) RETURNING *',
          [userId, branchId],
        );
        rows.push(camelizeRow(result.rows[0]));
      }
      await client.query('COMMIT');
      return rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

function createPool(databaseUrl) {
  return new Pool({ connectionString: databaseUrl });
}

module.exports = { PostgresRepository, PostgresUserRepository, PostgresUserBranchAccessRepository, createPool, camelizeRow };

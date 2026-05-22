const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL?.trim() || "";
const SQLITE_PATH = path.join(__dirname, "..", "inquiries.db");
const ALLOWED_STATUSES = ["New", "Contacted", "Closed"];

let sqliteDb = null;
let pgPool = null;
let initPromise = null;

function usesPostgres() {
  return Boolean(DATABASE_URL);
}

function normalizeStatus(value) {
  return ALLOWED_STATUSES.includes(value) ? value : "New";
}

function mapInquiry(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    name: row.name,
    phone: row.phone || "",
    email: row.email,
    message: row.message,
    status: normalizeStatus(row.status || "New"),
    createdAt: row.created_at || row.createdat || row.createdAt,
    updatedAt: row.updated_at || row.updatedat || row.updatedAt
  };
}

function getSqliteDb() {
  if (!sqliteDb) {
    sqliteDb = new sqlite3.Database(SQLITE_PATH);
  }

  return sqliteDb;
}

function runSqlite(sql, params = []) {
  return new Promise((resolve, reject) => {
    getSqliteDb().run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function allSqlite(sql, params = []) {
  return new Promise((resolve, reject) => {
    getSqliteDb().all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function getSqlite(sql, params = []) {
  return new Promise((resolve, reject) => {
    getSqliteDb().get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

function getPgPool() {
  if (!pgPool) {
    const sslSetting = String(process.env.DATABASE_SSL || "").toLowerCase();
    const ssl = sslSetting === "true" ? { rejectUnauthorized: false } : undefined;

    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl
    });
  }

  return pgPool;
}

async function initDatabase() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    if (usesPostgres()) {
      const pool = getPgPool();

      await pool.query(`
        CREATE TABLE IF NOT EXISTS inquiries (
          id BIGSERIAL PRIMARY KEY,
          name VARCHAR(160) NOT NULL,
          phone VARCHAR(60) NOT NULL,
          email VARCHAR(160) NOT NULL,
          message TEXT NOT NULL,
          status VARCHAR(24) NOT NULL DEFAULT 'New',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(
        "CREATE INDEX IF NOT EXISTS inquiries_created_at_idx ON inquiries (created_at DESC)"
      );

      return;
    }

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'New',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const columns = await allSqlite("PRAGMA table_info(inquiries)");
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has("phone")) {
      await runSqlite("ALTER TABLE inquiries ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
    }

    if (!columnNames.has("status")) {
      await runSqlite("ALTER TABLE inquiries ADD COLUMN status TEXT NOT NULL DEFAULT 'New'");
    }

    if (!columnNames.has("updated_at")) {
      await runSqlite("ALTER TABLE inquiries ADD COLUMN updated_at DATETIME");
      await runSqlite(
        "UPDATE inquiries SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)"
      );
    }
  })();

  return initPromise;
}

async function createInquiry({ name, phone, email, message }) {
  await initDatabase();

  if (usesPostgres()) {
    const { rows } = await getPgPool().query(
      `
        INSERT INTO inquiries (name, phone, email, message, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'New', NOW(), NOW())
        RETURNING *
      `,
      [name, phone, email, message]
    );

    return mapInquiry(rows[0]);
  }

  const insertResult = await runSqlite(
    `
      INSERT INTO inquiries (name, phone, email, message, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'New', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [name, phone, email, message]
  );

  const row = await getSqlite("SELECT * FROM inquiries WHERE id = ?", [insertResult.lastID]);
  return mapInquiry(row);
}

async function listInquiries() {
  await initDatabase();

  if (usesPostgres()) {
    const { rows } = await getPgPool().query(
      "SELECT * FROM inquiries ORDER BY created_at DESC, id DESC"
    );

    return rows.map(mapInquiry);
  }

  const rows = await allSqlite(
    "SELECT * FROM inquiries ORDER BY datetime(created_at) DESC, id DESC"
  );

  return rows.map(mapInquiry);
}

async function updateInquiryStatus(id, status) {
  await initDatabase();
  const safeStatus = normalizeStatus(status);

  if (usesPostgres()) {
    const { rows } = await getPgPool().query(
      `
        UPDATE inquiries
        SET status = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, safeStatus]
    );

    return mapInquiry(rows[0] || null);
  }

  await runSqlite(
    "UPDATE inquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [safeStatus, id]
  );

  const row = await getSqlite("SELECT * FROM inquiries WHERE id = ?", [id]);
  return mapInquiry(row);
}

async function deleteInquiry(id) {
  await initDatabase();

  if (usesPostgres()) {
    const result = await getPgPool().query("DELETE FROM inquiries WHERE id = $1", [id]);
    return result.rowCount > 0;
  }

  const result = await runSqlite("DELETE FROM inquiries WHERE id = ?", [id]);
  return result.changes > 0;
}

function summarizeInquiries(inquiries) {
  return inquiries.reduce(
    (summary, inquiry) => {
      summary.total += 1;
      summary[inquiry.status] = (summary[inquiry.status] || 0) + 1;
      return summary;
    },
    {
      total: 0,
      New: 0,
      Contacted: 0,
      Closed: 0
    }
  );
}

module.exports = {
  ALLOWED_STATUSES,
  SQLITE_PATH,
  createInquiry,
  deleteInquiry,
  initDatabase,
  listInquiries,
  summarizeInquiries,
  updateInquiryStatus,
  usesPostgres
};

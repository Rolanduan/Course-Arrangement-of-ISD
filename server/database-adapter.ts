/**
 * 数据库适配器 - 支持 SQLite / PostgreSQL / MySQL
 * 用于本地开发和云端部署
 */

export interface DatabaseAdapter {
  prepare(sql: string): Statement;
  exec(sql: string): void | Promise<void>;
  close(): void | Promise<void>;
}

export interface Statement {
  run(...params: any[]): RunResult | Promise<RunResult>;
  get(...params: any[]): any | Promise<any>;
  all(...params: any[]): any[] | Promise<any[]>;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * SQLite 适配器 (本地开发使用)
 */
export class SQLiteAdapter implements DatabaseAdapter {
  constructor(private db: any) {}

  prepare(sql: string): Statement {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params: any[]) => {
        const result = stmt.run(...params);
        return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
      },
      get: (...params: any[]) => stmt.get(...params),
      all: (...params: any[]) => stmt.all(...params)
    };
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  close(): void {
    // SQLite 不需要显式关闭连接
  }
}

/**
 * PostgreSQL 适配器 (云端 RDS 使用)
 */
export class PostgreSQLAdapter implements DatabaseAdapter {
  private client: any = null;

  constructor(private connectionString: string) {}

  private async getClient() {
    if (!this.client) {
      const pg = await import('pg');
      this.client = new pg.Pool({ connectionString: this.connectionString });
    }
    return this.client;
  }

  prepare(sql: string): Statement {
    return {
      run: async (...params: any[]) => {
        const client = await this.getClient();
        const pgSql = this.convertPlaceholders(sql, params.length);
        const result = await client.query(pgSql, params);
        return {
          changes: result.rowCount || 0,
          lastInsertRowid: 0
        };
      },
      get: async (...params: any[]) => {
        const client = await this.getClient();
        const pgSql = this.convertPlaceholders(sql, params.length);
        const result = await client.query(pgSql, params);
        return result.rows[0];
      },
      all: async (...params: any[]) => {
        const client = await this.getClient();
        const pgSql = this.convertPlaceholders(sql, params.length);
        const result = await client.query(pgSql, params);
        return result.rows;
      }
    };
  }

  async exec(sql: string): Promise<void> {
    const client = await this.getClient();
    const statements = sql.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) await client.query(stmt);
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  private convertPlaceholders(sql: string, paramCount: number): string {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  }
}

/**
 * MySQL 适配器 (云端 RDS 使用)
 */
export class MySQLAdapter implements DatabaseAdapter {
  private pool: any = null;

  constructor(private config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }) {}

  private async getPool() {
    if (!this.pool) {
      try {
        const mysql = await import('mysql2/promise');
        this.pool = mysql.createPool(this.config);
      } catch (error) {
        throw new Error('mysql2 package not installed. Run: npm install mysql2');
      }
    }
    return this.pool;
  }

  prepare(sql: string): Statement {
    return {
      run: async (...params: any[]) => {
        const pool = await this.getPool();
        const [result] = await pool.execute(sql, params);
        return {
          changes: (result as any).affectedRows,
          lastInsertRowid: (result as any).insertId
        };
      },
      get: async (...params: any[]) => {
        const pool = await this.getPool();
        const [rows] = await pool.execute(sql, params);
        return (rows as any[])[0];
      },
      all: async (...params: any[]) => {
        const pool = await this.getPool();
        const [rows] = await pool.execute(sql, params);
        return rows as any[];
      }
    };
  }

  async exec(sql: string): Promise<void> {
    const pool = await this.getPool();
    const statements = sql.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) await pool.execute(stmt);
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

/**
 * 工厂函数 - 根据环境变量创建适配器
 */
export function createDatabaseAdapter(): DatabaseAdapter {
  const dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'postgresql') {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL 环境变量未设置');
    }
    return new PostgreSQLAdapter(process.env.DATABASE_URL);
  }

  if (dbType === 'mysql') {
    return new MySQLAdapter({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'scheduler'
    });
  }

  // 默认使用 SQLite (本地开发)
  const { DatabaseSync } = require('node:sqlite');
  const path = require('path');
  const fs = require('node:fs');

  const dataDir = path.resolve('data');
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new DatabaseSync(path.join(dataDir, 'scheduler.db'));
  return new SQLiteAdapter(db);
}

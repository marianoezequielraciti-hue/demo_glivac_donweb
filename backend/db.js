import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'glivac',
  waitForConnections: true,
  connectionLimit:    10,
  timezone:           'Z',
  decimalNumbers:     true,
  typeCast(field, next) {
    // Booleans
    if (field.type === 'TINY' && field.length === 1) return field.string() === '1';
    // JSON columns — mysql2 usa código numérico 245, no el string 'JSON'
    if (field.type === 245) {
      const val = field.string();
      try { return val ? JSON.parse(val) : null; } catch { return val; }
    }
    return next();
  },
});

export default pool;

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import pool from '../db.js';
import { signToken, authMiddleware } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  try {
    const [rows] = await pool.query(
      'SELECT u.id, u.email, u.encrypted_password, p.role, p.username, p.store_id, s.name AS store_name ' +
      'FROM users u ' +
      'LEFT JOIN user_profiles p ON p.id = u.id ' +
      'LEFT JOIN stores s ON s.id = p.store_id ' +
      'WHERE u.email = ? LIMIT 1',
      [email.toLowerCase()]
    );

    const row = rows[0];
    if (!row) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const valid = await bcrypt.compare(password, row.encrypted_password);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const user = {
      id:         row.id,
      email:      row.email,
      role:       row.role || 'employee',
      username:   row.username || null,
      store_id:   row.store_id || null,
      store_name: row.store_name || null,
    };

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.json({ token, user });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT u.id, u.email, p.role, p.username, p.store_id, s.name AS store_name ' +
      'FROM users u ' +
      'LEFT JOIN user_profiles p ON p.id = u.id ' +
      'LEFT JOIN stores s ON s.id = p.store_id ' +
      'WHERE u.id = ? LIMIT 1',
      [req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/auth/users  (solo admin)
router.get('/users', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const [rows] = await pool.query(
      'SELECT u.id, u.email, u.created_at, p.role, p.username, p.store_id, s.name AS store_name ' +
      'FROM users u ' +
      'LEFT JOIN user_profiles p ON p.id = u.id ' +
      'LEFT JOIN stores s ON s.id = p.store_id ' +
      'ORDER BY u.email'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/auth/users  (crear usuario — solo admin)
router.post('/users', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  const { email, password, role = 'employee', username, store_id } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  try {
    const id   = uuid();
    const hash = await bcrypt.hash(password, 12);
    await pool.query('INSERT INTO users (id, email, encrypted_password) VALUES (?, ?, ?)',
      [id, email.toLowerCase(), hash]);
    await pool.query(
      'INSERT INTO user_profiles (id, email, role, username, store_id) VALUES (?, ?, ?, ?, ?)',
      [id, email.toLowerCase(), role, username || null, store_id || null]
    );
    res.status(201).json({ id, email, role });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El email ya existe' });
    console.error('create user error', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// PATCH /api/auth/users/:id  (actualizar rol/store — solo admin)
router.patch('/users/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  const { role, store_id, username, password } = req.body || {};
  const { id } = req.params;

  try {
    if (role || store_id !== undefined || username !== undefined) {
      const fields = [];
      const vals   = [];
      if (role)     { fields.push('role = ?');     vals.push(role); }
      if (username !== undefined) { fields.push('username = ?'); vals.push(username || null); }
      if (store_id !== undefined) { fields.push('store_id = ?'); vals.push(store_id || null); }
      if (fields.length) {
        vals.push(id);
        await pool.query(`UPDATE user_profiles SET ${fields.join(', ')} WHERE id = ?`, vals);
      }
    }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE users SET encrypted_password = ? WHERE id = ?', [hash, id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// DELETE /api/auth/users/:id  (solo admin)
router.delete('/users/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/auth/setup-first-admin
// Solo funciona si no existe ningún usuario en la base. Se auto-deshabilita.
router.post('/setup-first-admin', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  try {
    const [[{ count }]] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (count > 0) return res.status(403).json({ error: 'Ya existen usuarios. Endpoint deshabilitado.' });

    const id   = uuid();
    const hash = await bcrypt.hash(password, 12);
    await pool.query('INSERT INTO users (id, email, encrypted_password) VALUES (?, ?, ?)',
      [id, email.toLowerCase(), hash]);
    await pool.query('INSERT INTO user_profiles (id, email, role) VALUES (?, ?, ?)',
      [id, email.toLowerCase(), 'admin']);

    const token = signToken({ sub: id, email: email.toLowerCase(), role: 'admin' });
    res.status(201).json({ ok: true, message: 'Admin creado correctamente', token });
  } catch (err) {
    console.error('setup-first-admin error', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

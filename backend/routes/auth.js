import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../db.js';
import { signToken, authMiddleware } from '../middleware/auth.js';

const router = Router();

function createMailTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || 'sglivac@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { identifier, email, password } = req.body || {};
  const loginId = identifier || email;
  if (!loginId || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  try {
    const [rows] = await pool.query(
      'SELECT u.id, u.email, u.encrypted_password, p.role, p.username, p.store_id, s.name AS store_name ' +
      'FROM users u ' +
      'LEFT JOIN user_profiles p ON p.id = u.id ' +
      'LEFT JOIN stores s ON s.id = p.store_id ' +
      'WHERE u.email = ? OR p.username = ? LIMIT 1',
      [loginId.toLowerCase(), loginId.toLowerCase()]
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

    const token = signToken({ sub: user.id, email: user.email, role: user.role, store_id: user.store_id });
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
      'SELECT u.id, u.email, p.role, p.username, p.store_id, p.recovery_email, s.name AS store_name ' +
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

// PATCH /api/auth/me/recovery-email  — actualizar email de recuperación propio
router.patch('/me/recovery-email', authMiddleware, async (req, res) => {
  const { recovery_email } = req.body || {};
  if (!recovery_email || !recovery_email.includes('@')) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  try {
    await pool.query(
      'UPDATE user_profiles SET recovery_email = ? WHERE id = ?',
      [recovery_email.toLowerCase().trim(), req.user.sub]
    );
    res.json({ ok: true, recovery_email: recovery_email.toLowerCase().trim() });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// PATCH /api/auth/me/password  — cambiar contraseña propia
router.patch('/me/password', authMiddleware, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  try {
    const [[row]] = await pool.query(
      'SELECT encrypted_password FROM users WHERE id = ?',
      [req.user.sub]
    );
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(current_password, row.encrypted_password);
    if (!valid) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET encrypted_password = ? WHERE id = ?', [hash, req.user.sub]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/auth/forgot-password  — envía email con link de recuperación
router.post('/forgot-password', async (req, res) => {
  const { username, recovery_email } = req.body || {};
  if (!username || !recovery_email) {
    return res.status(400).json({ error: 'Usuario y email de recuperación son requeridos' });
  }

  const identifier = username.toLowerCase().trim();
  const recEmail   = recovery_email.toLowerCase().trim();

  try {
    // Buscar usuario por (username o email principal) Y que el recovery_email coincida
    const [rows] = await pool.query(
      'SELECT u.id, p.recovery_email ' +
      'FROM users u ' +
      'LEFT JOIN user_profiles p ON p.id = u.id ' +
      'WHERE (p.username = ? OR u.email = ?) AND p.recovery_email = ? LIMIT 1',
      [identifier, identifier, recEmail]
    );

    if (!rows[0]) {
      // No revelar si el usuario/email existe, pero sí indicar que no coinciden
      return res.status(400).json({ error: 'El usuario o el email de recuperación no son correctos' });
    }

    const user = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Invalidar tokens previos del usuario
    await pool.query(
      'UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0',
      [user.id]
    );

    await pool.query(
      'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (UUID(), ?, ?, ?)',
      [user.id, token, expiresAt]
    );

    const appUrl = process.env.APP_URL || 'https://glivac.online';
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    if (process.env.GMAIL_APP_PASSWORD) {
      const transport = createMailTransport();
      await transport.sendMail({
        from: `"Glivac" <${process.env.GMAIL_USER || 'sglivac@gmail.com'}>`,
        to: recEmail,
        subject: 'Recuperar contraseña — Glivac',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#18181b">Recuperar contraseña</h2>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Glivac.</p>
            <p>Hacé clic en el siguiente botón para crear una nueva contraseña. El enlace es válido por <strong>1 hora</strong>.</p>
            <a href="${resetLink}"
               style="display:inline-block;margin:16px 0;padding:12px 24px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
              Restablecer contraseña
            </a>
            <p style="font-size:12px;color:#71717a">Si no solicitaste este cambio, podés ignorar este correo.</p>
            <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0"/>
            <p style="font-size:12px;color:#a1a1aa">Glivac — Sistema de Gestión</p>
          </div>
        `,
      });
      console.log(`[forgot-password] Email enviado a ${recEmail}`);
    } else {
      console.log('[forgot-password] GMAIL_APP_PASSWORD no configurado. Reset link:', resetLink);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('forgot-password error', err);
    res.status(500).json({ error: 'Error al enviar el email. Verificá la configuración de correo.' });
  }
});

// POST /api/auth/reset-password  — restablecer contraseña con token
router.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body || {};
  if (!token || !new_password) return res.status(400).json({ error: 'Token y nueva contraseña requeridos' });
  if (new_password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const [rows] = await pool.query(
      'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ? LIMIT 1',
      [token]
    );

    const row = rows[0];
    if (!row) return res.status(400).json({ error: 'Token inválido o expirado' });
    if (row.used) return res.status(400).json({ error: 'Este enlace ya fue utilizado' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'El enlace expiró. Solicitá uno nuevo' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET encrypted_password = ? WHERE id = ?', [hash, row.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [row.id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('reset-password error', err);
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
  const { email, password, role = 'employee', username, displayName, storeId, store_id } = req.body || {};
  const effectiveUsername = username || null;
  const effectiveDisplayName = displayName || username || null;
  if (!effectiveUsername && !email) return res.status(400).json({ error: 'Se requiere código de acceso o email' });
  if (!password) return res.status(400).json({ error: 'La contraseña es obligatoria' });

  const effectiveEmail = email ? email.toLowerCase() : `${effectiveUsername.toLowerCase()}@glivac.internal`;
  const effectiveStoreId = storeId || store_id || null;

  try {
    const id   = uuid();
    const hash = await bcrypt.hash(password, 12);
    await pool.query('INSERT INTO users (id, email, encrypted_password) VALUES (?, ?, ?)',
      [id, effectiveEmail, hash]);
    await pool.query(
      'INSERT INTO user_profiles (id, email, role, username, store_id) VALUES (?, ?, ?, ?, ?)',
      [id, effectiveEmail, role, effectiveDisplayName, effectiveStoreId]
    );
    res.status(201).json({ id, email: effectiveEmail, username: effectiveDisplayName, role });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El usuario ya existe' });
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

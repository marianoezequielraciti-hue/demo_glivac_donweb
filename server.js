import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRoutes   from './backend/routes/auth.js';
import tableRoutes  from './backend/routes/tables.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 3000;
const DIST = join(__dirname, 'dist');

app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/auth',   authRoutes);
app.use('/api',        tableRoutes);

// Serve Vite SPA
app.use(express.static(DIST));
app.get('*', (_req, res) => res.sendFile(join(DIST, 'index.html')));

// ── Global Express error handler ──────────────────────────────────────────
// Captura errores síncronos lanzados dentro de route handlers
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Express] Unhandled route error:', err);
  if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => console.log(`Glivac corriendo en puerto ${PORT}`));

// ── Process-level safety net ───────────────────────────────────────────────
// Evita que una excepción no capturada mate el proceso Node
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
});

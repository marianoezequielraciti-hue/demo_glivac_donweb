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

app.listen(PORT, () => console.log(`Glivac corriendo en puerto ${PORT}`));

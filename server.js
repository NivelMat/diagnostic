const express = require('express');
const Database = require('better-sqlite3');
const basicAuth = require('basic-auth');
const cors = require('cors');

const app = express();
app.use(express.json());

// CORS: ajustar ALLOWED_ORIGIN en producción (ej: https://nivelmat.github.io)
const allowed = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: allowed }));

const db = new Database(process.env.DB_PATH || 'preinscripciones.db');
db.prepare(`CREATE TABLE IF NOT EXISTS preinscripciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prefijo_ci TEXT,
  ci INTEGER,
  nombres TEXT,
  apellidos TEXT,
  colegio TEXT,
  estudia_universidad TEXT,
  universidad TEXT,
  carrera TEXT,
  telefono TEXT,
  correo TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run();

function checkAdmin(req, res, next) {
  const user = basicAuth(req);
  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme';
  if (!user || user.name !== ADMIN_USER || user.pass !== ADMIN_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="admin"');
    return res.status(401).send('No autorizado');
  }
  next();
}

function validarServidor(body) {
  // CI
  const ci = parseInt(String(body.ci || ''), 10);
  if (!ci || ci <= 1000000 || ci >= 35000000) return 'Cédula fuera de rango';
  // telefono
  if (!/^((\+584\d{9})|(04\d{9})|(02\d{9}))$/.test(String(body.telefono || ''))) return 'Teléfono inválido';
  // correo
  if ((String(body.correo).match(/@/g) || []).length !== 1) return 'Correo inválido';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.correo || ''))) return 'Formato de correo inválido';
  // nombres/apellidos: permitir letras y acentos
  if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ\- ]+$/.test(String(body.nombres || ''))) return 'Nombres inválidos';
  if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ\- ]+$/.test(String(body.apellidos || ''))) return 'Apellidos inválidos';
  return null;
}

app.post('/api/preinscripcion', (req, res) => {
  const err = validarServidor(req.body);
  if (err) return res.status(400).json({ error: err });

  const stmt = db.prepare(`INSERT INTO preinscripciones
    (prefijo_ci, ci, nombres, apellidos, colegio, estudia_universidad, universidad, carrera, telefono, correo)
    VALUES (@prefijo_ci,@ci,@nombres,@apellidos,@colegio,@estudia_universidad,@universidad,@carrera,@telefono,@correo)`);
  const info = stmt.run({
    prefijo_ci: req.body.prefijo_ci || '',
    ci: parseInt(String(req.body.ci || '').replace(/\D/g,''), 10) || null,
    nombres: req.body.nombres || '',
    apellidos: req.body.apellidos || '',
    colegio: req.body.colegio || '',
    estudia_universidad: req.body.estudia_universidad || 'no',
    universidad: req.body.universidad || '',
    carrera: req.body.carrera || '',
    telefono: req.body.telefono || '',
    correo: req.body.correo || ''
  });
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

app.get('/admin/preinscripciones', checkAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM preinscripciones ORDER BY created_at DESC').all();
  res.json(rows);
});

app.get('/admin', checkAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM preinscripciones ORDER BY created_at DESC').all();
  let html = `<!doctype html><html><head><meta charset="utf-8"><title>Admin - Preinscripciones</title>
  <style>table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left;font-family:Arial;}th{background:#f5f5f5}</style>
  </head><body><h2>Preinscripciones</h2><table><thead><tr><th>ID</th><th>CI</th><th>Nombres</th><th>Apellidos</th><th>Colegio</th><th>Universidad</th><th>Carrera</th><th>Teléfono</th><th>Correo</th><th>Fecha</th></tr></thead><tbody>`;
  for (const r of rows) {
    html += `<tr><td>${r.id}</td><td>${r.prefijo_ci}-${r.ci}</td><td>${escapeHtml(r.nombres)}</td><td>${escapeHtml(r.apellidos)}</td><td>${escapeHtml(r.colegio)}</td><td>${escapeHtml(r.universidad)}</td><td>${escapeHtml(r.carrera)}</td><td>${escapeHtml(r.telefono)}</td><td>${escapeHtml(r.correo)}</td><td>${r.created_at}</td></tr>`;
  }
  html += `</tbody></table></body></html>`;
  res.send(html);
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Servidor escuchando en puerto', port));

module.exports = app;

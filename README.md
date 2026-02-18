# NivelMat - API de Preinscripciones

Esto añade una API mínima (Node.js + Express + SQLite) para recibir preinscripciones desde la web pública (GitHub Pages).

Archivos añadidos:

- `server.js` - servidor Express con endpoints:
  - `POST /api/preinscripcion` - recibe JSON y guarda en sqlite
  - `GET /admin` - panel HTML protegido por Basic Auth
  - `GET /admin/preinscripciones` - devuelve JSON protegido por Basic Auth
- `package.json` - dependencias y scripts

Cómo probar localmente

1. Instalar dependencias (desde la carpeta `nivelmat`):

```bash
cd nivelmat
npm install
```


2. Ejecutar el servidor de prueba local:

```bash
ADMIN_USER=admin ADMIN_PASS=changeme node server.js
```

El servidor escucha en `http://localhost:3000` por defecto.

Integración con GitHub Pages

GitHub Pages no puede ejecutar código server-side. Debes desplegar este servidor en un host (Render, Railway, Heroku, o VPS) y configurar `ALLOWED_ORIGIN` al dominio de tu página.

Nota importante para este proyecto: tus repositorios están sirviendo páginas bajo `https://nivelmat.github.io/<repo>/` (por ejemplo `https://nivelmat.github.io/contactos/`). En ese caso, establece la variable de entorno `ALLOWED_ORIGIN` exactamente a:

```
ALLOWED_ORIGIN=https://nivelmat.github.io
```

y en el cliente (archivo `preinscripcion copy/index.html`) reemplaza `https://TU-SERVIDOR.example.com` por la URL pública de tu servidor. El cliente detecta automáticamente si la página se sirve desde `nivelmat.github.io` y usará la URL de producción en ese caso; en desarrollo usará `http://localhost:3000`.

Despliegue rápido en Render

1. Crear un nuevo Web Service en Render conectando el repo.
2. Setear `Build Command`: `npm install`
3. `Start Command`: `npm start`
4. Variables de entorno: `ADMIN_USER`, `ADMIN_PASS`, `ALLOWED_ORIGIN` (ej: `https://nivelmat.github.io`)

Después de desplegar, actualiza el formulario en `preinscripcion copy/index.html` para apuntar a la URL del servidor en `API_URL`.

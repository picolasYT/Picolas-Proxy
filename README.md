# Picolas Proxy

**Your network. Your proxy.**

Picolas Proxy es una herramienta open-source que convierte fácilmente una PC, VPS, servidor o sandbox en un **proxy HTTP/SOCKS5 administrable desde un panel web**. Sin base de datos externa: toda la configuración persistente vive en `data/config.json` y las estadísticas se mantienen en memoria mientras el proceso está activo.

![status](https://img.shields.io/badge/status-alpha-blueviolet) ![license](https://img.shields.io/badge/license-MIT-informational)

---

## ✨ Características

- **Dashboard en tiempo real**: estado, IP, puerto, tipo de proxy, dispositivos conectados, tráfico, uptime, CPU/RAM.
- **HTTP (CONNECT) y SOCKS5** implementados de forma nativa, sin dependencias de proxying pesadas.
- **Panel web** con secciones: Dashboard, Proxy, Devices, Traffic, Security, Logs, Settings.
- **Control total**: iniciar / detener / reiniciar el proxy, cambiar puerto y protocolo desde la UI.
- **Autenticación de usuario/contraseña** en el proxy (Basic Auth para HTTP, RFC 1929 para SOCKS5) y en el propio panel.
- **Lista blanca / lista negra de IPs** y modo "sólo LAN/local" activado por defecto.
- **Logs en tiempo real** vía WebSocket.
- **Sin base de datos**: configuración en JSON, estadísticas en memoria.
- Diseño oscuro, moderno y responsive (Tailwind, gradientes violeta/magenta/cian).
- Pensado para desplegarse en segundos en [Render](https://render.com).

---

## 🚀 Instalación local

Requisitos: Node.js 18+.

```bash
git clone <repo>
cd picolas-proxy
npm install
npm start
```

`npm install` compila automáticamente el frontend y el backend (`postinstall`). `npm start` levanta el servidor Express, que sirve tanto el panel (React) como la API en el mismo puerto.

Abre `http://localhost:3000` e inicia sesión con el usuario/contraseña definidos en tus variables de entorno (por defecto `admin` / `change-me-please` — **cámbiala de inmediato** desde la sección **Proxy** del panel).

### Modo desarrollo (hot reload)

```bash
npm run dev
```

Esto levanta el backend con `tsx watch` en `:3000` y el frontend con Vite en `:5173` (con proxy hacia la API/WebSocket del backend).

---

## ⚙️ Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto del panel web | `3000` |
| `PANEL_ADMIN_USER` | Usuario inicial del panel/proxy | `admin` |
| `PANEL_ADMIN_PASSWORD` | Contraseña inicial (¡cámbiala!) | `change-me-please` |
| `SESSION_SECRET` | Secreto para firmar cookies de sesión | aleatorio |
| `ALLOW_EXTERNAL_PROXY` | Permite que el proxy escuche en `0.0.0.0` en vez de sólo local/LAN | `false` |
| `NODE_ENV` | Entorno de ejecución | `production` |

---

## ☁️ Despliegue en Render

El repositorio incluye un `render.yaml` listo para usar (Blueprint):

1. Sube el repositorio a GitHub.
2. En Render, crea un nuevo **Blueprint** apuntando al repo (o un **Web Service** manual).
3. Configuración (ya definida en `render.yaml`):
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Health check:** `GET /health`
4. Define `PANEL_ADMIN_USER` y `PANEL_ADMIN_PASSWORD` en las variables de entorno del servicio.
5. Despliega. El panel quedará disponible en la URL pública que asigne Render, sirviendo el frontend compilado y la API desde un único Web Service.

> **Importante sobre Render:** un Web Service estándar de Render sólo expone públicamente el puerto HTTP principal (`process.env.PORT`), que aquí usa el **panel**. Los puertos del proxy HTTP/SOCKS5 en sí (configurables desde el panel) corren dentro del mismo contenedor pero **no son accesibles desde internet** en un plan estándar. Para usar Picolas Proxy como proxy real accesible desde fuera, despliégalo en tu propia PC, VPS o sandbox con acceso de red directo (el panel de administración funciona igual en Render, sólo cambia el alcance de las conexiones proxy en sí).

---

## 🧱 Stack técnico

- **Backend:** Node.js + TypeScript + Express + `ws` (WebSocket nativo)
- **Frontend:** React + Vite + TypeScript + TailwindCSS
- **Persistencia:** archivo `data/config.json` (sin PostgreSQL/MongoDB/MySQL/SQLite)
- **Estadísticas:** en memoria (se reinician si el proceso se reinicia, tal como Render hace en cada deploy/restart)

---

## 🔐 Seguridad por defecto

Picolas Proxy viene configurado de forma conservadora:

- Autenticación **activada** por defecto en el proxy y obligatoria en el panel.
- Los servidores proxy sólo aceptan conexiones desde **localhost/LAN** (`ALLOW_EXTERNAL_PROXY=false`) hasta que actives explícitamente el acceso externo desde **Security**.
- Contraseñas nunca en el código: se guardan como hash `scrypt` + salt en `data/config.json` (excluido de git).
- Todas las entradas de la API se validan antes de tocar la configuración.
- El panel **no permite ejecutar comandos arbitrarios** del sistema operativo; sólo expone acciones estructuradas (start/stop/restart, configuración, listas de IPs).

Si decides activar el acceso externo, hazlo con conocimiento de causa: un proxy abierto a internet sin restricciones puede ser usado por terceros para ocultar su tráfico. Usa siempre autenticación fuerte y, si es posible, lista blanca de IPs.

---

## 📁 Estructura del proyecto

```
picolas-proxy/
├── server/                  # Backend Express + TypeScript
│   ├── index.ts              # Entrypoint, sirve API + frontend + /health
│   ├── config.ts             # Config persistente (data/config.json)
│   ├── auth.ts                # Sesión del panel (cookies firmadas)
│   ├── security.ts            # Allowlist/blocklist, restricción LAN
│   ├── stats.ts                # Stats en memoria (conexiones, tráfico, CPU/RAM)
│   ├── network.ts             # Detección de IP local/pública, SO
│   ├── logger.ts               # Logs en memoria + broadcast WS
│   ├── ws.ts                    # WebSocket: logs y stats en vivo
│   ├── validate.ts              # Validación de inputs de la API
│   ├── proxy/
│   │   ├── httpProxy.ts         # Proxy HTTP + CONNECT
│   │   ├── socks5Proxy.ts       # Proxy SOCKS5 (RFC 1928/1929)
│   │   ├── credentials.ts       # Verificación de credenciales del proxy
│   │   └── proxyManager.ts      # Orquesta start/stop/restart
│   └── routes/api.ts            # Rutas REST
├── frontend/                 # Panel React + Vite + Tailwind
│   └── src/
│       ├── pages/               # Dashboard, Proxy, Devices, Traffic, Security, Logs, Settings
│       ├── components/          # Layout, StatCard, StatusBadge
│       └── lib/                 # api.ts (fetch), ws.ts (hook WebSocket), types.ts
├── data/                       # config.json (persistencia, gitignored)
├── render.yaml                 # Blueprint de despliegue en Render
├── .env.example
└── package.json
```

---

## 🗺️ Roadmap / ideas futuras

- Autenticación de dos factores para el panel.
- Rotación de logs a disco (opcional, sigue sin requerir base de datos).
- Soporte IPv6 completo en SOCKS5 (`BIND`/`UDP ASSOCIATE`).
- Exportar métricas en formato Prometheus.

Contribuciones bienvenidas — este es un proyecto open-source (MIT).

---

## 📄 Licencia

MIT — usa, modifica y distribuye libremente.

# EstupeFarma — Gestor de Estupefacientes (HUNSC)

Aplicación web interna del Servicio de Farmacia del Hospital Universitario Nuestra
Señora de Candelaria para la gestión de medicamentos **estupefacientes** (control legal
estricto). Complementa —no sustituye— al sistema ATHOS SADE: centraliza inventario,
detección de anomalías, pedidos, caducados e incidencias en una sola interfaz.

> **Privacidad — regla absoluta e inviolable:** la aplicación **nunca** maneja, muestra,
> almacena ni infiere un nombre de paciente, en ningún formato. Ver `CLAUDE.md §1`.

## Estado del proyecto

Migración en curso del prototipo monolítico a un proyecto **Vite + React** modular.
Estamos en la **Fase 0** (infraestructura y pipeline): el prototipo legado se renderiza
tal cual para validar build y despliegue antes de trocearlo. El plan completo por fases
está en `CLAUDE.md` y en el documento de plan del proyecto.

- Referencia de comportamiento **congelada**: `docs/legacy/GestorEstupefacientes.jsx`.
- Copia **viva** que ejecuta la app hoy: `frontend/src/GestorEstupefacientes.jsx`
  (se descompondrá en módulos durante la Fase 1).

## Estructura

```
estupefarma/
├── CLAUDE.md                 # Fuente de verdad operativa del repo
├── README.md                 # Este archivo
├── docs/                     # Documentación de dominio
│   ├── EstupeFarma_Contexto_v3.md
│   ├── EstupeFarma_Catalogo_CodigoV.md
│   └── legacy/               # Prototipo original (referencia congelada)
├── frontend/                 # SPA Vite + React (Root Directory en Vercel)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   └── src/
│       ├── main.jsx
│       └── GestorEstupefacientes.jsx
└── backend/
    └── apps-script/          # Backend Google Apps Script (pendiente, Fase 2)
```

## Requisitos

- **Node.js 18+** y npm (hoy no instalado en la máquina de desarrollo — instalar desde
  https://nodejs.org).

## Arranque en local

```bash
cd frontend
npm install
npm run dev
```

Abre la URL que imprime Vite (por defecto http://localhost:5173). Sin `VITE_APPS_SCRIPT_URL`
configurada, la app arranca en **modo local** (los datos viven solo en la sesión).

Para conectar con Google Sheets, copia `frontend/.env.example` a `frontend/.env` y rellena
`VITE_APPS_SCRIPT_URL`, o pega la URL en runtime desde el panel de Ajustes de la app.

## Tests

```bash
cd frontend
npm run test        # una pasada (Vitest)
npm run test:watch  # modo watch
```

Los tests de la lógica de dominio se añaden durante la Fase 1 (red de seguridad de la
paridad al trocear el Detector y los cálculos de inventario).

## Despliegue (GitHub + Vercel)

1. Sube el repositorio a GitHub.
2. En Vercel, importa el repo y configura:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Variables de entorno en el panel de Vercel (Production y Preview):
   `VITE_APPS_SCRIPT_URL` (y opcionalmente `VITE_SPREADSHEET_ID`).
4. Durante el piloto (sin login), activa la **Deployment Protection** de Vercel para que
   el sitio no sea público.

Flujo CI/CD: push a `main` → deploy de producción; cada Pull Request → *preview deploy*.

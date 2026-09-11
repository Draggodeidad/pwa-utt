# PWA de inspecciones de laboratorio

Proyecto integrador del equipo **9B-E02** para registrar inspecciones y mantenimiento de laboratorios con datos exclusivamente sintéticos. El incremento de la Semana 02 incorpora un shell instalable, navegación por rol, un Web App Manifest y estados accesibles de carga, error y vacío.

## Requisitos del entorno

- Node.js 20.19 o posterior compatible.
- npm 10 o posterior.
- Git; Make es opcional.

GitHub Actions usa Node.js 20.19.6. No se requieren servicios externos, cuentas privadas, variables de entorno ni credenciales para instalar, probar o compilar.

## Instalación y ejecución

Desde la raíz del repositorio:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

Abre `http://localhost:3000`. La aplicación usa perfiles, laboratorios, inspecciones y hallazgos sintéticos; no contiene datos personales reales.

## Verificación reproducible

La verificación completa puede ejecutarse con cualquiera de estos comandos equivalentes:

```bash
make verify
# o, si Make no está disponible
npm run verify
```

El verificador ejecuta, en orden, `npm run typecheck`, `npm test` y `npm run build`, y genera `reports/verification.json`. La suite incluye:

- `tests/starter.spec.mjs`: conserva el comportamiento acumulativo del proyecto.
- `tests/manifest.spec.ts`: valida campos de instalación, iconos reales, scope, shortcuts, metadata, landmarks y presencia de estados críticos.
- `bash public-tests/check.sh`: comprueba los artefactos públicos de la Semana 02.

El archivo `.github/workflows/week-02-w02-shell-manifest.yml` repite una instalación limpia y `make verify` en cada `push`, pull request o ejecución manual, y publica el reporte como artefacto. La evidencia debe asociarse al SHA exacto evaluado.

## Implementación de Semana 02

- `public/manifest.webmanifest` declara nombre, nombre corto, idioma, `start_url`, `scope`, modo `standalone`, colores, iconos `192x192` y `512x512`, icono maskable, shortcuts y capturas.
- `src/app/layout.tsx` enlaza el manifest y expone metadata de iconos, Apple Web App y viewport.
- `src/components/app-shell.tsx` concentra el shell responsive, landmarks, navegación principal operable por teclado, perfil y feedback de carga, error y vacío.
- `src/app/loading.tsx` y `src/app/error.tsx` aíslan esperas y fallos de ruta; la vista inicial selecciona vacío cuando el repositorio sintético no entrega registros.
- `src/app/page.tsx` compone el shell con la navegación declarativa del rol y el workspace de inspecciones.

## Decisiones y trade-offs

Se eligió un manifest estático en `public/` y metadata nativa de Next.js: el resultado es inspeccionable, no depende de una API y conserva una única fuente para las propiedades de instalación. El costo es que cualquier personalización por entorno requiere un build o un manifest generado en el futuro.

El shell recibe navegación y perfil mediante props en lugar de consultar sesión o datos por sí mismo. Esto mantiene el límite visual reutilizable y permite probar estados deterministas, a cambio de que cada ruta componga explícitamente su contexto.

Los estados se representan con semántica accesible (`aria-busy`, regiones de estado, alerta y botón de reintento). La prueba automatizada protege su contrato estructural; no sustituye una auditoría WCAG ni una prueba E2E en varios navegadores.

## Supuestos, límites y fallos encontrados

- Se asume despliegue en la raíz del mismo origen (`scope` y `start_url` son `/`). Un despliegue bajo subruta exigiría ajustar ambos valores y los shortcuts.
- La Semana 02 hace la aplicación instalable a nivel de manifest, pero todavía no añade un service worker ni garantiza navegación sin conexión. El shell solo comunica los datos locales que otras capas ya proporcionen.
- La disponibilidad del botón de instalación depende de los criterios y políticas del navegador; debe validarse manualmente en el entorno de entrega.
- La rama `feat/pwa-manifest-icons` divergió de `main` en `src/app/layout.tsx`. El merge conservó el título/descripción vigentes y la metadata PWA. Además, `manifest.json` se renombró a `manifest.webmanifest` para cumplir el contrato del profesor sin perder el historial de la contribución.
- Las capturas e iconos son artefactos sintéticos del proyecto; no incluyen PII.

## Evidencia y colaboración

El reporte individual está en `evidence/individual.md`. El commit funcional principal de Imanol es `15f08bb763e29d966087414fc1299361bdf2fa6f`; los commits `4a163f1` y `d39ff30` preservan el aporte de Osbaldo al manifest y sus recursos.

Las instrucciones acotadas para que los integrantes restantes verifiquen el resultado y completen únicamente su propia evidencia están en `docs/week-02-contributor-guide.md`.

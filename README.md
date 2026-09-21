# PWA de inspecciones de laboratorio

Proyecto integrador del equipo **9B-E02** para registrar inspecciones y mantenimiento de laboratorios con datos exclusivamente sintéticos. El incremento de la Semana 02 incorpora un shell instalable, navegación por rol, un Web App Manifest y estados accesibles de carga, error y vacío. El incremento de la Semana 03 incorpora un service worker con precache del app shell, navegación offline con fallback, caché de assets estáticos y actualización controlada.

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
- `tests/service-worker.spec.ts`: valida el ciclo de vida de `public/sw.js` (precache, activación, `SKIP_WAITING` y exclusiones de fetch).
- `tests/offline.spec.ts`: valida navegación online/offline, fallback, cache-first de estáticos y poda FIFO.
- `bash public-tests/check.sh`: comprueba los artefactos públicos de las Semanas 02 y 03.

Los workflows `.github/workflows/week-02-w02-shell-manifest.yml` y `.github/workflows/week-03-w03-service-worker-offline.yml` repiten una instalación limpia y `make verify` en cada `push`, pull request o ejecución manual, y publican el reporte como artefacto. La evidencia debe asociarse al SHA exacto evaluado.

## Implementación de Semana 02

- `public/manifest.webmanifest` declara nombre, nombre corto, idioma, `start_url`, `scope`, modo `standalone`, colores, iconos `192x192` y `512x512`, icono maskable, shortcuts y capturas.
- `src/app/layout.tsx` enlaza el manifest y expone metadata de iconos, Apple Web App y viewport.
- `src/components/app-shell.tsx` concentra el shell responsive, landmarks, navegación principal operable por teclado, perfil y feedback de carga, error y vacío.
- `src/app/loading.tsx` y `src/app/error.tsx` aíslan esperas y fallos de ruta; la vista inicial selecciona vacío cuando el repositorio sintético no entrega registros.
- `src/app/page.tsx` compone el shell con la navegación declarativa del rol y el workspace de inspecciones.

## Implementación de Semana 03 (offline y actualización)

- `public/sw.js` implementa `install` (precache del app shell `inspecciones-shell-w03-v1`), `activate` (purga de cachés obsoletas y `clients.claim()`), `message` (activación de versión nueva mediante `SKIP_WAITING`) y `fetch` (solo `GET` del mismo origen).
- La navegación usa `network first` con fallback a la navegación guardada y luego al `/` precacheado. Los assets estáticos usan `cache first` con poda FIFO (`MAX_STATIC_ASSETS = 50`).
- Se excluyen explícitamente de la caché las rutas sensibles `/api`, `/login`, `/sync`, `/auth/` y `/_next/webpack-hmr`, las solicitudes no `GET`, otros orígenes y respuestas `no-store`/`private`/no exitosas: no se cachean secretos, tokens, PII ni mutaciones.
- `src/lib/pwa/register-service-worker.ts` registra `/sw.js` con scope `/` desde un límite client-only, no falla en SSR ni en navegadores sin soporte, y expone callbacks de registro, error, actualización disponible y cambio de controller.
- `src/components/pwa/service-worker-registration.tsx` monta el registro desde `src/app/layout.tsx`; `activateServiceWorkerUpdate` envía `{ type: "SKIP_WAITING" }` para activar la versión nueva sin bucle de recarga.
- `docs/cache-strategy.md` especifica el inventario, clasificación, versionado, límites, exclusiones, fallbacks, supuestos y trade-offs de la política de caché.

## Decisiones y trade-offs

Se eligió un manifest estático en `public/` y metadata nativa de Next.js: el resultado es inspeccionable, no depende de una API y conserva una única fuente para las propiedades de instalación. El costo es que cualquier personalización por entorno requiere un build o un manifest generado en el futuro.

El shell recibe navegación y perfil mediante props en lugar de consultar sesión o datos por sí mismo. Esto mantiene el límite visual reutilizable y permite probar estados deterministas, a cambio de que cada ruta componga explícitamente su contexto.

Los estados se representan con semántica accesible (`aria-busy`, regiones de estado, alerta y botón de reintento). La prueba automatizada protege su contrato estructural; no sustituye una auditoría WCAG ni una prueba E2E en varios navegadores.

En Semana 03, la caché se separa en tres categorías versionadas (shell, navegación y estáticos) con una misma versión `w03-v1`: el app shell se precachea, la navegación prioriza red con fallback guardado y los estáticos se sirven desde caché. Las rutas sensibles y las mutaciones no se interceptan nunca, porque Cache Storage no debe reutilizar respuestas de autenticación, API o sincronización. El costo de esta seguridad es que esas rutas no tienen fallback offline y un cambio de versión mal coordinado puede descargar recursos de nuevo.

## Supuestos, límites y fallos encontrados

- Se asume despliegue en la raíz del mismo origen (`scope` y `start_url` son `/`). Un despliegue bajo subruta exigiría ajustar ambos valores y los shortcuts.
- La Semana 02 hace la aplicación instalable a nivel de manifest; la Semana 03 añade service worker y navegación offline, pero no sincronización real, IndexedDB ni Background Sync. Cache Storage conserva respuestas HTTP; no es una base de datos de inspecciones.
- El service worker no cachea datos sensibles ni mutaciones, pero la revisión de credenciales requiere herramientas especializadas adicionales; `make verify` no la sustituye.
- El registro del navegador (`navigator.serviceWorker.register`) y la UI de detección de actualización no se prueban automáticamente: deben validarse manualmente en el entorno de entrega.
- La disponibilidad del botón de instalación depende de los criterios y políticas del navegador.
- La rama `feat/pwa-manifest-icons` divergió de `main` en `src/app/layout.tsx`. El merge conservó el título/descripción vigentes y la metadata PWA. Además, `manifest.json` se renombró a `manifest.webmanifest` para cumplir el contrato del profesor sin perder el historial de la contribución.
- Las capturas e iconos son artefactos sintéticos del proyecto; no incluyen PII.

## Prueba manual offline y actualización

Levantar la build de producción:

```bash
npm run build
npm run start
```

Con DevTools (Chrome): abrir `http://localhost:3000`, verificar en **Application → Service Workers** que `/sw.js` esté activo y controla la página, y en **Application → Cache Storage** las tres cachés `inspecciones-*-w03-v1`.

1. **Registro y precache**: la primera carga registra el service worker y precachea `APP_SHELL_URLS`; recargar confirma `activated`.
2. **Navegación offline con caché**: visitar `/` y una ruta (p. ej. `/inspections`), activar **Offline** en el panel Network y recargar; debe servirse la navegación guardada o el fallback a `/`.
3. **Navegación offline sin caché**: activar Offline antes de visitar una ruta nunca visitada; se devuelve el fallback del app shell o un error de red controlado.
4. **Exclusiones**: con red disponible solicitar `/login` y `/sync`; comprobar que no se crean respuestas cacheadas por este service worker para esas rutas.
5. **Actualización segura**: cambiar `CACHE_VERSION` en `public/sw.js`, publicar la nueva versión, recargar la pestaña y confirmar `updatefound`/`installed`; enviar `SKIP_WAITING` para activarla y verificar que `activate` purga las cachés viejas y conserva las de `w03` vigentes.

Registrar fecha, navegador, URL, estado de red, versión de caché y resultado observado.

## Evidencia y colaboración

El reporte individual está en `evidence/individual.md`. El commit funcional principal de Imanol es `15f08bb763e29d966087414fc1299361bdf2fa6f`; los commits `4a163f1` y `d39ff30` preservan el aporte de Osbaldo al manifest y sus recursos. Para Semana 03, el aporte técnico principal de Imanol es el commit `1192dfccab246a60464e99a46b426d4ba34e38d4` (service worker y registro seguro, PR #21); Osbaldo contribuye las suites `tests/service-worker.spec.ts` y `tests/offline.spec.ts` (PR #22) y Jose Julian documenta la estrategia en `docs/cache-strategy.md` (PR #24). La integración final de la Semana 03 queda registrada en el PR de esta entrega.

Las instrucciones acotadas para que los integrantes restantes verifiquen el resultado y completen únicamente su propia evidencia están en `docs/week-02-contributor-guide.md`.

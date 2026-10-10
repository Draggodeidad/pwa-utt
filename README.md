# PWA de inspecciones de laboratorio

Proyecto integrador del equipo **9B-E02** para registrar inspecciones y mantenimiento de laboratorios con datos exclusivamente sintéticos. El incremento de la Semana 02 incorpora un shell instalable, navegación por rol, un Web App Manifest y estados accesibles de carga, error y vacío. El incremento de la Semana 03 incorpora un service worker con precache del app shell, navegación offline con fallback, caché de assets estáticos y actualización controlada. La Semana 04 compara un listado CSR interactivo con un detalle SSR.

## Requisitos del entorno

- Node.js 22.x, como declara `package.json`.
- npm 10 o posterior.
- Git; Make es opcional.

Los workflows W05 y W06 usan Node.js 22.22.3. No se requieren servicios externos, cuentas privadas, variables de entorno ni credenciales para instalar, probar o compilar.

## Instalación y ejecución

Desde la raíz del repositorio:

```bash
npm ci
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

El verificador ejecuta, en orden, `npm run typecheck`, `npm test`, `npm run build` y `npm run measure:rendering`, y genera `reports/verification.json` y `reports/rendering-metrics.json`. La suite incluye:

- `tests/starter.spec.mjs`: conserva el comportamiento acumulativo del proyecto.
- `tests/manifest.spec.ts`: valida campos de instalación, iconos reales, scope, shortcuts, metadata, landmarks y presencia de estados críticos.
- `tests/service-worker.spec.ts`: valida el ciclo de vida de `public/sw.js` (precache, activación, `SKIP_WAITING` y exclusiones de fetch).
- `tests/offline.spec.ts`: valida navegación online/offline, fallback, cache-first de estáticos y poda FIFO.
- `tests/rendering.spec.ts`: comprueba el HTML de CSR y SSR, filtros sintéticos, estados y respuesta 404.
- `bash public-tests/check.sh`: comprueba los artefactos públicos acumulativos, incluidos los de Semana 04.

Los workflows de las Semanas 02, 03 y 04 repiten una instalación limpia y `make verify` en cada `push`, pull request o ejecución manual. El workflow W04 publica ambos reportes como artefactos. La evidencia debe asociarse al SHA exacto evaluado.

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

## Implementación de Semana 04 (CSR y SSR)

- `/inspecciones` gestiona en cliente la carga de la colección sintética, búsqueda y filtros. Next.js prerenderiza el estado de carga inicial en HTML; no confundir ese HTML inicial con los registros, que aparecen tras la transición de cliente. `?estado=cargando`, `?estado=error` y `?estado=vacio` permiten inspeccionar estados de demostración.
- `/inspecciones/[id]` declara `dynamic = "force-dynamic"` y resuelve los datos sintéticos en servidor para incluirlos en el HTML. Un ID desconocido responde HTTP 404; `?estado=error` muestra el estado de error de demostración. `src/app/inspecciones/loading.tsx` y `src/app/inspecciones/[id]/loading.tsx` presentan carga, y la ruta detalle tiene `error.tsx` para fallos inesperados.
- `tests/rendering.spec.ts` comprueba estados accesibles, contenido HTML, filtros, consistencia de registros y 404. Está encadenada en `npm test` y también puede ejecutarse directamente con `node tests/rendering.spec.ts`.
- `npm run measure:rendering` requiere una build previa y registra tiempos HTTP y tamaño HTML para listado y detalle; no mide hidratación ni tiempo hasta mostrar datos CSR. `docs/rendering-decision.md` documenta la decisión, sus supuestos, límites y validación.

## Baseline de Semana 05

La base común de la app completa, el inventario de persistencia y sincronización, la comparación del kit W05 y el contrato propuesto para Julian y Osbaldo están en `docs/w05-baseline.md`. Las rutas obligatorias W05 exponen la implementación existente; `docs/sync-policy.md` explica su política y `tests/sync.spec.ts` prueba recuperación, reenvío y evidencia de conflictos con datos sintéticos. El workflow `.github/workflows/week-05-w05-sync-data.yml` ejecuta `make verify` con Node 22 y comprueba por separado los entregables mediante `bash public-tests/check-w05.sh`.

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

## Baseline de Semana 06 (#68)

`docs/w06-baseline.md` registra la inspección completa del kit, brechas y contratos. La app ya tiene Auth/Supabase, IndexedDB v3, cola persistente, conflictos, cámara/fotos #69 y ubicación/avisos locales opcionales #70. La documentación y suites de comportamiento pertenecen a #71/#72.

El workflow `.github/workflows/week-06-w06-device-push.yml` ejecuta `npm ci`, checks públicos acumulativos y `make verify` con Node 22.22.3. Publica los reportes reales, sin generar una calificación docente. `bash public-tests/check-w06.sh` comprueba contenido e integración; no acredita comportamiento.

`npm test` conserva todas las suites anteriores, prueba la infraestructura con `tests/w06-baseline.spec.mjs` y ejecuta el runner único `tests/capabilities.spec.ts`. **npm test y make verify fallan mientras falten los módulos, documentación o suites W06**; ese estado es intencional y no un pase. Cada suite auxiliar debe importar los adaptadores reales, ejecutar assertions y devolver un entero positivo de escenarios completados. Los contratos por sí solos no verifican capacidades.

Fotos: JPEG/PNG/WebP, hasta 5 MiB por archivo y tres por hallazgo. Esta extensión usa Storage privado y es distinta del mínimo docente. Permisos voluntarios, selección manual del laboratorio y avisos dentro de la app mantienen el flujo útil. No se implementa servidor Push/VAPID en el baseline.


## Cámara y fotos W06 (#69)

El editor permite capturar/seleccionar y confirmar fotos con el hallazgo. Los pendientes sobreviven offline; la subida usa Storage privado y bloquea finalización hasta confirmar o descartar. Preparación manual de bucket y migración, permisos, recuperación y validación humana pendiente: [docs/w06-photo-storage.md](docs/w06-photo-storage.md). Se añadieron pruebas propias; el gate W06 sigue exigiendo las contribuciones restantes sin omitirlas.

## Ubicación y avisos opcionales W06 (#70)

En el editor, **Obtener ubicación** realiza una petición puntual de baja precisión (timeout 10 s, sin reutilizar una posición anterior). La captura permanece en memoria hasta confirmar la finalización; **Borrar ubicación**, salir del editor o cambiar de sesión la descarta antes de finalizar. Al finalizar se guardan latitud, longitud, precisión e instante de captura para el coordinador; sin captura se guarda `null` y la finalización continúa normalmente. El borrador no incorpora GPS y el laboratorio sigue siendo manual. El coordinador ve coordenadas y enlace a mapa en el detalle; el técnico no recibe GPS de la API. Migración, permisos y pruebas: [docs/w06-inspection-location.md](docs/w06-inspection-location.md).

En **Sincronización**, **Activar avisos de sincronización** solicita permiso únicamente al pulsarlo. La activación se conserva durante las navegaciones de esta pestaña y se pierde al recargar o cerrar/cambiar sesión; **Desactivar avisos** conserva los avisos dentro de la app. Una sincronización con ACKs persistidos, sin cola ni conflictos pendientes, muestra un mensaje genérico. Fallos, resultados parciales y una cola vacía sin un ACK nuevo no generan ese evento. Repetir la identidad del último ACK no duplica la presentación, incluso si previamente se utilizó fallback.

Son notificaciones locales producidas mientras la app ejecuta la sincronización. No hay suscripción Push remota, VAPID, servidor ni garantía de nuevos avisos con la app cerrada. El adaptador prefiere el service worker activo; el constructor de Notification es un fallback para plataformas que lo admiten. En móvil se recomienda el service worker ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)); iOS/iPadOS 16.4 incorporan soporte para apps añadidas a la pantalla de inicio y requieren interacción directa para solicitar permiso ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). La disponibilidad depende del navegador, instalación y permiso; siempre queda el aviso accesible dentro de la app.

Exports inyectables, evento interno y criterios de pruebas para Julian: [baseline W06](docs/w06-baseline.md#integración-implementada-en-70). Ejecutar con Node 22.22.3: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, los tres checks públicos y `make verify`, de forma secuencial. El gate aún exige `docs/capabilities.md` y las dos suites auxiliares de #71/#72; no se omiten. No hay script/binario de lint independiente ni se añade ESLint. La revisión en hardware/navegador real y la validación humana siguen pendientes.

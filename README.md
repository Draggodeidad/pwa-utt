# PWA de inspecciones de laboratorio

Proyecto integrador del equipo **9B-E02** para registrar inspecciones y mantenimiento de laboratorios con datos exclusivamente sintéticos. La aplicación actual usa Supabase Auth/Postgres/RLS, IndexedDB v3, cola durable, resolución de conflictos y service worker. W06 añade cámara/fotos, GPS voluntario al finalizar y avisos locales de sincronización con fallback. Las secciones de Semanas 02–04 conservan el historial; el setup y la entrega W06 siguientes describen el estado actual.

## Requisitos del entorno

- Node.js 22.x, como declara `package.json`.
- npm 10 o posterior.
- Git; Make es opcional.

Los workflows W05 y W06 usan Node.js 22.22.3. `npm ci`, las pruebas sintéticas y el build no requieren servicios privados ni credenciales. Usar la aplicación autenticada sí requiere Supabase; compilar sin configuración no crea un backend ni una sesión de demostración.

## Instalación y ejecución

Desde la raíz del repositorio:

```bash
npm ci
npm run dev
```

Abre `http://localhost:3000`. Sin configuración puedes inspeccionar la pantalla de acceso; las rutas autenticadas no usan un fallback sintético. Los tests levantan su propio backend controlado y no configuran el servidor de desarrollo que ejecutas por separado.

### Uso conectado a Supabase

1. En el proyecto de prueba autorizado, revisar qué migraciones ya están aplicadas. Para una base nueva, ejecutar en SQL Editor, completas y en orden, las cinco migraciones de `supabase/migrations/` que comienzan con `20260929` y `20260930`. No repetir migraciones aplicadas ni ejecutar los bootstrap de `supabase/tests/` en el proyecto remoto.
2. En Dashboard → Storage crear el bucket **privado** `finding-photos`, límite **5242880 bytes**, MIME permitidos exactamente `image/jpeg`, `image/png`, `image/webp`. Ejecutar después `20261009234656_finding_photos.sql`, luego `20261010000000_inspection_locations.sql` y finalmente `20261010010000_coordination_lifecycle.sql`. Revisar el resultado de cada transacción antes de continuar. No añadir políticas Storage permisivas que amplíen las políticas del módulo.
3. Ejecutar `supabase/seed.sql` para el catálogo sintético. Crear cuentas ficticias desde Authentication → Users; el trigger crea perfiles técnicos. Seguir los comentarios del seed para elevar únicamente el UUID autorizado a coordinador y comprobar que se actualiza una fila. Usar una segunda cuenta técnica para probar aislamiento.
4. Copiar `.env.example` a `.env.local` y completar **sólo** `SUPABASE_URL` y `SUPABASE_ANON_KEY` en el servidor. No publicar sus valores ni usar `service_role`. Reiniciar `npm run dev`; para producción local, ejecutar `npm run build` y `npm start` con la misma configuración del servidor.
5. Iniciar sesión con esas cuentas normales y comprobar creación, guardado offline, sincronización, fotos y permisos. Cámara/GPS/avisos requieren HTTPS o localhost y acción explícita. Este procedimiento está documentado, pero no se aplicó ni validó contra Supabase remoto durante la consolidación #73.

No hay comando npm de migración. Detalles de permisos/recuperación: [fotos y bucket](docs/w06-photo-storage.md), [GPS](docs/w06-inspection-location.md) y [coordinación](docs/coordinator-lifecycle.md).

## Verificación reproducible

La verificación completa puede ejecutarse con cualquiera de estos comandos equivalentes:

```bash
make verify
# o, si Make no está disponible
npm run verify
```

El verificador ejecuta, en orden, `npm run typecheck`, `npm test`, `npm run build`, `npm run measure:rendering` y el gate `bash public-tests/check-w06.sh`; genera `reports/verification.json` y `reports/rendering-metrics.json` (ignorados en Git). `npm ci` se ejecuta por separado. La suite incluye:

- `tests/starter.spec.mjs`: conserva el comportamiento acumulativo del proyecto.
- `tests/manifest.spec.ts`: valida campos de instalación, iconos reales, scope, shortcuts, metadata, landmarks y presencia de estados críticos.
- `tests/service-worker.spec.ts`: valida el ciclo de vida de `public/sw.js` (precache, activación, `SKIP_WAITING` y exclusiones de fetch).
- `tests/offline.spec.ts`: valida navegación online/offline, fallback, cache-first de estáticos y poda FIFO.
- `tests/rendering.spec.ts`: comprueba el HTML de CSR y SSR, filtros sintéticos, estados y respuesta 404.
- `bash public-tests/check.sh`: comprueba los artefactos públicos acumulativos, incluidos los de Semana 04.

El workflow W06 repite instalación limpia, checks acumulativos y `make verify`, y publica ambos reportes en el artefacto `w06-baseline-verification`. Para acreditar el incremento usar el workflow W06 del SHA entregado; las ejecuciones históricas de W01–W05 no lo sustituyen. La evidencia debe asociarse al SHA exacto evaluado.

## Implementación de Semana 02

- `public/manifest.webmanifest` declara nombre, nombre corto, idioma, `start_url`, `scope`, modo `standalone`, colores, iconos `192x192` y `512x512`, icono maskable, shortcuts y capturas.
- `src/app/layout.tsx` enlaza el manifest y expone metadata de iconos, Apple Web App y viewport.
- `src/components/app-shell.tsx` concentra el shell responsive, landmarks, navegación principal operable por teclado, perfil y feedback de carga, error y vacío.
- `src/app/loading.tsx` y `src/app/error.tsx` aíslan esperas y fallos de ruta; la vista inicial selecciona vacío cuando el repositorio sintético no entrega registros.
- `src/app/page.tsx` compone el shell con la navegación declarativa del rol y el workspace de inspecciones.

## Implementación de Semana 03 (offline y actualización)

Descripción histórica de W03. Actualmente `public/sw.js` usa `phase-25-<build-id>`, precache de `/offline` y assets públicos, sin guardar HTML privado de navegación. IndexedDB y la cola conservan los datos por cuenta; el flujo de actualización coordina las pestañas y trabajo pendiente. Véanse `tests/offline-shell.spec.ts` y `tests/safe-pwa-update.spec.ts`.

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
- En W02/W03 aún no existían IndexedDB ni sincronización; la aplicación actual sí los implementa. Cache Storage conserva assets públicos, mientras IndexedDB conserva datos y operaciones por cuenta. No se promete Background Sync con la app cerrada.
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

Con DevTools (Chrome): abrir `http://localhost:3000`, verificar en **Application → Service Workers** que `/sw.js` esté activo y controla la página, y en **Cache Storage** las cachés shell/static de la versión `phase-25-<build-id>` generada por postbuild.

1. **Registro y precache**: confirmar `activated` y que `/offline` y los assets de `offline-assets.json` están disponibles.
2. **Captura offline**: iniciar sesión con datos sintéticos, cargar un borrador, desconectar, guardar y recargar; comprobar recuperación local y cola pendiente mediante el shell offline.
3. **Exclusiones**: comprobar que no se cachean HTML privado, `/api`, `/login`, `/sync` ni mutaciones. Una petición API sin red no debe fingir confirmación remota.
4. **Recuperación**: reconectar, sincronizar y confirmar ACK antes de mostrar éxito; revisar errores/conflictos y las fotos pendientes.
5. **Actualización segura**: probar con otra build local, usando la UI de actualización y dos pestañas con trabajo pendiente; confirmar que la coordinación protege la captura. Conservar cachés de assets compatibles no implica conservar HTML privado.

Registrar fecha, navegador, URL, estado de red, versión de caché y resultado observado.

## Evidencia y colaboración

El reporte individual está en `evidence/individual.md`. El commit funcional principal de Imanol es `15f08bb763e29d966087414fc1299361bdf2fa6f`; los commits `4a163f1` y `d39ff30` preservan el aporte de Osbaldo al manifest y sus recursos. Para Semana 03, el aporte técnico principal de Imanol es el commit `1192dfccab246a60464e99a46b426d4ba34e38d4` (service worker y registro seguro, PR #21); Osbaldo contribuye las suites `tests/service-worker.spec.ts` y `tests/offline.spec.ts` (PR #22) y Jose Julian documenta la estrategia en `docs/cache-strategy.md` (PR #24). La integración final de la Semana 03 queda registrada en el PR de esta entrega.

Las instrucciones acotadas para que los integrantes restantes verifiquen el resultado y completen únicamente su propia evidencia están en `docs/week-02-contributor-guide.md`.

## Baseline de Semana 06 (#68)

`docs/w06-baseline.md` registra la inspección completa del kit, brechas y contratos. La app ya tiene Auth/Supabase, IndexedDB v3, cola persistente, conflictos, cámara/fotos #69 y ubicación/avisos locales opcionales #70. La documentación y suites de comportamiento pertenecen a #71/#72.

El workflow `.github/workflows/week-06-w06-device-push.yml` ejecuta `npm ci`, checks públicos acumulativos y `make verify` con Node 22.22.3. Publica los reportes reales, sin generar una calificación docente. `bash public-tests/check-w06.sh` comprueba contenido e integración; no acredita comportamiento.

`npm test` conserva todas las suites anteriores, prueba la infraestructura con `tests/w06-baseline.spec.mjs` y ejecuta el runner único `tests/capabilities.spec.ts`. Las contribuciones #71/#72 ya están integradas: 25 escenarios de cámara/fotos y 16 de ubicación/avisos. El runner continúa fallando ante módulos ausentes/vacíos, exports inválidos, cero escenarios o assertions fallidas. Los contratos por sí solos no verifican capacidades.

Fotos: JPEG/PNG/WebP, hasta 5 MiB por archivo y tres por hallazgo. Esta extensión usa Storage privado y es distinta del mínimo docente. Permisos voluntarios, selección manual del laboratorio y avisos dentro de la app mantienen el flujo útil. No se implementa servidor Push/VAPID en el baseline.


## Cámara y fotos W06 (#69)

El editor permite capturar/seleccionar y confirmar fotos con el hallazgo. Los pendientes sobreviven offline; la subida usa Storage privado y bloquea finalización hasta confirmar o descartar. Preparación manual de bucket y migración, permisos, recuperación y validación humana pendiente: [docs/w06-photo-storage.md](docs/w06-photo-storage.md). Las suites propias y la validación independiente de Osbaldo están registradas en `npm test`.

## Ubicación y avisos opcionales W06 (#70)

En el editor, **Obtener ubicación** realiza una petición puntual de baja precisión (timeout 10 s, sin reutilizar una posición anterior). La captura permanece en memoria hasta confirmar la finalización; **Borrar ubicación**, salir del editor o cambiar de sesión la descarta antes de finalizar. Al finalizar se guardan latitud, longitud, precisión e instante de captura para el coordinador; sin captura se guarda `null` y la finalización continúa normalmente. El borrador no incorpora GPS y el laboratorio sigue siendo manual. El coordinador ve coordenadas y enlace a mapa en el detalle; el técnico no recibe GPS de la API. Migración, permisos y pruebas: [docs/w06-inspection-location.md](docs/w06-inspection-location.md).

En **Sincronización**, **Activar avisos de sincronización** solicita permiso únicamente al pulsarlo. La activación se conserva durante las navegaciones de esta pestaña y se pierde al recargar o cerrar/cambiar sesión; **Desactivar avisos** conserva los avisos dentro de la app. Una sincronización con ACKs persistidos, sin cola ni conflictos pendientes, muestra un mensaje genérico. Fallos, resultados parciales y una cola vacía sin un ACK nuevo no generan ese evento. Repetir la identidad del último ACK no duplica la presentación, incluso si previamente se utilizó fallback.

Son notificaciones locales producidas mientras la app ejecuta la sincronización. No hay suscripción Push remota, VAPID, servidor ni garantía de nuevos avisos con la app cerrada. El adaptador prefiere el service worker activo; el constructor de Notification es un fallback para plataformas que lo admiten. En móvil se recomienda el service worker ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)); iOS/iPadOS 16.4 incorporan soporte para apps añadidas a la pantalla de inicio y requieren interacción directa para solicitar permiso ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). La disponibilidad depende del navegador, instalación y permiso; siempre queda el aviso accesible dentro de la app.

Los adaptadores inyectables, el evento de sincronización confirmada y sus límites están documentados en `docs/capabilities.md` y en el [baseline W06](docs/w06-baseline.md#integración-implementada-en-70). `tests/capabilities.spec.ts` es el runner único registrado en `npm test`; ejecuta la suite de cámara/fotos y `tests/helpers/capabilities-geolocation-notifications.ts`, que importa geolocalización/notificaciones reales y prueba permisos, fallbacks, SSR seguro, persistencia sin GPS, confirmación y deduplicación con fixtures sintéticos. `tests/inspection-location.spec.ts` cubre además el transporte/persistencia GPS a finalización. Ejecutar secuencialmente con Node 22.22.3: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, los tres checks públicos y `make verify`. El runner valida contratos; el gate W06 también verifica la presencia e integración de artefactos. No hay script/binario de lint independiente ni se añade ESLint. La revisión con permisos y hardware real sigue pendiente; estas pruebas no acreditan GPS físico, cámara real, RLS remota ni Push.

### Revisión y archivo de coordinación

Coordinación puede aprobar/rechazar una inspección finalizada autorizada, archivar, consultar Histórico, desarchivar y eliminar lógicamente con confirmación del folio exacto. Estas acciones requieren conexión y no cambian el flujo técnico ni el seguimiento de hallazgos. Aplicar primero `20261010010000_coordination_lifecycle.sql` después de las migraciones W06 existentes; no se ejecutó en Supabase remoto. Contratos, permisos, rollback, pruebas y recorrido manual: [flujo de coordinación](docs/coordinator-lifecycle.md). Pruebas SQL/RLS/concurrencia en PostgreSQL local desechable: `bash scripts/test-coordination-sql.sh`.

**Nota sobre eliminar lógicamente:** la inspección desaparece de Activas, Histórico y métricas, pero sus datos, hallazgos y fotografías se conservan. Se registra quién la eliminó y cuándo; los permisos bloquean su consulta y modificación normales. Archivar permite consultar la inspección en Histórico y desarchivarla; eliminar lógicamente no ofrece restauración desde la interfaz. Una recuperación futura requeriría mantenimiento controlado por un administrador de base de datos autorizado. Consulta los [detalles y límites de la eliminación lógica](docs/coordinator-lifecycle.md#qué-significa-eliminar-lógicamente).

## Entrega verificable W06 (#73)

Entrega preparada en [PR #74](https://github.com/Draggodeidad/pwa-utt/pull/74), rama `feat/w06-baseline-contracts`, sin merge ni envío a Classroom. El [reporte de consolidación](docs/w06-delivery.md) enlaza rúbrica → issue → artefacto → validación y distingue resultados técnicos de pendientes humanos/remotos. La evidencia propia de los tres integrantes se conserva en [evidence/individual.md](evidence/individual.md).

Fijar el SHA completo del head evaluado que aparece en `reports/verification.json` y en la ejecución de [Actions W06](https://github.com/Draggodeidad/pwa-utt/actions/workflows/week-06-w06-device-push.yml); descargar allí `w06-baseline-verification` y contrastar `commitSha`. No es necesario crear un tag. Fecha objetivo: **11/10/2026, America/Mexico_City**; el correo no indica hora y debe confirmarse en Classroom. Esta solicitud no incluye el envío al LMS.

El kit local ya fue inspeccionado y coincide con #68; no equivale a contrato aprobado ni habilita el evaluador privado. Permanecen pendientes cámara/GPS y notificación del SO con hardware real, Storage/RLS remoto, Safari/iPhone y otros navegadores, revisión/defensa humana del owner y hora oficial. Las notificaciones son locales, sin Push/VAPID ni garantía con la app cerrada. No se declara calificación ni cierre total de #73 por el solo PASS técnico.

## E2E del flujo crítico W08

La automatización usa `@playwright/test` fijado en `1.64.1` porque el repositorio no tenía controlador de navegador; este paquete reúne runner, assertions y ciclo de servidor de prueba en una sola dependencia. Se ejecuta con Chromium para verificar el flujo real de login técnico, captura y validación, guardado en IndexedDB, recarga offline con Service Worker, sincronización idempotente, finalización y acceso de coordinación. Incluye la comprobación de que coordinación no ve el borrador.

Instalación reproducible desde checkout limpio (Node 22.x):

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e` reemplaza las variables de Supabase por valores sintéticos durante la build y la prueba, compila la app y levanta Next junto con un backend Supabase sintético en puertos loopback efímeros; no necesita credenciales ni proyectos remotos. El fixture es el mismo que usa `tests/online-inspection-workflow.spec.ts`. Para que CI lo consuma, ejecuta los tres comandos anteriores en ese orden. El mock ejercita el contrato y las reglas de visibilidad modeladas por el test, pero **no acredita RLS remota de Supabase**, hardware físico ni compatibilidad con Firefox, WebKit o Safari. La cobertura E2E intencionalmente se limita al recorrido crítico en Chromium.

## Niveles de prueba e integración continua W08

Las suites originales siguen ejecutándose con `npm test`. Para ejecutar los niveles por separado:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

Unitarias descubre `tests/unit/*.spec.ts` y reutiliza las assertions de dominio existentes. Integración descubre `tests/integration/*.spec.ts` y reutiliza el recorrido de Next HTTP contra el backend sintético. Las entradas se descubren automáticamente, fallan si el nivel está vacío y propagan el código de salida. El contrato completo y los límites están en [docs/test-strategy.md](docs/test-strategy.md).

El workflow [Academic evaluation — W08](.github/workflows/academic-evaluation.yml) mantiene los checks públicos previos, ejecuta las suites unitarias e integración, luego `make verify` y E2E en Node 22.22.3, instala Chromium con Playwright y sube `academic-evaluation.json`, `verification.json` y `rendering-metrics.json` asociados al SHA probado aun si hay fallos. El orden deja la build de producción después de las pruebas HTTP con `next dev`; E2E la reutiliza dentro de Actions. Cuando se ejecuta localmente, `npm run test:e2e` compila antes de iniciar los servidores y el navegador. El reporte es técnico y **no asigna calificación**.

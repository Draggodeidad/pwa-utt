# Estrategia de caché de la PWA

## 1. Objetivo

Como integrante responsable de las decisiones técnicas, documento la estrategia de caché observable en la PWA de inspecciones para que el equipo pueda revisarla, mantenerla y verificarla sin confundir disponibilidad de recursos web con persistencia de inspecciones.

La estrategia busca que el **app shell**, el **manifest**, los **iconos**, la **navegación** y los **assets estáticos** tengan un comportamiento predecible ante conectividad intermitente. Esta especificación no introduce almacenamiento de datos de negocio, sincronización offline, Background Sync, IndexedDB ni resolución de conflictos. Esas capacidades no se consideran implementadas por el hecho de usar Cache Storage.

La decisión crítica es separar recursos de interfaz de recursos sensibles. Esto reduce la probabilidad de reutilizar respuestas que no deben persistir y hace que el comportamiento offline sea explicable. El beneficio es una política pequeña y auditable; el riesgo es que un recurso no incluido en la política no esté disponible sin red. Se verifica inspeccionando `public/sw.js` y ejecutando las verificaciones reproducibles descritas al final.

## 2. Alcance

Esta especificación cubre los recursos servidos por el mismo origen y la política actualmente expresada por `public/sw.js`:

- precache del app shell mínimo y de los recursos de instalación;
- caché runtime de navegaciones y assets estáticos solicitados;
- exclusión explícita de recursos sensibles y de solicitudes que no sean `GET`;
- versionado, límites de tamaño y limpieza de cachés obsoletos;
- fallback de navegación cuando la red no responde;
- actualización del service worker sin afirmar que exista una experiencia completa de aviso y confirmación para el usuario.

El alcance no incluye datos reales, backend, autenticación real, cola de sincronización, edición offline, caché de respuestas de API ni garantías de disponibilidad de todas las rutas de la aplicación sin conexión.

## 3. Inventario de recursos y rutas

El inventario se basa en el manifest, el layout, la página inicial, el app shell y la implementación actual del service worker.

| Recurso o grupo | Rutas o ejemplo | Fuente observable | Tratamiento |
|---|---|---|---|
| App shell inicial | `/` | `public/sw.js` y `src/app/page.tsx` | Precache; navegación también usa runtime cache |
| Manifest | `/manifest.webmanifest` | `public/manifest.webmanifest`, `src/app/layout.tsx` | Precache |
| Iconos PWA | `/icons/icon.svg`, `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable.svg`, `/icons/icon-maskable-512.png` | Manifest y metadata del layout | Los principales están en precache; otros iconos solicitados son assets runtime |
| Icono Apple | `/apple-touch-icon.png` | Metadata del layout y `public/sw.js` | Precache |
| Iconos de shortcuts | `/icons/shortcut-new.svg`, `/icons/shortcut-list.svg`, `/icons/shortcut-sync.svg` | Manifest | Runtime si son solicitados; no están en `APP_SHELL_URLS` |
| Navegación HTML | `/`, `/dashboard`, `/findings`, `/inspections`, `/inspections/new`, `/sync`, `/profile` y rutas de detalle | App Router y `request.mode === "navigate"` | Network first; se conserva una respuesta válida en runtime cache |
| Assets estáticos | `/_next/static/`, CSS, JavaScript, imágenes y fuentes | `isStaticAsset` en `public/sw.js` | Cache first; máximo de 50 entradas |
| Evidencia sintética | `/inspection-assets/*` y `/screenshots/*` | Directorios públicos del proyecto | Runtime como imágenes; no se precachean |
| Recursos sensibles excluidos | `/api`, `/login`, `/sync`, `/auth/`, `/_next/webpack-hmr` | `SENSITIVE_PATHS` en `public/sw.js` | Sin interceptación del service worker |

La navegación se compone mediante `AppShell` y la página inicial usa perfiles, rutas y datos sintéticos. La presencia de una ruta en este inventario no implica que su contenido pueda crearse, modificarse o sincronizarse sin conexión.

## 4. Clasificación de recursos

### Precache

El precache corresponde al conjunto `APP_SHELL_URLS`:

- `/`;
- `/manifest.webmanifest`;
- `/icons/icon.svg`;
- `/icons/icon-192.png`;
- `/icons/icon-512.png`;
- `/icons/icon-maskable.svg`;
- `/icons/icon-maskable-512.png`;
- `/apple-touch-icon.png`.

La elección es conservadora: son recursos pequeños, estáticos y necesarios para abrir la aplicación instalada, identificarla y mostrar su marca. El beneficio es disponer de una base mínima aun cuando falle la red. El riesgo es que una URL faltante haga fallar la instalación, porque `cache.addAll` trata el precache como una operación conjunta. Se verifica que cada ruta exista físicamente en `public/` y que el service worker complete su instalación.

### Runtime cache

El runtime cache contiene:

- respuestas de navegación `GET` que hayan respondido correctamente y sean cacheables;
- assets estáticos solicitados, incluyendo rutas `/_next/static/` y solicitudes cuyo destino sea `style`, `script`, `image` o `font`;
- imágenes sintéticas de `inspection-assets` y capturas cuando una pantalla las solicite.

La navegación usa **network first** para preferir contenido reciente. Los assets estáticos usan **cache first** para reducir latencia y conservar recursos versionados. El beneficio es equilibrar actualización y disponibilidad. El riesgo es mostrar una navegación previamente almacenada cuando la red no está disponible, o conservar un asset demasiado tiempo si el servidor entrega URLs sin huella de versión. Se verifica con la caché del navegador y pruebas del arnés del service worker.

### No cachear

No se interceptan:

- solicitudes que no sean `GET`;
- solicitudes de otro origen;
- rutas incluidas en `SENSITIVE_PATHS`: `/api`, `/api/`, `/login`, `/sync`, `/auth/` y `/_next/webpack-hmr`;
- respuestas que no sean exitosas o tengan `Cache-Control: no-store` o `private`.

Esta clasificación evita persistir credenciales, sesiones, datos de API, acciones de sincronización o tráfico de desarrollo. El beneficio es reducir exposición y efectos secundarios. El riesgo es que una función que dependa de una de estas rutas falle offline, lo cual es preferible a servir una respuesta sensible obsoleta. Se verifica enviando solicitudes de prueba y comprobando que no aparezcan en los cachés administrados por el service worker.

## 5. Estrategia de caché por categoría

| Categoría | Estrategia actual | Justificación técnica | Beneficio | Riesgo | Verificación |
|---|---|---|---|---|---|
| App shell | Precache de `/` y recursos de instalación | Son recursos estáticos y necesarios para iniciar la PWA | Inicio disponible después de una visita/instalación correcta | Una ruta faltante puede abortar la instalación | Inspección de `APP_SHELL_URLS`, existencia física y ciclo de instalación |
| Manifest e iconos | Precache de manifest, iconos principales e icono Apple | El navegador los necesita para identidad e instalación | Metadata y marca disponibles sin red | Cambios de marca requieren nueva versión | `tests/manifest.spec.ts`, revisión del manifest y DevTools |
| Navegación | Network first con fallback a navegación guardada y luego `/` | El HTML puede cambiar; sin red conviene reutilizar la última respuesta válida | Contenido reciente online y continuidad limitada offline | Puede mostrar contenido antiguo | Simular red caída tras visitar una ruta y revisar `NAVIGATION_CACHE` |
| Assets estáticos | Cache first, limitado a 50 entradas | CSS, scripts, imágenes y fuentes son reutilizables y suelen estar versionados por Next.js | Menor latencia y disponibilidad visual | Asset obsoleto o caché lleno | Solicitar asset online, repetir offline y revisar límite |
| Recursos sensibles | Bypass del service worker | No se debe persistir autenticación, API ni operaciones de sincronización | Reduce exposición de información y reenvíos incorrectos | No hay fallback offline para esas rutas | Verificar exclusión por ruta y método |

## 6. Matriz: Recurso | Estrategia | Motivo | Invalidación | Fallback | Verificación

| Recurso | Estrategia | Motivo | Invalidación | Fallback | Verificación |
|---|---|---|---|---|---|
| `/` | Precache y network first en navegación | App shell inicial y contenido de inicio | Cambio de `CACHE_VERSION` o nueva respuesta cacheable | Última navegación `/` o respuesta precacheada `/` | Instalación, navegación online/offline y `tests/service-worker.spec.ts` |
| `/manifest.webmanifest` | Precache | Metadata estática de instalación | Nueva versión del service worker | No se define un fallback alternativo | `tests/manifest.spec.ts` y existencia de la ruta |
| Iconos PWA y Apple | Precache | Identidad visual e instalación | Nueva versión del service worker | No se define un fallback alternativo | Verificar archivos y referencias del manifest/layout |
| Navegaciones `GET` no sensibles | Network first | Prioriza HTML actualizado sin perder la última copia válida | Nueva respuesta reemplaza la anterior; máximo 20 respuestas | Ruta solicitada en `NAVIGATION_CACHE`, luego `/` del app shell | Simulación de respuesta de red y desconexión |
| CSS, JavaScript, imágenes y fuentes | Cache first | Assets reutilizables y costosos de descargar | Nueva versión, reemplazo de URL o límite de 50 entradas | No se genera asset alternativo | Solicitud repetida y revisión de `STATIC_ASSET_CACHE` |
| `/inspection-assets/*` y `/screenshots/*` | Runtime cache como imágenes | Son evidencias sintéticas no indispensables para instalar | Nueva versión o expulsión por límite | No se define fallback específico | Cargar online, apagar red y volver a solicitar |
| `/api*`, `/login`, `/sync`, `/auth/*` | No cachear ni interceptar | Pueden contener datos o acciones sensibles | No aplica | Error normal de red o respuesta del servidor | Confirmar que no se agregan a Cache Storage |
| `/_next/webpack-hmr` | No cachear ni interceptar | Es tráfico de desarrollo y no contenido de usuario | No aplica | Canal normal de desarrollo | Inspección de `SENSITIVE_PATHS` |
| Métodos distintos de `GET` | No cachear ni interceptar | Cache Storage no debe reutilizar mutaciones | No aplica | Manejo normal de la aplicación | Enviar `POST`/`PUT`/`DELETE` y revisar que no haya `respondWith` |

## 7. Versionado de caché

La implementación actual declara `CACHE_VERSION = "w03-v1"` y deriva tres nombres:

- `inspecciones-shell-w03-v1`;
- `inspecciones-navigation-w03-v1`;
- `inspecciones-static-w03-v1`.

Mantengo un mismo identificador para las tres categorías porque una publicación debe representar un conjunto coherente de recursos. Al cambiar el app shell, el service worker o la política de caché, el equipo debe incrementar explícitamente la versión. El beneficio es evitar mezclar recursos de releases distintos. El riesgo es olvidar el incremento y servir una copia antigua; también una versión innecesariamente frecuente puede provocar descargas repetidas. Se verifica revisando el valor en `public/sw.js` y observando los nombres en Cache Storage.

El versionado no versiona datos de inspección ni resuelve conflictos. Es únicamente versionado de cachés del navegador.

## 8. Limpieza de versiones obsoletas

Durante `activate`, el service worker obtiene los nombres de caché y elimina los que empiezan por `inspecciones-` salvo los tres nombres activos. Esto limpia versiones anteriores del shell, navegación y assets estáticos. Además, `trimCache` conserva como máximo 20 respuestas de navegación y 50 assets estáticos, eliminando las entradas más antiguas según el orden de `cache.keys()`.

La decisión limita el crecimiento del almacenamiento local y evita que una versión anterior permanezca disponible indefinidamente. El beneficio es un uso acotado del dispositivo. El riesgo es expulsar una ruta que el usuario esperaba consultar sin conexión; por eso el límite no se interpreta como garantía de disponibilidad. Se verifica activando una versión nueva en un perfil de navegador con cachés previas y comprobando que solo permanezcan los nombres actuales y los máximos declarados.

## 9. Comportamiento offline

### Recurso cacheado

Si una navegación `GET` falla por red, se intenta devolver la misma URL desde `NAVIGATION_CACHE`; si no existe, se devuelve `/` desde `APP_SHELL_CACHE`. Para un asset estático, se devuelve primero la copia existente en `STATIC_ASSET_CACHE`.

Esto permite recuperar una interfaz previamente visitada y el app shell precacheado. No significa que se puedan registrar inspecciones, guardar borradores o sincronizar hallazgos: esas operaciones requieren capacidades de datos que no forman parte de esta política.

### Recurso no cacheado

Una ruta sensible, una solicitud no `GET`, un recurso de otro origen o un recurso que nunca se haya almacenado no recibe fallback del service worker. La aplicación queda sujeta al comportamiento normal de red y puede fallar si no hay conectividad.

Esta limitación es deliberada. Es más seguro no reutilizar una respuesta de autenticación, API o sincronización que presentar datos potencialmente obsoletos como si fueran actuales. Se verifica apagando la red y solicitando cada clase de recurso, diferenciando una respuesta desde Cache Storage de un error de red.

## 10. Estrategia de actualización segura

La actualización se basa en publicar un nuevo `sw.js` con una nueva `CACHE_VERSION`. El evento `install` prepara la nueva caché y `activate` elimina versiones antiguas antes de ejecutar `clients.claim()`.

El módulo `src/lib/pwa/register-service-worker.ts` observa `updatefound`, informa cuando existe una versión esperando y ofrece `activateServiceWorkerUpdate` mediante el mensaje `SKIP_WAITING`. Sin embargo, el componente actual de registro solo configura `onError`; no se debe afirmar que exista una interfaz visible que avise y confirme la actualización.

La decisión de no mezclar actualización de caché con migración de datos evita perder datos de negocio, porque esta estrategia no administra datos de negocio. El beneficio es una actualización simple y reproducible. El riesgo es que activar una nueva versión inmediatamente pueda cambiar la interfaz mientras el usuario trabaja; debe probarse la experiencia antes de habilitar un flujo visible de actualización. Se verifica con DevTools, una versión anterior instalada, una nueva versión del service worker y revisión del evento `controllerchange`.

## 11. Exclusiones de caché

Excluyo explícitamente los recursos sensibles definidos en el service worker:

- `/api` y `/api/`;
- `/login`;
- `/sync`;
- `/auth/`;
- `/_next/webpack-hmr`;
- cualquier solicitud que no sea `GET`;
- cualquier origen distinto del origen de la PWA;
- respuestas privadas, marcadas con `no-store` o `private`, y respuestas no exitosas.

La exclusión protege credenciales, sesiones, respuestas de API, operaciones de sincronización y tráfico de desarrollo. No constituye autenticación ni una garantía de que el servidor nunca pueda almacenar esos datos. La verificación consiste en revisar la función `isSensitiveRequest`, `isCacheable` y el comportamiento de Cache Storage durante una prueba controlada con datos sintéticos.

## 12. Supuestos

- La aplicación se despliega en la raíz del origen; el manifest declara `start_url` y `scope` como `/`.
- El service worker se sirve en `/sw.js` y se registra con scope `/` cuando el navegador soporta Service Workers.
- Los recursos del precache existen físicamente en `public/`; esto se comprobó para el app shell y los iconos actuales.
- El contenido usado en la actividad es sintético y no contiene credenciales ni información personal real.
- Las respuestas cacheadas se obtienen del mismo origen y respetan las cabeceras de cacheabilidad consideradas por `isCacheable`.
- La aplicación puede cambiar de versión mediante una nueva publicación del service worker.

## 13. Límites conocidos

- Cache Storage conserva respuestas HTTP; no es una base de datos de inspecciones.
- No se implementa persistencia de formularios, cola offline, Background Sync, IndexedDB ni sincronización con un backend.
- No se garantiza que todas las rutas de navegación hayan sido visitadas y estén disponibles offline.
- El fallback de navegación puede mostrar contenido antiguo y no expone por sí mismo una etiqueta de fecha o de desactualización.
- La estrategia no define resolución de conflictos, deduplicación ni permisos de edición.
- Los límites de 20 navegaciones y 50 assets son límites operativos, no requisitos de disponibilidad.
- La instalación de la PWA depende del navegador, HTTPS y sus criterios de instalación.
- `Cache-Control` y el comportamiento del navegador pueden afectar la disponibilidad de una respuesta.
- Un cambio de versión mal coordinado puede provocar descargas adicionales o una transición temporal entre clientes y cachés.

## 14. Fallos encontrados

No encontré una ruta faltante entre las entradas actuales de `APP_SHELL_URLS` y los archivos públicos comprobados, incluido `/apple-touch-icon.png`. Tampoco reporto como implementadas capacidades que los documentos de requisitos clasifican como futuras.

Sí identifico estos riesgos o carencias técnicas que deben permanecer visibles en la revisión:

- El componente `ServiceWorkerRegistration` solo registra el service worker y reporta errores; no muestra al usuario una notificación de actualización disponible ni invoca por sí mismo `SKIP_WAITING`.
- Los iconos de shortcuts y las capturas del manifest no están en el precache explícito; solo podrán estar disponibles offline después de haber sido solicitados y almacenados como assets runtime.
- La navegación network first puede cachear HTML de rutas no sensibles. Si esas rutas incorporan datos reales en el futuro, habrá que revisar la política antes de desplegarlas.
- El fallback a `/` no garantiza que una ruta profunda conserve su contexto funcional cuando se abre sin red.

Cada punto es verificable en el código y debe resolverse o aceptarse explícitamente en una revisión posterior; ninguno se presenta como una capacidad ya corregida.

## 15. Trade-offs y decisiones

1. **Precache pequeño frente a precache amplio.** Elegí un app shell pequeño porque reduce tiempo de instalación y almacenamiento inicial. El beneficio es una base estable; el riesgo es que recursos secundarios no estén disponibles en la primera desconexión.
2. **Network first para navegación.** Elegí contenido reciente cuando existe red y fallback cuando falla. El beneficio es menor obsolescencia online; el riesgo es depender de que la ruta haya sido visitada y cacheada.
3. **Cache first para assets estáticos.** Elegí reutilización local porque CSS, scripts, imágenes y fuentes se descargan repetidamente. El beneficio es velocidad; el riesgo es servir una copia antigua si no se cambia la versión o la URL.
4. **Excluir recursos sensibles.** Elegí bypass para API, login, sync, auth y HMR. El beneficio es no persistir respuestas delicadas ni mutaciones; el riesgo es ausencia total de fallback para esas rutas.
5. **Versionado global y limpieza en activate.** Elegí un identificador común y eliminación de nombres antiguos. El beneficio es coherencia entre categorías; el riesgo es descartar recursos útiles al actualizar.
6. **No tratar el caché como almacenamiento de negocio.** Mantengo esta separación porque Cache Storage no ofrece por sí mismo modelo de inspecciones, integridad, sincronización o resolución de conflictos. El beneficio es una frontera técnica defendible; el riesgo es que la experiencia offline de captura siga pendiente.

En cada decisión, la verificación debe combinar revisión del código con una prueba controlada de red online/offline. Una prueba positiva de caché no debe interpretarse como prueba de sincronización.

## 16. Relación con pruebas automatizadas o verificaciones manuales reproducibles

Mi responsabilidad en este documento es especificar y justificar la política; no implementar el service worker ni crear pruebas automatizadas nuevas. Las verificaciones existentes sirven como evidencia complementaria:

- `npm run verify` o `make verify` confirma typecheck, pruebas del proyecto y build, pero no prueba por sí solo que el navegador ejecute todos los caminos offline.
- `tests/manifest.spec.ts` verifica campos del manifest, referencias de iconos y contratos relacionados; respalda la existencia y coherencia de recursos de instalación, no la estrategia runtime completa.
- `tests/service-worker.spec.ts`, `tests/offline.spec.ts` y su arnés proporcionado pueden contrastarse con esta especificación para comprobar instalación, exclusiones, precache, navegación network first, assets cache first, fallback, versionado y limpieza. La documentación no afirma resultados que no hayan sido ejecutados en esta revisión.
- La comprobación manual reproducible consiste en abrir la aplicación con `npm run dev`, visitar `/`, una ruta de navegación y un recurso estático sintético, usar DevTools para inspeccionar Service Workers y Cache Storage, activar/desactivar la red y repetir las solicitudes.
- Para una actualización: instalar una versión, cambiar `CACHE_VERSION`, publicar o servir la nueva versión, comprobar `updatefound`, activar la versión y confirmar que los cachés antiguos se eliminan.
- Para exclusiones: solicitar `/login`, `/sync` o una ruta `/api` con red disponible, apagar la red y revisar que no se haya creado una respuesta cacheada por este service worker.

La evidencia debe registrar fecha, navegador, URL, estado de red, versión de caché y resultado observado. Si una prueba futura exige persistencia de registros, sincronización o conflictos, deberá tratarse como una nueva especificación de datos y no como una extensión implícita de esta estrategia de caché.

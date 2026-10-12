# Objetivo

Como responsable de documentación y pruebas de la Semana 06, registro las capacidades de dispositivo que el código actual expone, sus permisos, degradación y evidencia automatizada. Distingo entre contratos de adaptadores, integración con la aplicación y comportamiento que sólo puede confirmarse en un navegador/dispositivo real. Esta documentación no atribuye a mi contribución la implementación funcional de cámara, geolocalización o notificaciones.

# Capacidades disponibles

| Capacidad | Implementación observable | Uso/alcance | Evidencia automatizada disponible |
|---|---|---|---|
| Cámara | `createCameraClient` en `src/lib/device/camera.ts`; flujo de fotos descrito en `docs/w06-photo-storage.md` | Se abre por acción expresa, solicita video sin audio y permite selector de archivo como fallback | `tests/helpers/capabilities-camera.ts`, suites de fotos y runner W06 |
| Geolocalización | `createGeolocationClient` en `src/lib/device/geolocation.ts` y componente `OptionalLocation` | Captura puntual y opcional desde el editor; no usa seguimiento continuo | `tests/helpers/capabilities-geolocation-notifications.ts`, `tests/inspection-location.spec.ts` |
| Avisos de sincronización | `createNotificationsClient`, `createBrowserNotificationApi` y `SyncNotificationsProvider` | Notificación local de una sincronización completada; también hay feedback accesible dentro de la aplicación | Suite W06 de geolocalización/notificaciones y pruebas de sincronización existentes |
| Persistencia local | `LocalStorage` sobre IndexedDB y cola durable | Borradores, operaciones y blobs pendientes según sus contratos | `tests/local-storage.spec.ts`, `tests/local-capture.spec.ts`, `tests/photo-local.spec.ts`, `tests/inspection-location.spec.ts` |

La suite W06 única es `tests/capabilities.spec.ts`; carga `tests/helpers/capabilities-camera.ts` y `tests/helpers/capabilities-geolocation-notifications.ts`. Cada helper importa los adaptadores de producción y usa datos sintéticos. Los dobles se limitan a los ports de APIs de navegador y transporte que no están disponibles en Node.js; no representan una validación física de cámara, GPS, permisos del sistema operativo, Service Worker en dispositivo ni Push remoto.

# Matriz de permisos

| Capacidad/acción | Permiso o condición | Momento de solicitud | Resultado sin permiso/soporte |
|---|---|---|---|
| Cámara | Contexto seguro y permiso de `getUserMedia` | Al pulsar la acción de abrir cámara (`open`) | Error tipado y selector manual; no se pide al construir la factory |
| Ubicación | Contexto seguro y permiso del navegador para `getCurrentPosition` | Al pulsar **Obtener ubicación** o actualizarla | Se informa el motivo y se conserva el laboratorio seleccionado manualmente |
| Notificación local | Contexto seguro, API disponible y `Notification.permission` concedido | `requestPermission()` se ejecuta desde la acción explícita de activar avisos | `default`, denegación, API ausente o fallo conservan mensaje dentro de la app |
| Guardado de inspección | No depende del permiso de geolocalización | Guardado/finalización según el flujo de inspección | Se permite continuar sin coordenadas |
| Laboratorio | Selección explícita en el formulario | Acción ordinaria del usuario | Sigue siendo la fuente de ubicación funcional aunque no haya GPS |

# Matriz de fallback

| Capacidad | Condición observada | Resultado/fallback | Efecto sobre la operación principal |
|---|---|---|---|
| Cámara | Permiso denegado, API ausente, contexto inseguro o dispositivo no disponible | Resultado tipado con `fallback: "file-picker"` | El usuario puede seleccionar un archivo; no se bloquea por el permiso de cámara |
| Geolocalización | Permiso denegado | `denied / permission-denied`, `manual-laboratory` | Continúa la captura sin coordenadas |
| Geolocalización | API ausente o contexto inseguro | `unsupported` con código identificable y `manual-laboratory` | El laboratorio se selecciona manualmente |
| Geolocalización | Timeout o posición no disponible/inválida | `error` y `manual-laboratory` | Permite reintentar o continuar sin ubicación |
| Notificaciones | Permiso `default` o `denied`, API/contexto no disponible, o error de presentación | Fallback accesible `in-app`; códigos distinguen el motivo | No bloquea la cola, el ACK ni el guardado |
| Persistencia local | Error de escritura/cuota | La transacción falla y no se informa éxito falso | El caller recibe el error; recuperación real de cuota requiere intervención/flujo de producto |

# Geolocalización

`createGeolocationClient` recibe `isSecureContext`, `geolocation` y un reloj por inyección. La factory no evalúa `navigator` ni solicita permiso al importarse o construirse. `locate()` hace una única llamada a `getCurrentPosition`; no existe `watchPosition` en el adaptador. Por defecto usa baja precisión, `maximumAge: 0` y timeout de 10 segundos, con posibilidad de que el caller suministre opciones.

El adaptador valida latitud, longitud y precisión antes de devolver `success`, y adjunta el instante del reloj inyectado. Mapea denegación, timeout, API ausente, contexto inseguro y posición inválida/no disponible a resultados discriminados con fallback manual. La suite importa el adaptador real y usa posiciones exclusivamente sintéticas; no publica coordenadas reales.

En el formulario, `OptionalLocation` sólo inicia la captura desde la acción explícita. Sin éxito el campo no se incorpora al borrador; la extensión #70 persiste una instantánea opcional al finalizar. `tests/inspection-location.spec.ts` verifica el contrato de persistencia/cola y el render del componente de coordinación con fixtures sintéticos. La interacción física con prompts de permiso y GPS del dispositivo queda como LIMITACIÓN de la suite Node.

# Notificaciones

`createNotificationsClient` recibe la API, el estado seguro, un reloj y un callback de fallback. No pide permiso al construirse. `requestPermission()` sólo pide cuando el permiso actual es `default`; permiso `granted` se conserva y `denied` no se vuelve a solicitar por ese método. `showConfirmed()` no pide permiso: consulta disponibilidad/permiso y muestra sólo si ya está concedido.

El evento admitido es `sync-completed`, con identidad estable basada en propietario y último `operationId` confirmado. `confirmedSyncCompletion()` produce el evento sólo si hubo al menos un ACK, ningún fallo, cola pendiente ni conflicto sin resolver, la sesión sigue vigente y no hay actualización pausando la cola. El texto es genérico y no incluye coordenadas ni datos de una inspección.

El cliente reserva la identidad del evento durante llamadas concurrentes y la consume al terminar el primer intento, incluso si la presentación nativa falla y se usa el fallback. Repetir el mismo ID responde `already-shown` sin volver a presentar; la suite prueba esta política. Si falla una solicitud de permiso, una nueva acción explícita puede volver a intentarla. El adaptador no reintenta automáticamente la presentación fallida con el mismo ID.

`createBrowserNotificationApi` se construye desde la frontera cliente. Prefiere `ServiceWorkerRegistration.showNotification` cuando hay un registro activo; si no, intenta el constructor `Notification` disponible en la plataforma y espera confirmación de `show` o error/timeout. Un error no genera un segundo intento por otro mecanismo dentro del mismo intento; el caller conserva el fallback in-app.

# Cámara y fotografías

`createCameraClient` sólo pide `getUserMedia` al ejecutar `open()`, con `audio: false`; la configuración de video prefiere la cámara orientada al entorno. La sesión permite captura y `stop()` idempotente. Los errores tipados conservan `file-picker` como alternativa. No implementé ni cambié estos flujos en la contribución de documentación/pruebas de #71.

El módulo de fotos está detallado en `docs/w06-photo-storage.md`: extensión autorizada de fotos sintéticas, límites y flujo de almacenamiento. La suite existente `tests/helpers/capabilities-camera.ts` y las suites `photo-validation`, `photo-local` y `photo-remote` pertenecen a la contribución de cámara/fotos. Sus dobles de transporte no equivalen a validar un bucket Supabase real.

# Privacidad

- La ubicación es opcional, de captura puntual y con acción consciente; el formulario mantiene selección manual del laboratorio.
- En el flujo #70, el GPS no se persiste en el borrador y sólo se añade al confirmar la finalización. Borrarlo o salir antes de finalizar descarta la captura temporal.
- La ubicación detallada sólo se entrega al coordinador autorizado según el contrato y las políticas del proyecto. La suite local no certifica RLS de un despliegue remoto.
- Las notificaciones usan un texto genérico; no deben incluir nombre de laboratorio, hallazgos, coordenadas, tokens ni credenciales.
- Las capturas/pruebas de este documento emplean IDs y contenido sintéticos. No se publican coordenadas reales.
- La app y el servidor no deben exponer claves `service_role` ni datos personales en fixtures o reportes.

# IndexedDB y almacenamiento

El esquema vigente de almacenamiento se gestiona en `src/lib/pwa/indexed-db.ts` y el acceso por cuenta en `src/lib/pwa/offline-storage.ts`. La captura y sus intenciones de sincronización se escriben mediante las transacciones de almacenamiento existentes. Fotos pendientes usan el store agregado por la versión W06; ubicación se adjunta a la operación de finalización sólo cuando corresponde. El adaptador de notificaciones mantiene la deduplicación en memoria del cliente/sesión; no es una suscripción persistente ni un almacén de eventos.

La suite W06 de capacidades comprueba que una inspección sintética se guarda mediante `LocalStorage` después de una respuesta GPS denegada. El harness IndexedDB es en memoria y sirve para comprobar el contrato y recuperación al cerrar/reabrir el adaptador; no demuestra persistencia frente a borrado manual, eviction del navegador, pérdida del perfil o agotamiento real del dispositivo.

# Límites conocidos

- Las suites de APIs de dispositivo corren en Node y usan puertos inyectados; no invocan hardware ni permisos reales del SO.
- La suite comprueba que el adaptador no consulta globals al importarse y que su uso es perezoso; no es una prueba completa de hidratación ni de montaje del Provider en un navegador.
- Los resultados de `getCurrentPosition` dependen del navegador, sistema operativo, usuario y disponibilidad de ubicación; precisión y plazo no están garantizados.
- El GPS capturado antes de finalizar vive temporalmente en estado de UI; una recarga del editor antes de finalizar puede perder esa captura opcional. No se promete GPS offline independiente del flujo de finalización.
- Una notificación local requiere que la app esté ejecutando código de sincronización. No hay garantía de aviso con la app cerrada ni de entrega futura.
- El permiso de notificaciones puede concederse en el navegador sin que la preferencia local de la app quede activada; la preferencia requiere la acción explícita en cada sesión.
- `createNotificationsClient` retiene IDs atendidos sólo durante la vida de esa instancia; el Provider crea el ámbito por sesión, así que no es deduplicación persistente entre reinicios de la aplicación.
- Los harness y APIs sintéticas no prueban políticas RLS remotas, Service Worker real en móvil, ni compatibilidad de cada navegador.

# Errores identificados

Los adaptadores convierten fallos conocidos en resultados controlados: geolocalización traduce códigos de permiso/timeout/unavailable; notificaciones distinguen permiso por defecto, denegado, API ausente, contexto inseguro y error de presentación; cámara devuelve fallback al selector. La suite focalizada comprueba esos mapeos y el callback de fallback.

No afirmo que esta revisión haya encontrado o corregido un defecto de producción en esos módulos. Una excepción del presentador de fallback se absorbe para que no interrumpa la sincronización; la vista in-app depende de la integración React. La disponibilidad de GPS/notificaciones y fallos físicos permanecen fuera de la prueba Node.

# Diferencia entre Notification API y Push Notifications

La Notification API permite solicitar permiso y mostrar una notificación desde código que se está ejecutando en el cliente o en un Service Worker. Esta implementación notifica localmente una sincronización que acaba de confirmarse mientras la app está activa; puede delegar la presentación en `showNotification` del registro activo.

Web Push requiere además suscripción Push (`PushManager`/`PushSubscription`), claves VAPID, un servicio emisor y lógica servidor que envíe mensajes a la suscripción. No encontré esos componentes en la implementación revisada. Por tanto, una notificación local no significa Push, entrega en segundo plano ni garantía de aviso cuando la PWA está cerrada.

# Decisiones técnicas

1. **Adaptadores inyectables:** pruebo las factories reales con puertos sintéticos en Node. Esto cubre las decisiones del adapter sin depender de hardware, aunque no demuestra integración de plataforma.
2. **Permiso bajo gesto voluntario:** la geolocalización se llama desde el botón y la petición de permiso Notification desde la acción de activar. El beneficio es consentimiento explícito; el riesgo es que los navegadores condicionan permisos a contexto seguro, gesto e instalación.
3. **Fallback funcional:** conservar selección manual y mensajes in-app evita acoplar el guardado a capacidades opcionales. La suite prueba el fallback tipado y persiste una captura usando el adaptador de almacenamiento real.
4. **Avisos sólo para confirmación completa:** el evento depende de ACK, cola vacía, ausencia de conflictos y sesión vigente. Evita notificar un éxito parcial; el costo es que un resultado mixto deliberadamente no genera aviso global.
5. **Identidad idempotente del aviso:** una instancia no presenta dos veces el mismo `event.id`, incluida la repetición concurrente. El beneficio es evitar duplicados; el límite es que el mapa no persiste entre instancias/sesiones.

# Trade-offs

- Coordenadas opcionales mejoran contexto de inspección, pero son datos sensibles y sujetos a denegación, imprecisión y retención; por eso se piden bajo acción y sólo se guardan al finalizar según el flujo vigente.
- Los adaptadores tipados hacen fallos recuperables y testables, a cambio de que la UI deba traducir códigos a mensajes accesibles y no tratar `unsupported` como éxito.
- Notifications API da confirmación local con permiso; no sustituye Push. La app debe conservar avisos in-app cuando el permiso no existe o se niega.
- Tests Node son deterministas y rápidos, pero el control de permisos y la interacción del sistema requieren pruebas manuales separadas por navegador/dispositivo.
- El almacenamiento local permite continuar flujos offline, pero no evita eviction, pérdida del perfil o fallos de cuota.

# Mapeo a pruebas automatizadas

| Archivo | Contrato cubierto | Límite de evidencia |
|---|---|---|
| `tests/capabilities.spec.ts` | Orquesta ambas suites W06; falla si falta un helper/export, no hay escenarios o una assertion falla | Runner de integración, no contiene por sí solo los escenarios de comportamiento |
| `tests/helpers/capabilities-geolocation-notifications.ts` | Imports SSR, GPS exitoso/denegado/timeout/unavailable/API ausente/inseguro, llamada voluntaria, guardado sin GPS, permisos/errores/fallback/reintento/deduplicación y evento de ACK | Puertos sintéticos; no consulta hardware ni servicio remoto |
| `tests/helpers/capabilities-camera.ts` | Contrato de cámara, errores/fallback, fotos, persistencia local y recuperación | Sin cámara óptica ni Storage remoto real |
| `tests/inspection-location.spec.ts` | Validación GPS, persistencia a finalización, cola/replay sintéticos, separación borrador/finalización y render de coordinador | IndexedDB/transportes controlados; no valida GPS físico ni RLS remota |
| `tests/photo-validation.spec.ts`, `tests/photo-local.spec.ts`, `tests/photo-remote.spec.ts` | Validación y persistencia/subida simulada de fotos | Los puertos remotos son dobles; revisar `docs/w06-photo-storage.md` para límites |
| `tests/w06-baseline.spec.mjs` | Runner y gate: ausencia/vacío/export inválido/cero escenarios/assertion fallida | Infraestructura del runner, no sustituye las suites de capacidades |

`package.json` integra `node tests/capabilities.spec.ts` en `npm test`. `npm run verify` coordina typecheck, pruebas, build, medición de renderizado y el gate público W06. Un resultado de la suite no equivale a aprobación del gate académico, revisión de secretos ni validación en hardware.

# Validación manual reproducible

En localhost seguro o entorno HTTPS, con dispositivo de prueba y datos sintéticos:

1. Abrir el formulario de una inspección sintética y comprobar que no aparece prompt de ubicación hasta pulsar **Obtener ubicación**. Probar permitir, denegar y timeout en DevTools/permisos del navegador.
2. Tras denegar GPS, elegir laboratorio manualmente, guardar el borrador y confirmar que el flujo de inspección sigue disponible. Borrar/cancelar la ubicación y comprobar que no se incorpora al borrador.
3. En la vista de sincronización, verificar que no se pide permiso Notification al cargar; pulsar **Activar avisos** para probar default/granted/denied. Confirmar el fallback accesible dentro de la app.
4. Con un ACK nuevo y cola sin pendientes ni conflictos, comprobar un aviso genérico; repetir el evento y verificar que no duplica. Probar una sincronización parcial y confirmar que no se presenta como completada.
5. Comprobar que sincronización normal y guardado funcionan con ambos permisos denegados. No registrar coordenadas personales en capturas, logs ni evidencia pública.
6. Probar cámara/selector con permiso permitido/denegado; verificar captura sintética y cancelación/limpieza en los dispositivos autorizados para esa responsabilidad.

La ejecución de estos pasos en navegador o hardware real debe anotarse con navegador/versión y datos sintéticos. Esta especificación no afirma que todos hayan sido ejecutados en esta revisión.
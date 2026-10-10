# Flujo de coordinación: revisión, archivo y eliminación lógica

Implementación del 9/10/2026 (America/Mexico_City) en `feat/w06-baseline-contracts`. Base auditada: `a0fa1b10ec1cc65c083a217bac0703a991fed629`. Los ZIP locales W03 eliminado y W06 sin versionar se preservan fuera de los commits. La instrucción directa del usuario autoriza commits atómicos; no autoriza push, PR, despliegue ni SQL remoto.

## Baseline y decisiones

| Capacidad | Existía | Brecha resuelta | Archivos principales |
| --- | --- | --- | --- |
| Lecturas autorizadas | Auth, perfiles activos, RLS, datos reales, dos rutas de detalle | Mismo panel de coordinación y fotos en ambos detalles | `src/app/inspections/[inspectionId]/page.tsx`, `src/app/inspecciones/[id]/page.tsx`, `InspectionDetailWorkspace.tsx` |
| Fotos y ubicación W06 | `finding_photos`, Storage privado, `FindingPhotos`, snapshot GPS | Conservarlas tras soft delete; mantener lectura de archivo | Migración nueva; reutilización de fotos/ubicación |
| Decisión de coordinación | No existía equivalente | `pending → approved/rejected`, nota, actor y fecha del servidor | `coordination.ts`, migración y RPC |
| Archivo e Histórico | Ausentes | Archivo independiente, listado, detalle y desarchivo | `/inspections/archive`, repositorios, navegación |
| Eliminación lógica | Técnico descartaba su borrador | Coordinación elimina archivo o rechazada activa con folio exacto | RPC, endpoint y modal Radix |
| Concurrencia/offline | Versiones, recibos, IndexedDB v3, cola | RPC atómica y acciones nuevas exclusivamente online; caché sincronizada ausente se oculta tras refresh completo | Servicio `coordinate-inspection.ts`, reconciliación y pruebas |

`draft/completed` es el flujo **técnico de inspección**. `pending/in_review/resolved` es el seguimiento **de hallazgos**, según ADR-002. La decisión de coordinación es un concepto adicional; no cambia ninguno de esos estados ni las observaciones del técnico. Una decisión final no se corrige; archivar/desarchivar tampoco la modifica.

Se conserva la visibilidad de coordinación limitada a finalizadas. Se corrige el caso de un técnico promovido a coordinador que aún podía leer sus viejos borradores por el predicado de propietario: ahora la rama de propiedad exige rol técnico activo. No se concede acceso a borradores para implementar la excepción. Se permite eliminación activa de **rechazadas**, porque su flujo técnico sigue siendo `completed` y su lectura ya está autorizada.

Dos incompatibilidades de esquema se resolvieron: `inspection_completion_consistent` prohibía `completed + deleted_at`; ahora conserva la consistencia entre finalización/fecha y permite el tombstone. El guard de fotos continúa exigiendo limpieza al descartar un borrador, pero permite soft delete de finalizadas conservando sus objetos. No se añade ningún borrado físico a la aplicación.

Archivo se permite al concluir **la decisión de coordinación**, incluso si hay hallazgos pendientes: son ciclos independientes. Mientras está archivada no se admite seguimiento; al desarchivar se recuperan las transiciones originales sin reabrir hallazgos resueltos. Una intención de seguimiento ya pendiente en la cola obtiene conflicto al encontrar el archivo; se conserva para resolución explícita. Aprobar/rechazar/archivar/desarchivar/eliminar no entran en esa cola.

## Modelo, seguridad y contratos

Una migración aditiva añade a `inspections`: `review_status` (default `pending`), `review_notes` (default vacío), `reviewed_at/by`, `archived_at/by`, `deleted_by`; reutiliza `deleted_at`. FKs conservan actores; constraints validan revisión finalizada, motivo de rechazo, longitud máxima de 2000 caracteres y archivo consistente. Los registros anteriores quedan activos y sin decisión, sin actualizar su versión o evidencia. Dos índices parciales soportan Activas y Archivo con el orden de fecha/UUID existente. No se crean tablas nuevas.

`POST /api/inspections/:id/coordination`, con sesión cookie, JSON, origen válido e `Idempotency-Key: UUID`:

```json
{ "action": "reject", "baseVersion": 2, "notes": "Motivo de coordinación" }
```

Acciones: `approve`, `reject`, `archive`, `unarchive`, `delete`. Aprobación admite nota opcional; rechazo exige motivo. Eliminación exige `confirmation: "INS-N"` exacto, usando el folio asignado por BD. No admite campos adicionales ni notas/confirmaciones en acciones incompatibles. Una clave por intención permanece en memoria para reintentar una respuesta perdida; no hay persistencia ni replay automático offline.

El handler verifica sesión y rol activo; la RPC `coordinate_inspection` repite autorización, elegibilidad, confirmación y validación para llamadas directas a Supabase. `SECURITY DEFINER` tiene `search_path = ''`, referencias calificadas y parámetros limitados. No usa service role. Los roles de aplicación conservan sólo SELECT sobre tablas, sin INSERT/UPDATE/DELETE. La RPC bloquea perfil y fila padre, compara `baseVersion`, aplica cambios y registra el recibo en la misma transacción. Las mutaciones antiguas de hallazgos ya bloquean el padre; un trigger impide cambios después de archivo/eliminación.

Un replay con la misma clave y contenido devuelve el recibo sin aumentar versión ni duplicar eventos. Clave reutilizada con otro contenido o versión obsoleta devuelve `409`. Repetir archivo/desarchivo con otra clave y **versión vigente**, estando ya en ese estado, no actualiza la fila; puede conservar un recibo de la nueva solicitud, pero no duplica el evento de archivo ni su fecha. Versión vieja sigue siendo conflicto. Después del soft delete sólo el actor original puede recuperar el ACK de esa intención exacta; una nueva mutación obtiene `404`.

Respuestas: `401` sin sesión/perfil activo (el guard existente trata perfil inactivo como sesión no disponible), `403` rol técnico u origen inválido, `404` UUID/registro no visible o borrador, `409` versión/estado/clave incompatible, `422` payload/motivo/folio inválido, `503` servicio no disponible. Los errores SQL inesperados no se exponen al cliente.

`GET /api/inspections` lista Activas; `?view=archive` requiere coordinación y lista sólo archivadas no eliminadas, conservando paginación. Los repositorios SSR y las métricas filtran archivo/eliminación antes del límite. El listado normal de hallazgos usa un join interno al padre y filtros de archivo/eliminación en PostgREST. Los detalles autorizados pueden leer hallazgos/fotos de archivo. RLS oculta inspección eliminada y sus hallazgos, fotos y objetos privados. Se mantiene revocado el SELECT de recibos existente para proteger GPS. Las URLs/bytes de fotos siguen pasando por los permisos previos. El visor de coordinación usa evidencia remota autorizada, sin fusionar metadatos/blob de caché técnica; una consulta fallida muestra error y no se presenta como ausencia de evidencia. El modo local/offline del técnico se conserva.

Tras un refresh **completo y exitoso**, el listado técnico omite snapshots sincronizados ausentes del servidor, evitando resucitar archivo/eliminación. Conserva borradores pendientes y tombstones; ante error/offline conserva el comportamiento previo. Un dispositivo desconectado puede conservar datos que leyó antes: no existe invalidación remota instantánea de IndexedDB. Las mutaciones siempre se reautorizan al reconectar.

## Permisos y transiciones

| Acción | Coordinador activo | Técnico activo | Anónimo / inactivo |
| --- | --- | --- | --- |
| Consultar detalle/fotos | Sólo `completed`, activa o archivada, no eliminada | Sólo propias no eliminadas, evidencia según política previa | Denegado |
| Aprobar / rechazar | Finalizada activa con decisión `pending`; rechazo con motivo | Denegado | Denegado |
| Archivar | Finalizada con decisión `approved/rejected`, no eliminada | Denegado | Denegado |
| Desarchivar | Archivada no eliminada; conserva decisión/flujo/hallazgos | Denegado | Denegado |
| Eliminar lógicamente | Archivada **o rechazada activa**, versión vigente y folio exacto | Este endpoint denegado; conserva su descarte de borradores previo | Denegado |
| Seguimiento de hallazgo | Sólo padre finalizado activo, `pending → in_review → resolved` | Conserva captura de hallazgos en su borrador | Denegado |

Decisión: `pending → approved` o `pending → rejected`, sin retorno. Archivo: `archived_at null ↔ timestamp`, después de decidir. Eliminación: `deleted_at null → timestamp`, sin operación de restauración en la app. Ninguna acción cambia `workflow_status` ni `finding.status`.

## Migración, aplicación y recuperación

Orden: todas las migraciones previas hasta `20261010000000_inspection_locations.sql`, después **`20261010010000_coordination_lifecycle.sql`**. La migración de fotos previa exige el bucket privado ya configurado según `docs/w06-photo-storage.md`.

**No se aplicó SQL en Supabase remoto.** En un entorno autorizado, respaldar primero, aplicar la nueva migración mediante el procedimiento habitual del proyecto (SQL Editor o herramienta de migraciones del entorno) y comprobar columnas/defaults, constraints, políticas y permisos de ejecución. Antes de publicar la aplicación, verificar en staging un ciclo con cuentas sintéticas y un registro finalizado antiguo con fotos. El código nuevo necesita estas columnas: desplegar BD antes que app.

Verificación local reproducible, requiere Docker, Python 3 y descarga local de `postgres:16-alpine`:

```bash
bash scripts/test-coordination-sql.sh
```

El runner crea un contenedor PostgreSQL sin publicar puertos, simula Auth/Storage con el bootstrap existente, aplica migraciones, crea filas anteriores a la nueva migración y la aplica dos veces. Comprueba defaults/versiones/evidencia anterior, ciclo/denegaciones/RLS y conservación física; ejecuta regresiones de fotos, GPS y ACK. Usa dos sesiones reales para probar concurrencia: una decisión commit, otra `VERSION_CONFLICT`, un solo recibo. El contenedor se elimina incluso ante fallo. No acredita Auth/Storage HTTP reales ni imágenes en un bucket remoto.

Rollback razonable: revertir primero la aplicación a la versión anterior y **mantener las columnas aditivas y los tombstones**; no eliminar datos de auditoría. Antes de volver a los helpers/políticas/guard anteriores, inspeccionar registros finalizados eliminados, decisiones y archivo. La constraint antigua es incompatible con los nuevos tombstones y no puede restaurarse ciegamente. Para una reversión completa se necesita una migración compensatoria revisada según los datos existentes y un respaldo; no se incluye un script destructivo de downgrade.

Una recuperación futura por administrador de BD autorizado requerirá auditoría de quién/cuándo/por qué, respaldo, transacción de mantenimiento y modificación controlada del guard que impide mutar un registro eliminado. Puede limpiar el tombstone y recuperar las evidencias conservadas sin reabrir el flujo técnico. No se implementó papelera, restauración administrativa ni acceso service role desde la aplicación.

## Verificación ejecutada

Runtime usado: Node **22.22.3**, conforme a `package.json` (el shell tenía Node 26). Resultados locales:

| Comando | Resultado |
| --- | --- |
| `npm ci` con Node 22.22.3 | PASS; npm reportó 10 vulnerabilidades del árbol existente; no se cambiaron dependencias |
| `npm run typecheck` | PASS |
| `node tests/inspection-coordination.spec.ts` | PASS: validación, elegibilidad, offline/pérdida de conexión, sesión, errores RPC, filtros/métricas y reconciliación |
| `node tests/inspection-api.spec.ts` | PASS: API HTTP real de Next contra backend sintético, incluyendo coordinación y SSR de Histórico |
| `bash scripts/test-coordination-sql.sh` | PASS: migración/upgrade/reaplicación, SQL/RLS, ciclo, regresiones y concurrencia real PostgreSQL |
| `make verify` | FAIL por entregables W06 previamente pendientes; ver abajo |
| Typecheck, build y medición HTTP ejecutados por `make verify` | PASS |
| `npm test` (en `make verify` y repetido sobre la implementación final) | Suites anteriores y nuevas PASS hasta `capabilities.spec.ts`; termina FAIL por suite auxiliar ausente |
| `npm run build` repetido sobre la implementación final | PASS, incluyendo lint/validación de tipos y generación de assets offline |
| Navegador local con Auth/PostgREST/RPC sintéticos | PASS: login coordinador, detalle, rechazo obligatorio, archivo/Histórico, confirmación exacta y soft delete con feedback; no acredita Supabase remoto |
| Gate `public-tests/check-w06.sh` ejecutado por `make verify` | FAIL: faltan `docs/capabilities.md`, `tests/helpers/capabilities-camera.ts`, `tests/helpers/capabilities-geolocation-notifications.ts` |

No hay script lint separado. `next build` ejecutó su validación de lint/tipos. Los avisos `MODULE_TYPELESS_PACKAGE_JSON` del runner Node son previos; no se cambió el tipo de módulo del proyecto. El reporte ignorado `reports/verification.json` conserva resultados reales del árbol de trabajo durante `make verify` (antes de los commits y del ajuste final de errores del visor, que se verificó con build/tests separados); no acredita un commit limpio ni CI remoto. No se añadieron stubs ni se omitieron suites para hacer verde el gate W06.

La inspección AST de los ocho archivos JSX modificados/nuevos encontró cero cadenas estáticas inline en valores de `className`. Los componentes modificados/nuevos mantienen un único `const s` plano al final y clases literales completas; se comprobó que su JSX no tiene cadenas Tailwind estáticas inline. No se modificó `src/components/ui`.

## Recorrido manual y pendientes

En un entorno de prueba con migración aplicada:

1. Iniciar sesión como coordinador activo → Inspecciones activas → abrir una finalizada. Comprobar folio, laboratorio, técnico, resumen original, hallazgos, estados, fotos autorizadas y ubicación si existe.
2. Aprobar con nota opcional; con otra inspección rechazar: el botón Confirmar exige motivo. Ver actor, fecha y nota; ya no se ofrece una segunda decisión. Comprobar que los hallazgos no cambiaron.
3. Archivar y confirmar → aparece Histórico/Archivo con feedback. Ya no figura en Activas, dashboard ni listado normal de hallazgos.
4. Abrir desde Histórico → Desarchivar → vuelve a Activas conservando decisión y seguimiento. Archivar de nuevo.
5. Abrir desde Histórico → Eliminar lógicamente. Sin texto o con folio diferente Confirmar permanece deshabilitado. Escribir folio exacto y confirmar; desaparece de vistas ordinarias y su detalle devuelve 404. Un administrador verifica que inspección, hallazgos, metadatos y objetos permanecen.
6. En una rechazada activa se ofrece eliminación con la misma confirmación. Un borrador técnico no aparece ni puede abrirse por coordinación.
7. Abrir un modal y cortar conexión: Confirmar se bloquea; reconectar permite reintento con la misma intención. Con dos coordinadores sobre la misma versión, la segunda acción muestra conflicto recuperable y exige recargar.
8. Como técnico, enviar manualmente un POST al endpoint nuevo: `403`. Sin sesión: `401`; coordinador inactivo: `401` por el guard existente. Un intento directo de RPC por técnico/inactivo se deniega en BD.

Pendientes: aplicar migración y probar el ciclo con Supabase Auth/PostgREST/Storage reales en staging autorizado; validación humana/accesibilidad/dispositivos; entregables W06 #71/#72; recuperación administrativa futura. No se presenta validación local con dobles como evidencia de servicios remotos.

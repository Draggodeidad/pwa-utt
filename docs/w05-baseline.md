# Semana 05: baseline de sincronización

## Base común y procedencia

- Rama de app completa al iniciar: `origin/main` y `origin/feat/phase-28-demo-handoff`, ambos en `e1a9dbf010c3561411189246a3a0ede590abd3ff` tras `git fetch origin main` el 3 de octubre de 2026. La rama de este baseline nace de ese SHA.
- Kit inspeccionado fuera del repositorio: `PWA-w05-kit-estudiante.zip`, SHA-256 `9fab4bf7f4fed3bf0113c392108a6ec1f5886a11ff98270b93cadbb3b4bbb5a7`. Se extrajo a `/tmp/pwa-w05-kit-estudiante-inspection` tras validar sus 13 entradas, tamaños y rutas. El ZIP local queda sin versionar.
- Contenido completo del ZIP: `ASSIGNMENT.md` (requisitos y rúbrica), `README.md` (instrucciones), `evaluation.json` (metadatos y comandos de evaluación), `evidence/individual.md` (plantilla), `tests/README.md` (contrato), `public-tests/README.md` y `public-tests/check.sh` (check mínimo), `.github/workflows/week-05-w05-sync-data.yml` (CI), y cinco entradas de directorio. No contiene código de sincronización, fixtures ni pruebas ejecutables.

## Comparación antes de integrar

| Ruta obligatoria del kit | Equivalente existente en la app completa | Decisión para W05 |
| --- | --- | --- |
| `src/lib/storage/schema.ts` | `src/lib/pwa/indexed-db.ts` define IndexedDB v2, stores, índices, apertura y transacciones; `src/lib/pwa/offline-storage.ts` aplica partición por cuenta. | Exponer el contrato existente desde la ruta obligatoria, sin crear otra base ni cambiar el esquema. La implementación corresponde al compañero. |
| `src/lib/sync/queue.ts` | `src/lib/pwa/sync/queue.ts` ofrece la cola por cuenta; `runner.ts` procesa y reintenta; `browser-runner.ts` coordina eventos de red. | Reutilizar estos módulos y enlazar la ruta del kit con un contrato real. No duplicar el motor. |
| `src/lib/sync/conflict-policy.ts` | `src/features/sync/services/conflict-detection.ts` detecta; `resolve-conflict.ts` conserva instantáneas y ofrece decisiones manuales. | Exponer y documentar la política real, sin crear una segunda resolución. |
| `docs/sync-policy.md` | Comportamiento en código, pruebas y `docs/requirements.md` RF-66 a RF-82. | Julian documenta política, límites y evidencia comprobada. |
| `tests/sync.spec.ts` | `tests/local-storage.spec.ts`, `local-capture.spec.ts`, `queue-transport.spec.ts`, `queue-recovery.spec.ts`, `conflict-resolution.spec.ts`, `session-isolation.spec.ts` y `sync-ui.spec.ts`. | Osbaldo agrega una suite integrada con fixtures sintéticos y la registra en `npm test`; debe fallar ante una regresión real. |

El servidor ya usa recibos `operation_receipts` y compara el hash de la petición completa antes de responder a un reenvío. La migración `supabase/migrations/20260930010000_operation_replay_ack.sql` añade la señal `replayed`; el cliente envía `idempotency-key` desde `src/lib/api/http-client.ts`. La cola congela petición y clave antes de HTTP; `acknowledge` guarda ACK y progreso en una transacción. `runQueue` usa lease por cuenta, dependencias, reintento con backoff y límite de cinco intentos. Los errores de versión o estado se guardan en `conflict_local`; la resolución requiere lectura remota autorizada y decisión `mine` o `server`, o copia de borrador si la inspección remota ya terminó.

## Contrato propuesto para Julian y Osbaldo

Este contrato es una propuesta de integración; la aceptación de Julian y Osbaldo aún no está registrada.

- Identidad: usar UUID sintéticos fijos distintos para cuenta A, cuenta B, `clientId`, inspección, hallazgo y operaciones. Un `operationId` representa exactamente una petición congelada, incluyendo `kind`, `entityId`, `baseVersion` y `payload`; un cambio de contenido exige otro `operationId`.
- Persistencia: la captura de entidad y su intención se escriben en la misma transacción IndexedDB. El fixture debe reabrir la base y encontrar ambos o ninguno; la cuenta B no puede leer ni enviar datos de A.
- Reenvío: simular ACK perdido tras aplicar una operación. Al recuperar conexión, mismo ID, cabecera y cuerpo; un único efecto remoto, ACK `replayed: true`, cola vacía y versión local actualizada. No depender de Supabase privado para la suite pública.
- Orden y reintentos: inspección antes de hallazgo antes de finalizar; dependientes permanecen bloqueados cuando falla el padre. Un 429 con `Retry-After` se difiere; después de cinco fallos transitorios queda intervención manual. Un 401 pausa la cola. Usar reloj inyectado y transporte falso, sin esperas reales.
- Conflicto: simular versión remota más nueva con snapshot autorizado. Verificar que `mine` crea una operación nueva con `baseVersion` remota y conserva la captura previa; `server` adopta el estado remoto y encadena dependientes; si el remoto está finalizado, `mine` genera una copia editable. Nunca adoptar el cuerpo de error como evidencia remota.
- Reutilizar `tests/helpers/indexed-db-harness.ts` y patrones de fixtures de las suites existentes. Julian puede enlazar cada decisión de `docs/sync-policy.md` a un caso concreto de `tests/sync.spec.ts`; Osbaldo puede usar los mismos nombres de escenarios para comprobar el comportamiento.

## Checks e integración del kit

El `public-tests/check.sh` del ZIP imprime `PUBLIC_OK` aun con las cinco rutas ausentes: `set -e` no aborta su cadena `test ... && ...`. Su búsqueda literal de `api_key|secret|password|token` en todo el repo también marca código legítimo y documentación. `evaluation.json` y el workflow originales verifican principalmente existencia; el workflow no fija Node 22 ni ejecuta `make verify`. La ruta `public-tests/check.sh` existente pertenece a entregas anteriores y se conserva.

Se añadió `public-tests/check-w05.sh`: exige que cada entregable W05 tenga contenido y que la suite figure en `package.json`. El workflow W05 tiene un job `baseline` con Node 22, instalación limpia y `make verify`, y un job `w05-contract` que falla hasta que los compañeros integren los cinco entregables. Que `baseline` pase no implica que W05 esté terminado. Los checks públicos de W05 verifican presencia e integración de la suite; las pruebas funcionales y la revisión de secretos siguen siendo necesarias. No se importaron plantillas vacías, `evaluation.json` ni el README del ZIP que sobrescribiría el del proyecto.

## Comandos y estado

Desde el SHA de base: `npm ci --ignore-scripts --no-audit --no-fund`, `make verify`, `bash public-tests/check.sh` y `bash public-tests/check-w05.sh`. El último debe devolver `W05_MISSING_OR_EMPTY` mientras falten rutas obligatorias. El reporte local de `make verify` está en `reports/verification.json`; en GitHub Actions se adjunta al job `baseline` del SHA ejecutado. Los resultados observados y sus límites se registran en `evidence/individual.md` tras ejecutar los comandos.

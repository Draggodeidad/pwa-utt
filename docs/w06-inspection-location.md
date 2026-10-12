# Ampliación de #70: GPS de la inspección finalizada

Por petición explícita del usuario, #70 amplía su alcance inicial de ubicación temporal. La captura sigue siendo voluntaria y puntual; al confirmar la finalización se guarda una única instantánea para el coordinador. No se añade seguimiento, historial ni geocodificación inversa.

## Contrato y persistencia

`inspection.finalize.payload.location` admite `null` o `{ latitude, longitude, accuracy, capturedAt }`. Las coordenadas son números finitos dentro de [-90,90] y [-180,180], la precisión es un número finito no negativo en metros y `capturedAt` es un timestamp ISO UTC. Omitir el campo sigue siendo válido para clientes y colas anteriores y equivale a ausencia de captura.

La tabla `inspection_locations` usa `inspection_id` como PK/FK: una fila por inspección finalizada. Los cuatro campos quedan nulos cuando no hubo captura o se borró. Las inspecciones anteriores sin fila también se presentan como sin ubicación. La RPC guarda la fila en la misma transacción que completa la inspección, después de validar dueño, versión, hallazgos y fotos. Los recibos mantienen la identidad de la petición completa para rechazar reutilización de claves con otro GPS; el resultado de la RPC y el ACK HTTP no incluyen ubicación.

La tabla separada permite RLS propia: sólo coordinadores activos leen snapshots de inspecciones finalizadas visibles. No existe rol admin en el contrato actual. Técnicos, otras cuentas y anónimos no leen GPS. Ningún rol de aplicación escribe directamente. `request_payload` y `request_hash` de los recibos dejan de ser columnas consultables por `authenticated`, porque el payload puede contener GPS; los metadatos y el resultado conservan permiso de lectura con RLS. Consultar `operation_receipts` con `select=*` requerirá seleccionar explícitamente las columnas autorizadas.

`GET /api/inspections/:id` sólo incluye `capturedLocation` para coordinadores; el técnico no recibe ese campo, ni siquiera en su inspección. Listados, DTO del editor, entidades locales y respuestas de mutación no incorporan GPS. El repositorio recibe el rol de la sesión autenticada y la base vuelve a comprobarlo mediante RLS.

## Captura y privacidad

El editor avisa que la ubicación se compartirá al finalizar. Obtener/actualizar requiere pulsar un botón; borrar invalida también respuestas tardías. Salir del editor o cambiar de sesión descarta la captura sin finalizar. Guardar un borrador no persiste GPS.

Al confirmar la finalización, la cola offline guarda una copia de la captura actual con su timestamp original; queda aislada por cuenta y sobrevive una recarga mientras espera sincronización. Los reintentos conservan payload e Idempotency-Key. Finalizar desde el detalle, donde no hay captura, envía `null`. La ubicación no bloquea finalizar por estar ausente. La sesión se comprueba antes de encolar la captura del editor.

Ambas rutas de detalle (`/inspections/:id` y `/inspecciones/:id`) muestran al coordinador coordenadas, precisión, fecha y enlace a Google Maps. El mapa sólo se abre al pulsar el enlace; no hay mapa embebido. Sin captura se muestra: «No se registró ubicación GPS al finalizar esta inspección».

## Aplicar la migración

Después de las migraciones existentes, ejecutar completa `supabase/migrations/20261010000000_inspection_locations.sql` como administrador en SQL Editor del proyecto autorizado. Es una migración incremental de una sola aplicación. Desplegar la app con el contrato nuevo después de aplicarla. No modifica el bucket de fotos. Esta implementación sólo la aplicó en PostgreSQL local desechable, sin migrar ni desplegar el proyecto remoto.

## Validación reproducible

Con Node 22: `npm run typecheck`, `npm test` y `npm run build`. Las pruebas nuevas están registradas en `npm test`:

- `tests/inspection-api.spec.ts`: petición HTTP real a Next con backend Auth/PostgREST simulado; finalización con/sin GPS, ACK/replay sin GPS, coordinador con captura y estado vacío en ambas páginas, técnico propio sin GPS y técnico ajeno rechazado.
- `tests/inspection-location.spec.ts`: validación, persistencia y transporte de la captura en IndexedDB simulado, recarga y reintento con el mismo payload; render del componente real con coordenadas, enlace, timestamp, precisión, estado vacío y omisión en técnico/borrador.
- `supabase/tests/inspection-locations.sql`: RPC, transacciones, restricciones y RLS reales en PostgreSQL; sin permisos de hardware ni servicio Supabase remoto. Usa datos sintéticos y rollback.

Para SQL local exclusivamente, usar el bootstrap de fotos ya existente:

```bash
docker run --rm -d --name pwa-gps-tests -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
docker exec pwa-gps-tests pg_isready -U postgres
docker exec -i pwa-gps-tests psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/photo-local-bootstrap.sql
for migration in supabase/migrations/*.sql; do
  docker exec -i pwa-gps-tests psql -U postgres -v ON_ERROR_STOP=1 < "$migration" || exit 1
done
docker exec -i pwa-gps-tests psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/inspection-locations.sql
docker stop pwa-gps-tests
```

No ejecutar el bootstrap local en Supabase Dashboard. El gate W06 conserva los faltantes independientes de #71/#72; las nuevas pruebas no los sustituyen. La comprobación física de GPS y la revisión humana siguen pendientes.

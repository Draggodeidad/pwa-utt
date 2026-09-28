# Decisión de renderizado — Semana 04

## Contrato y decisión

El baseline `w04-csr-ssr` pide comparar una ruta con interacción cliente y otra con datos renderizados en servidor, usando únicamente datos sintéticos y estados comprobables. El listado `/inspecciones` usa CSR para búsqueda y filtro sin recargar. El detalle `/inspecciones/[id]` usa SSR por solicitud (`dynamic = "force-dynamic"`) para entregar laboratorio, fecha, responsable y hallazgos en el HTML inicial. La salida de `npm run build` marca ambas rutas como dinámicas; en el listado la respuesta inicial contiene el estado de carga y en el detalle contiene los datos de la inspección.

La fuente es `src/features/inspections/data/inspections.ts` y su detalle sintético. El listado inicia con el mismo estado de carga en servidor y navegador, y pasa a los registros tras resolver una promesa local en `useEffect`; así no depende de red ni crea un hydration mismatch. La búsqueda y el filtro usan el selector puro `filterInspections`. El detalle resuelve un ID opaco desde la colección y presenta los hallazgos del registro. `inspection-004` se alineó entre ambas vistas: ubicación, fecha y dos hallazgos.

## Estados y accesibilidad

`LoadingState` ofrece carga (`role=status`, `aria-busy`), error (`role=alert`) y ausencia de datos. El listado tiene carga real de cliente y estados de demostración reproducibles con `?estado=error` y `?estado=vacio`; el botón de error vuelve a cargar los datos sintéticos. El detalle tiene fronteras de ruta para carga y fallos inesperados, además de `?estado=error` para inspeccionar su mensaje y enlace de recuperación. Los IDs desconocidos se detectan antes del streaming mediante middleware y se reescriben al estado global de ausencia con HTTP 404. La página también usa `notFound()` si la colección cambia entre esa comprobación y la resolución.

Las vistas usan encabezados jerárquicos, listas y términos descriptivos, etiquetas visibles o accesibles para controles, estados textuales además del color, enlaces operables por teclado y foco visible. `tests/rendering.spec.ts` comprueba la semántica de los estados, el HTML SSR, la respuesta 404, los estados de demostración y el selector que alimenta los filtros. Esto no equivale a una auditoría WCAG ni a una prueba automatizada de hidratación en navegador.

## Medición repetible

Ejecutar `npm ci --ignore-scripts --no-audit --no-fund`, `npm run build` y `npm run measure:rendering` (o `make verify`). El script inicia `next start` en un puerto local, calienta cada ruta una vez y realiza cinco solicitudes HTTP secuenciales con `cache: no-store`. Registra la mediana del tiempo hasta encabezados, tiempo hasta cuerpo completo y bytes HTML en `reports/rendering-metrics.json`; el workflow publica ese archivo y `reports/verification.json` para el SHA evaluado. No se usa un umbral temporal frágil como gate.

Medición local del 27 de septiembre de 2026 con Node 26.2.0, en este equipo:

| Ruta | Mediana hasta encabezados | Mediana hasta cuerpo | HTML |
| --- | ---: | ---: | ---: |
| Listado CSR, HTML inicial | 14.44 ms | 17.01 ms | 20,119 bytes |
| Detalle SSR | 26.33 ms | 30.51 ms | 32,961 bytes |

Estas cifras describen esta ejecución y contenido distinto en cada pantalla; no aíslan el costo del modo de renderizado. En especial, el HTML inicial del listado solo muestra la carga: el reporte no mide descarga de JavaScript, hidratación, interacción ni tiempo hasta que aparecen los registros. El build informa aproximadamente 143 kB de First Load JS para el listado y 138 kB para el detalle; también es específico de esta revisión.

## Costos y límites

CSR mantiene la búsqueda y los filtros fluidos, a cambio de enviar el conjunto sintético al navegador y requerir JavaScript para mostrar registros. SSR entrega el detalle legible en el HTML y evita lógica de filtro en cliente, a cambio de procesar cada solicitud en servidor y mantener la resolución de ID y el middleware de 404. Los datos son fijos y de ejemplo: no hay API, almacenamiento, autenticación real ni sincronización de inspecciones. Los parámetros `estado` son escenarios de demostración, no sustitutos de un servicio de datos que pueda fallar.

El check público literal del ZIP busca términos como `password` en todo el árbol y falla con el formulario de login y documentación legítimos del repositorio. `public-tests/check.sh` conserva las comprobaciones acumulativas de estructura y añade los artefactos W04; no afirma detectar secretos. La revisión de credenciales y datos reales requiere inspección específica del contenido versionado.

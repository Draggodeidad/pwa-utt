# Objetivo

Como integrante responsable de la documentación y de explicar las decisiones de arquitectura, describo el uso de renderizado cliente y servidor en las vistas de inspecciones de Semana 04. La intención es dejar trazables el comportamiento comprobable, sus beneficios, sus costos y las limitaciones de las pruebas, sin atribuir al sistema una API ni persistencia que no existen.

# Contexto

La aplicación Next.js presenta información exclusivamente sintética. La comparación W04 cubre el listado `/inspecciones` y el detalle `/inspecciones/[id]`. El listado es un Client Component (`"use client"`): gestiona estado, carga los datos desde la colección local mediante `useEffect` y ejecuta búsqueda y filtros en el navegador. El HTML inicial sí contiene el estado de carga prerenderizado por Next.js; por eso CSR describe dónde ocurre la transición interactiva a los registros, no la ausencia total de HTML generado en servidor.

El detalle declara `dynamic = "force-dynamic"`, resuelve el identificador en el servidor y entrega la información de la inspección en el HTML de la respuesta. El middleware detecta identificadores desconocidos antes de que una frontera de carga pueda iniciar streaming con un estado HTTP incorrecto; la página conserva además `notFound()` como defensa si la colección cambia entre comprobación y renderizado.

# Alternativas Evaluadas

## CSR

La interfaz del listado ejecuta búsqueda y filtro sin navegación de página completa. `useInspectionFilters` opera sobre los registros sintéticos después de que el efecto cliente los coloca en estado. El estado inicial de carga se comparte entre la representación inicial y la hidratación.

Ventaja: interacción inmediata sobre la colección ya cargada y separación entre la presentación inicial y las acciones de filtrado. Costo: se requiere JavaScript para sustituir el estado inicial por los resultados y para operar los controles; el usuario puede percibir la carga antes de ver las inspecciones.

## SSR

El detalle es dinámico por solicitud y resuelve en servidor la inspección asociada al ID. La respuesta HTML incluye los datos del registro antes de la interacción cliente.

Ventaja: contenido significativo disponible en el HTML inicial y resolución del ID en servidor. Costo: cada solicitud debe ejecutar la lógica de resolución; el 404 de IDs desconocidos necesita coordinación entre middleware, `notFound()` y el límite de streaming.

# Comparación Técnica

| Criterio | Listado `/inspecciones` | Detalle `/inspecciones/[id]` |
|---|---|---|
| Modo de interacción | Estado y filtros gestionados en cliente | Resolución del registro en servidor por solicitud |
| Evidencia en código | `"use client"`, `useState`, `useEffect` y hook de filtros | `dynamic = "force-dynamic"` y `findInspectionDetail(params.id)` |
| HTML inicial comprobado | Contiene el shell y `Cargando inspecciones`; no contiene el resultado ya cargado | Contiene ubicación y datos sintéticos del detalle |
| Estado de carga | Carga del listado; `?estado=cargando` permite mantenerla para inspección manual | `loading.tsx` de la ruta presenta `Cargando detalle` |
| Error observable | `?estado=error`, con botón que vuelve a resolver la colección local | `?estado=error`, con enlace de regreso; también existe `error.tsx` para fallos inesperados |
| Ausencia de datos | `?estado=vacio` y estado vacío si la colección no devuelve registros; filtros sin coincidencias muestran estado vacío | ID desconocido responde 404; un detalle válido sin hallazgos muestra un mensaje vacío para esa sección |

# Decisión Adoptada

Mantengo la división implementada: listado con datos y controles interactivos en cliente, y detalle renderizado dinámicamente en servidor. No interpreto esto como una elección absoluta de CSR puro frente a SSR puro: Next.js genera HTML inicial del listado para su estado de carga, mientras que los registros y la interacción del listado se resuelven en el cliente.

# Justificación

- En el listado, búsqueda y filtros son interacciones repetidas sobre un conjunto sintético pequeño. Gestionarlos en cliente evita solicitar una navegación completa por cada cambio. Se comprueba ejecutando `filterInspections` en la suite y utilizando los controles de la ruta.
- En el detalle, el usuario se beneficia de recibir los datos principales en el HTML inicial. La directiva `force-dynamic` evita tratar la respuesta como una captura estática de build. Se comprueba mediante una solicitud HTTP a un ID válido y verificando que el HTML contiene sus datos.
- Los estados de carga, error y vacío son explícitos y accesibles mediante `LoadingState` (`role="status"`/`aria-busy` para carga, `role="alert"` para error y `role="status"` para vacío). El beneficio es comunicar estados sin depender solo del color; el riesgo es que las variantes de demostración no representan fallos reales de una API. La suite verifica atributos y contenido HTML.
- Un middleware anticipa el 404 de identificadores desconocidos para conservar el código HTTP antes del streaming. Esto beneficia a clientes HTTP y evita confundir una vista de ausencia con éxito; aumenta la complejidad y debe permanecer alineado con la colección sintética. Se comprueba con la solicitud a un ID inexistente.

# Trade-offs

- CSR mantiene búsqueda y filtros ágiles, pero desplaza al cliente la transición a resultados y depende de JavaScript para esa experiencia.
- SSR entrega datos del detalle en el HTML y simplifica la lectura inicial, pero incurre en resolución por solicitud y necesita una ruta de 404 coordinada con middleware.
- La carga asíncrona usa `Promise.resolve(inspections)` sobre un adaptador en memoria; no simula latencia de red ni disponibilidad de un backend.
- La prueba HTTP valida respuesta y markup, pero no mide hidratación, interacción física del navegador ni experiencia con JavaScript deshabilitado.
- Las métricas de solicitudes son específicas de una ejecución y de contenidos distintos. No permiten concluir que un modo de renderizado sea universalmente más rápido.

# Supuestos

- Los registros y hallazgos de estas vistas son sintéticos y se resuelven desde las colecciones locales del proyecto.
- El objetivo de comparación es el contrato W04: interacción cliente para listado y HTML con datos para detalle.
- Los parámetros `?estado=error`, `?estado=vacio` y `?estado=cargando` son controles de demostración, no simulaciones de una API real.
- La estructura observada corresponde a los archivos del workspace en esta revisión. Cambios en Next.js, el middleware o la colección pueden alterar el contrato y requieren volver a verificarlo.

# Límites conocidos

- No existe en estas rutas una API remota ni una carga de datos desde backend; el modo de error del listado es un escenario manual que fuerza el estado.
- Los parámetros de estado no prueban timeouts, respuestas HTTP fallidas, reintentos de red ni condiciones de concurrencia.
- La suite no ejecuta Playwright ni valida la hidratación en un navegador real. Comprueba HTTP, markup renderizado y funciones puras con Node.js.
- La medición de rendering toma tiempos HTTP y tamaño HTML. No mide descarga de JavaScript, hidratación, interacción ni tiempo hasta que aparecen los registros CSR.
- La ruta detalle fuerza render dinámico, pero sus datos actuales siguen siendo locales y sintéticos; esto no prueba escalabilidad ni comportamiento de una base de datos.
- La suite de rendering está disponible en `tests/rendering.spec.ts`, pero el script `npm test` del `package.json` observado no la incluye. Debe ejecutarse explícitamente con `node tests/rendering.spec.ts` hasta que el equipo decida integrarla.

# Fallos encontrados

En el desarrollo W04 se observó que `notFound()` dentro de una ruta cuyo límite de carga permitía streaming podía producir una respuesta HTTP 200 con contenido de ausencia. La mitigación implementada comprueba los IDs conocidos en `src/middleware.ts` y reescribe los desconocidos con estado 404 antes de iniciar el render de la ruta; la página vuelve a validar el resultado con `notFound()` como defensa adicional. La prueba HTTP de `tests/rendering.spec.ts` comprueba el 404 y el HTML esperado.

En esta revisión documental también comprobé que `npm test` no invoca `tests/rendering.spec.ts`, aunque `npm run verify` sí ejecuta el script `npm test` y `npm run measure:rendering`. La existencia de la suite no equivale a que forme parte de esa cadena automatizada. Por ello incluyo la ejecución explícita como instrucción de validación y no afirmo que `npm test` cubra el rendering.

# Riesgos futuros

- Al reemplazar las colecciones sintéticas por un servicio real, la promesa local del listado deberá sustituirse por estados que representen latencia, error y ausencia de respuesta reales.
- La verificación de SSR deberá conservar el HTML inicial útil y los códigos HTTP correctos si la resolución del detalle pasa a depender de una API.
- La colección consultada por middleware debe mantenerse consistente con el origen que usa la página; con un backend, la estrategia actual no será suficiente sin redefinir cómo se valida un ID.
- La carga de todo el conjunto de inspecciones al cliente puede dejar de ser adecuada si el volumen crece; filtros, paginación o consultas de servidor requerirán medición y decisión nuevas.
- Las métricas HTTP actuales no deben emplearse como indicador de Core Web Vitals ni del tiempo percibido hasta que CSR muestre los resultados.

# Estrategia de validación

1. Ejecutar `npm ci --ignore-scripts --no-audit --no-fund` en un checkout limpio.
2. Ejecutar `npm run typecheck`, `npm test` y `npm run build`. `npm run verify` los coordina junto con `npm run measure:rendering`; genera `reports/verification.json` y `reports/rendering-metrics.json`.
3. Ejecutar explícitamente `node tests/rendering.spec.ts`, dado que no está listado dentro del script `npm test` observado. La suite levanta Next.js en desarrollo y valida markup HTTP, filtros, coherencia de los registros, estados y 404.
4. Comprobar `/inspecciones`: el HTML inicial incluye `Cargando inspecciones`; en navegador, esperar los registros, buscar un laboratorio/responsable, filtrar por resultado y observar vacío/error de demostración con `?estado=vacio` y `?estado=error`.
5. Comprobar un ID válido (por ejemplo, `/inspecciones/inspection-001`) y un ID inexistente; verificar datos en HTML y respuesta 404, respectivamente. El detalle acepta `?estado=error` para comprobar su mensaje y enlace.
6. Ejecutar `npm run measure:rendering` después de una build de producción. El script hace una solicitud de calentamiento y cinco mediciones HTTP secuenciales por ruta; registra medianas de primer byte, respuesta completa y bytes HTML. Las cifras se deben reportar con fecha, versión de Node.js y SHA, sin extrapolarlas a otro hardware.

La medición consignada en la versión anterior de este documento (27 de septiembre de 2026, Node 26.2.0) fue: listado HTML inicial, medianas de 14.44 ms hasta encabezados y 17.01 ms hasta cuerpo completo, 20,119 bytes; detalle, 26.33 ms y 30.51 ms, 32,961 bytes. Son observaciones de esa ejecución, no umbrales ni una comparación causal del costo de CSR y SSR.

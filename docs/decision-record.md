# ADR-001 — Decisión sobre la estrategia de aplicación

Documento del equipo **9B-E02**. Actividad 1, Semana 1.

## Estado

Aceptada por el equipo — 2026-09-04.

## Contexto y restricciones

La aplicación dará servicio a inspecciones de mantenimiento en laboratorios universitarios donde la conectividad es intermitente (zonas con señal débil, desplazamientos entre edificios). Los escenarios que influyen en esta decisión son **E-01** (consulta con conexión estable) y **E-02** (registro con conectividad intermitente) de `docs/requirements.md`; los requisitos que condicionan la elección son RF-06/RF-07/RF-08 (registrar, conservar sin conexión y sincronizar) y RNF-05 (operación offline futura).

Restricciones concretas:

- Uso principal desde dispositivos móviles del personal técnico, sin presupuesto para cuentas de desarrollador de tiendas de aplicaciones.
- Los datos de esta etapa son sintéticos; no hay backend institucional garantizado todavía.
- El despliegue y la verificación deben ser reproducibles (clonar, instalar, probar) en cualquier máquina con Node.js y en GitHub Actions.
- El curso usa Next.js y una trayectoria PWA de 14 semanas: la estrategia debe poder crecer de forma incremental.
- La instalación desde el navegador y el trabajo sin red son requisitos hacia el final del curso.

## Alternativas consideradas

| Criterio | PWA | Web tradicional | App nativa | Multiplataforma (p. ej. Flutter/React Native) |
| --- | --- | --- | --- | --- |
| Instalación en el dispositivo | Sí, desde el navegador | No | Sí, vía tienda de aplicaciones | Sí, vía tienda de aplicaciones |
| Conexión intermitente / offline | Sí, con service worker y almacenamiento local (a diseñar) | No; sin conexión la página no carga | Sí | Sí |
| Distribución | Enlace, sin tienda ni revisión | Enlace | Tienda (costo, revisión, tiempos) | Tienda (costo, revisión, tiempos) |
| Costo de desarrollo | Bajo: una base web única | Muy bajo | Alto: por plataforma | Medio: otra base de código y herramientas |
| Mantenimiento | Un solo código | Un solo código | Varios códigos | Un código, ecosistema aparte del web |
| Capacidades del dispositivo | Suficientes para este caso (cámara, notificaciones básicas) | Limitadas | Completas | Completas |
| Riesgo principal | Soporte variable entre navegadores (límites en iOS) | Sin offline ni instalación: no cubre E-02 | Costo y tiempos fuera del alcance del curso | Curva de aprendizaje y doble ecosistema |

Condiciones y límites: la operación offline no aparece por usar Next.js o React; exige diseñar almacenamiento local, service worker y sincronización, y esos diseños se documentarán cuando corresponda (RF-06 a RF-08, RNF-05). La columna "offline" de la tabla refleja la capacidad alcanzable, no algo ya implementado.

## Decisión

Se mantiene la estrategia **PWA sobre Next.js** fijada para el curso (la base del starter). Satisface las restricciones mejor que las demás opciones: ofrece instalación y camino hacia el offline sin pasar por tiendas de aplicaciones, mantiene un solo código web verificable en GitHub Actions y permite agregar capacidades de forma incremental durante las 14 semanas. Frente a la web tradicional, la PWA es la única opción web que puede cubrir E-02 (conservar y sincronizar con conexión intermitente); frente a nativa y multiplataforma, evita cuentas de tienda, un segundo código y la doble curva de aprendizaje, que no caben en el alcance del curso.

Cuándo otra opción sería preferible:

- App nativa: si apareciera un requisito de hardware especializado (p. ej. NFC para leer etiquetas de equipos) o de publicación obligatoria en tiendas, el costo adicional se justificaría.
- Multiplataforma: si el equipo ya dominara ese stack y el curso no exigiera la trayectoria web/PWA.
- Web tradicional: solo si se descartara por completo el uso móvil en campo y el trabajo sin conexión.

Lo que esta decisión **no resuelve todavía** (por diseño, en Semana 1): manifest, service worker, almacenamiento local, sincronización, notificaciones y autenticación. Tampoco resuelve el acceso a hardware especializado, que no es necesario para inspecciones de laboratorio.

## Consecuencias y riesgos

Consecuencias positivas:

- Una sola base de código instalable desde el navegador, sin cuotas de tienda.
- La verificación reproducible (`npm ci`, `npm run verify`) funciona igual en local y en CI.
- El aprendizaje se concentra en capacidades web estándares que se reutilizan en otros proyectos.

Costos:

- Dependencia del soporte de capacidades PWA en el navegador del usuario (iOS impone límites a la instalación y al trabajo sin red).
- Conservar datos en el dispositivo permite continuidad sin conexión, pero exige diseñar y probar la resolución de conflictos al reconectar.

Riesgos técnicos y mitigaciones:

- Riesgo: comportamiento distinto entre navegadores. Mitigación: probar la instalación y el offline en al menos dos navegadores cuando se implementen esas capacidades (semanas posteriores).
- Riesgo: que el service worker sirva contenido viejo. Mitigación: estrategia de versionado de caché con limpieza al actualizar, y pruebas de actualización.
- Riesgo: complejidad de sincronización con conectividad intermitente. Mitigación: cola de registros pendientes con identificación única y resolución de conflictos por fecha, documentada antes de implementarse (RF-08).

## Validación

La decisión se revisará con evidencia concreta en semanas posteriores:

- Semana 1 (esta): el starter compila y sirve las 3 inspecciones sintéticas; `npm run verify` pasa en local y en GitHub Actions (reporte `reports/verification.json` con `status: "pass"`).
- Cuando exista manifest y service worker: prueba manual de instalación desde el navegador y de carga de la página con la red desactivada (RNF-05).
- Cuando exista sincronización: prueba de registrar una inspección sin red (E-02) y verla sincronizada sin duplicados al recuperar la conexión.
- Si alguna de estas validaciones falla de forma no resoluble en el alcance del curso, la decisión vuelve a estado "Propuesta" y se reevalúa frente a las alternativas de la tabla.

No se afirma haber validado sincronización, permisos u offline: esas capacidades aún no están implementadas.

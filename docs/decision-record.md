# ADR-001 — Estrategia de aplicación

## Estado

Aceptada — 2026-09-03.

## Contexto y restricciones

La aplicación dará servicio a inspecciones de mantenimiento en laboratorios universitarios, donde la conectividad es intermitente (zonas con señal débil, desplazamientos entre edificios). El equipo de desarrollo es un estudiante en una materia de 14 semanas, por lo que el costo de desarrollo y aprendizaje importa tanto como el resultado. Restricciones concretas:

- Uso principal desde dispositivos móviles del personal técnico, sin presupuesto para cuentas de desarrollador de tiendas de aplicaciones.
- Los datos de esta etapa son sintéticos; no hay backend institucional garantizado todavía.
- El despliegue y la verificación deben ser reproducibles (clonar, instalar, probar) en cualquier máquina con Node.js y en GitHub Actions.
- La instalación desde el navegador y el trabajo sin red son requisitos hacia el final del curso.

## Alternativas consideradas

| Criterio | PWA | Web tradicional | App nativa | Multiplataforma (p. ej. Flutter/React Native) |
| --- | --- | --- | --- | --- |
| Instalación en el dispositivo | Sí, desde el navegador | No | Sí, vía tienda de aplicaciones | Sí, vía tienda de aplicaciones |
| Funcionamiento offline | Sí, con service worker | No | Sí | Sí |
| Distribución | Enlace, sin tienda ni revisión | Enlace | Tienda (costo, revisión, tiempos) | Tienda (costo, revisión, tiempos) |
| Costo de desarrollo | Bajo: una base web única | Muy bajo | Alto: por plataforma | Medio: otra base de código y herramientas |
| Mantenimiento | Un solo código | Un solo código | Varios códigos | Un código, ecosistema aparte del web |
| Capacidades del dispositivo | Suficientes para este caso (cámara, notificaciones básicas) | Limitadas | Completas | Completas |
| Riesgo principal | Soporte variable entre navegadores | Sin offline ni instalación | Costo y tiempos fuera de alcance del curso | Curva de aprendizaje y doble ecosistema |

## Decisión

Se elige **PWA sobre Next.js** (la base del starter). Satisface las restricciones mejor que las demás opciones: ofrece instalación y camino hacia el offline sin pasar por tiendas de aplicaciones, mantiene un solo código web verificable en GitHub Actions y aprovecha las 14 semanas del curso para agregar capacidades progresivamente.

Lo que esta decisión **no resuelve todavía** (por diseño, en Semana 1): manifest, service worker, almacenamiento local, sincronización, notificaciones y autenticación. Tampoco resuelve el acceso a hardware especializado (p. ej. NFC), que no es necesario para inspecciones de laboratorio.

## Consecuencias y riesgos

Consecuencias positivas:

- Una sola base de código instalable desde el navegador, sin cuotas de tienda.
- La verificación reproducible (`npm ci`, `npm test`, `npm run build`) funciona igual en local y en CI.
- El aprendizaje se concentra en capacidades web estándares que se reutilizan en otros proyectos.

Costos:

- Dependencia del soporte de capacidades PWA en el navegador del usuario (iOS impone límites a la instalación y al trabajo sin red).
- Habrá que diseñar explícitamente la estrategia de sincronización cuando haya backend.

Riesgos técnicos y mitigaciones:

- Riesgo: comportamiento distinto entre navegadores. Mitigación: probar la instalación y el offline en al menos dos navegadores cuando se implementen esas capacidades (semanas posteriores).
- Riesgo: que el service worker sirva contenido viejo. Mitigación: estrategia de versionado de caché con limpieza al actualizar, y pruebas de actualización.
- Riesgo: complejidad de sincronización con conectividad intermitente. Mitigación: cola de registros pendientes con identificación única y resolución de conflictos por fecha, documentada antes de implementarse.

## Validación

La decisión se revisará con evidencia concreta en semanas posteriores:

- Semana 1 (esta): el starter compila y sirve las 3 inspecciones sintéticas; `make verify` y `public-tests/check.sh` pasan en local y en GitHub Actions.
- Cuando exista manifest y service worker: prueba manual de instalación desde el navegador y de carga de la página con la red desactivada.
- Cuando exista sincronización: prueba de registrar una inspección sin red y verla sincronizada al recuperar la conexión.
- Si alguna de estas validaciones falla de forma no resoluble en el alcance del curso, la decisión vuelve a estado "Propuesta" y se reevalúa frente a las alternativas de esta tabla.

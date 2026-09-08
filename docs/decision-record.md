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

| Criterio                        | PWA                                                         | Web tradicional                           | App nativa                                  | Multiplataforma (p. ej. Flutter/React Native) |
| ------------------------------- | ----------------------------------------------------------- | ----------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| Instalación en el dispositivo   | Sí, desde el navegador                                      | No                                        | Sí, vía tienda de aplicaciones              | Sí, vía tienda de aplicaciones                |
| Conexión intermitente / offline | Sí, con service worker y almacenamiento local (a diseñar)   | No; sin conexión la página no carga       | Sí                                          | Sí                                            |
| Distribución                    | Enlace, sin tienda ni revisión                              | Enlace                                    | Tienda (costo, revisión, tiempos)           | Tienda (costo, revisión, tiempos)             |
| Costo de desarrollo             | Bajo: una base web única                                    | Muy bajo                                  | Alto: por plataforma                        | Medio: otra base de código y herramientas     |
| Mantenimiento                   | Un solo código                                              | Un solo código                            | Varios códigos                              | Un código, ecosistema aparte del web          |
| Capacidades del dispositivo     | Suficientes para este caso (cámara, notificaciones básicas) | Limitadas                                 | Completas                                   | Completas                                     |
| Riesgo principal                | Soporte variable entre navegadores (límites en iOS)         | Sin offline ni instalación: no cubre E-02 | Costo y tiempos fuera del alcance del curso | Curva de aprendizaje y doble ecosistema       |

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

---

# ADR-002 — Hallazgo como entidad de primera clase con operación offline-first

Documento del equipo **9B-E02**. Previo al diseño de UI/UX (RF-09 a RF-90).

## Estado

## Contexto y restricciones

`docs/requirements.md` modela hoy una inspección con `findings` como contador/resumen
(p. ej. "3 hallazgos · Requiere atención"). Ese modelo no permite responder qué hallazgos
existen, cuál es prioritario, cuál fue atendido, quién lo detectó, a qué inspección
pertenece ni cómo sincronizarse individualmente. ADR-001 fijó la estrategia PWA con
operación offline y dejó pendiente documentar almacenamiento local, sincronización y
conflictos; RF-41 a RF-52 y RF-59 a RF-82 exigen seguimiento y priorización por hallazgo.

Restricciones concretas:

- Conectividad intermitente como caso central (escenario E-02): los IDs y el registro
  deben poder generarse sin servidor.
- Coordinación revisa/prioriza hallazgos; el técnico los crea en campo. La matriz de
  permisos Técnico/Coordinación debe quedar definida antes de diseñar navegación.

## Alternativas consideradas

| Criterio                                  | Hallazgo como entidad separada (propuesta) | Contador/resumen en Inspection (status quo) | Hallazgos embebidos en Inspection       |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------- | --------------------------------------- |
| Consultar y priorizar cada hallazgo       | Sí                                         | No                                          | Parcial                                 |
| Seguimiento individual (estado/prioridad) | Sí                                         | No                                          | Parcial                                 |
| Sincronización granular por entidad       | Sí                                         | No                                          | No (sincroniza la inspección completa)  |
| Relación 1 inspección → N hallazgos       | Sí, explícita (`inspectionId`)             | Implícita/imposible                         | Sí, subdocumento                        |
| Evitar duplicados al reconectar           | Sí, con UUID local                         | No aplica                                   | Riesgo de duplicar el arreglo completo  |
| Complejidad inicial                       | Media                                      | Baja                                        | Media-baja                              |
| Riesgo de pérdida en conflictos           | Bajo (por entidad)                         | Alto (pierde semántica)                     | Medio (conflicto a nivel de inspección) |

Condiciones y límites: el status quo no cubre los RF de hallazgos; embebido complica la
resolución de conflictos porque dos técnicos o coordinación y técnico modificarían el mismo
registro completo. Separar entidades permite versionar y sincronizar cada hallazgo de forma
independiente.

## Decisión

Adoptar **hallazgo como entidad de primera clase**, separada de la inspección:

- `Inspection` e `Finding` con `id`, `createdAt`, `updatedAt`; `Finding` referencia su
  inspección mediante `inspectionId` (relación 1 → 0..N).
- Taxonomías canónicas (traducción explícita del modelo a la terminología de las RF):
  - Prioridad: `low` / `medium` / `high` ↔ Baja / Media / Alta.
  - Seguimiento de hallazgo: `pending` / `in_review` / `resolved` ↔ Pendiente / En revisión / Atendido.
  - Sincronización: `local|pending|syncing|synced|error`, alineada con RF-15/RF-25/RF-32.
- El conteo de hallazgos y el resultado de la inspección se **derivan** de los hallazgos
  (`findings.length === 0` → sin incidencias; `> 0` → requiere atención); el estado de flujo
  (`draft` / `completed`) se almacena. Un solo estado no mezcla flujo con resultado.
- Operación offline-first: IDs UUID generados en el dispositivo; persistencia local en
  IndexedDB (`inspections`, `findings`, `syncQueue`); la cola sincroniza por entidad.
- Política de conflictos mínima por `updatedAt` (LWW) con casos explícitos:
  registro nuevo local → crear; sin cambios → no hacer nada; local más reciente →
  actualizar servidor; servidor más reciente → actualizar local o solicitar resolución;
  ambos modificados → conflicto. Límite conocido: comparación de relojes; se documenta
  como política simple y revisable, adecuada al alcance académico.
- Matriz de permisos por rol definida y aprobada antes de la navegación (técnico crea/
  edita borradores; coordinación consulta, asigna prioridad y actualiza seguimiento;
  una inspección finalizada no altera su evidencia original).

Quedan **pendientes de cierre en la Fase 1** del plan antes de la UI (no se deciden aquí):
transiciones permitidas del seguimiento (¿reabrir `resolved`? ¿saltos directos?) y si el
técnico puede asignar prioridad inicial u "opcional".

## Consecuencias y riesgos

Consecuencias positivas:

- Base conceptual estable para RF-09–90; evita rehacer arquitectura de información tras el
  diseño visual.
- Trazabilidad de hallazgos y sincronización granular; menor riesgo de duplicados.
- Los permisos quedan explícitos y verificables antes de implementar navegación.

Costos:

- El modelo de dominio y la cola de sincronización son más complejos que un contador.
- Migración del tipo `InspectionStatus` actual (resultado derivado vs. almacenado).
- Los estados visibles crecen (flujo + resultado + sincronización); exige vocabulario único
  para que RF, ADR y UI hablen el mismo idioma.

Riesgos y mitigaciones:

- Riesgo: LWW por `updatedAt` con relojes de dispositivo imprecisos. Mitigación: documentar
  la política simple, definir tiebreaker y limitar edición concurrente en el alcance académico.
- Riesgo: requisitos desactualizados respecto del modelo (Fase 9 del plan). Mitigación:
  actualizar `docs/requirements.md` con hallazgo-entidad, prioridad, seguimiento, estados,
  permisos y conflictos — o referenciar este ADR — antes de iniciar UI/UX.
- Riesgo: que la UI se diseñe alrededor de estados no contemplados. Mitigación: checklist de
  salida (criterios de §13 del plan) antes de diseño visual definitivo.

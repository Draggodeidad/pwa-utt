# Actividad 1 — Arranque del proyecto y decisión de producto

**Semana 1 · Parcial 1 · 8 puntos · Trabajo en los equipos asignados**

Esta semana pondrán en marcha el proyecto proporcionado y documentarán el problema que resolverá. Al terminar tendrán **un repositorio privado por equipo**, la pantalla inicial funcionando y tres documentos completos. Cada integrante registrará su propia entrega en Classroom usando el mismo repositorio y el mismo commit del equipo.

**Versión aclarada: 4 de septiembre de 2026.** Se conservan los 8 puntos y el alcance original. Se acepta documentación equivalente ya realizada: no rehagan trabajo solo para ajustarlo a estas plantillas. Los ejemplos orientan; no son requisitos adicionales. La fecha y hora aplicables son las visibles en Classroom; esta aclaración no modifica el plazo.

## Qué van a hacer

| Paso | Trabajo | Resultado observable |
|---|---|---|
| 1. Arrancar | Instalar y ejecutar el starter | La pantalla muestra tres inspecciones sintéticas |
| 2. Definir | Completar `docs/requirements.md` | Se entiende el problema, quién usa el producto y cómo verificar sus requisitos |
| 3. Justificar | Completar `docs/decision-record.md` | La comparación explica por qué una PWA resulta adecuada y cuáles son sus límites |
| 4. Verificar y entregar | Ejecutar los comandos, completar evidencia y subir cambios | Todos entregan el mismo SHA y cada uno identifica su contribución |

**Alcance de esta semana:** conservar el starter funcionando, documentar y explicar la verificación. No se pide implementar manifest, service worker, offline, sincronización, notificaciones o autenticación. Tampoco se pide crear pruebas nuevas. Los requisitos del producto futuro se describen, pero todavía no se implementan.

## Paso 1. Poner en marcha un único repositorio del equipo

1. Descarguen los dos adjuntos de Classroom y descompriman ambos. El kit `PWA-w01-kit-estudiante.zip` contiene las instrucciones; léanlo aparte. `PWA-starter.zip` contiene el proyecto que subirán a GitHub. No mezclen las carpetas ni copien el workflow del kit encima del starter.
2. Una persona crea el repositorio privado del equipo y sube el contenido del starter. Nombre sugerido: `pwa-inspecciones-9A-E01`, usando su propio grupo y equipo. Un nombre previo distinto es válido. Si ya comenzaron en repositorios personales, elijan uno y conserven allí el trabajo; no necesitan reiniciar.
3. En GitHub, abran **Settings → Collaborators** e inviten a los demás integrantes y a la cuenta del docente indicada en Classroom. Si no está indicada, repórtenlo al docente. Entreguen puntualmente los demás elementos; una invitación pendiente no demuestra una falla técnica.
4. Cada integrante puede clonar ese mismo repositorio en su computadora. Trabajen sobre ese proyecto durante el curso. Acuerden qué archivo modifica cada persona y sincronicen cambios antes de editarlo.
5. Requisitos: Node.js 20.19 o una versión posterior compatible, npm 10 o posterior, Git y cuenta de GitHub. Desde la carpeta que contiene `package.json`, ejecuten:

```bash
npm ci
npm run dev
```

6. Abran `http://localhost:3000`: deben aparecer tres inspecciones sintéticas. Detengan el servidor con Ctrl+C antes de la verificación final.

Si un comando no existe o falla, anoten comando, versión y mensaje exacto para pedir apoyo. No suban `node_modules`, `.next` ni `.env`. La documentación del producto usa datos sintéticos; la identificación académica se limita a los integrantes de su equipo en el repositorio privado.

## Paso 2. Definir el producto en `docs/requirements.md`

Completen sus seis secciones con análisis del equipo:

- **Problema:** qué dificultad de mantenimiento se quiere resolver y qué queda fuera.
- **Usuarios y escenarios:** quién lo usará y al menos dos situaciones, una con conexión intermitente. Expliquen acción y resultado esperado.
- **Requisitos funcionales:** qué hará el producto, con identificador y condición de aceptación. No hay una cantidad nueva obligatoria: incluyan los necesarios para cubrir los escenarios que describieron.
- **Requisitos no funcionales:** condiciones medibles de reproducibilidad, accesibilidad, seguridad, privacidad, rendimiento y operación offline futura. Declaren cómo y cuándo comprobarlas. Una meta propuesta no debe presentarse como una medición ya realizada.
- **Datos y límites:** qué datos ficticios usarán y qué datos reales quedan excluidos.
- **Aceptación de esta semana:** relacionen los entregables actuales con una inspección o comando real. La calidad de una justificación se revisa leyendo el documento; no se demuestra solo con un build verde.

Ejemplo de formato, para adaptar: «RF-01, producto futuro: registrar una inspección con laboratorio, fecha y hallazgo. Aceptación: al guardar datos válidos aparece un registro con esos mismos valores». **Describirlo ahora no obliga a programarlo esta semana.**

## Paso 3. Justificar en `docs/decision-record.md`

Comparen **PWA, web tradicional, app nativa y multiplataforma** en instalación, conexión intermitente, distribución, desarrollo, mantenimiento y capacidades del dispositivo. Relacionen la comparación con los usuarios y restricciones que definieron.

El curso ya usa Next.js y una trayectoria PWA. El ejercicio consiste en evaluar y justificar esa estrategia: pueden documentar que una alternativa sería mejor bajo otros supuestos sin cambiar el stack de la entrega. Expliquen ventajas, costos, riesgos y cómo revisarían la decisión en semanas posteriores. Una lista de definiciones no sustituye esa comparación.

## Paso 4. Verificar y registrar evidencia individual

En el mismo repositorio, completen `evidence/individual.md` con **una sección por integrante**. Cada persona escribe su contribución concreta, una decisión que puede explicar, el comando o prueba que ejecutó y su resultado, qué comprueba y qué no, una limitación y su uso de IA. Las pruebas del starter ya están proporcionadas; no se exigen suites nuevas, E2E ni experimentos de regresión nuevos.

Distribuyan responsabilidades y revisen el resultado en conjunto. Por ejemplo: una persona prepara el entorno, otra desarrolla requisitos y otra compara alternativas; todas ejecutan la verificación y explican su aportación. En los equipos autorizados de cuatro, la cuarta persona puede concentrarse en revisar la trazabilidad y reproducibilidad. No se exige un número mínimo de commits ni se multiplica el trabajo por el tamaño del equipo.

Desde la raíz del proyecto:

```bash
npm run verify
```

Este comando comprueba archivos, ejecuta las pruebas proporcionadas y compila. Genera `reports/verification.json` con los resultados técnicos y extrae los documentos para revisión. `make verify` es equivalente, pero **no necesitan instalar Make**. El check opcional `bash public-tests/check.sh` solo verifica estructura; no es una segunda evaluación.

El resultado técnico `pass` **no es una calificación**: la calidad de requisitos, comparación y evidencia sigue sujeta a la rúbrica. El reporte no certifica ausencia de secretos.

## Entrega en Classroom: cada integrante entrega

Un integrante integra los cambios finales y hace push. Después:

1. Obtengan el SHA final con `git rev-parse HEAD`. Es el identificador de 40 caracteres de la versión a evaluar. No escriban ese SHA dentro de un nuevo commit: cópienlo en Classroom después del último cambio.
2. Abran **Actions**, seleccionen la ejecución de ese mismo commit y copien su enlace. Esperen a que termine. Si falla y no logran resolverlo antes del plazo, entreguen el enlace y describan el error; no inventen una corrida aprobada.
3. Descarguen el artefacto `starter-week-01-evidence` de esa ejecución y adjunten su `verification.json`. También se acepta el reporte local generado sobre esa misma versión, sin cambios pendientes. El reporte se ignora en Git deliberadamente; se entrega como archivo.
4. **Cada integrante** registra su entrega en la actividad de Classroom, con el mismo repositorio, SHA y enlace de Actions del equipo. Adjunta `evidence/individual.md` e identifica cuál es su sección. Una entrega de un compañero no sustituye la propia.

Copien y completen este formato en Classroom:

```text
Grupo y equipo:
Mi nombre:
Repositorio privado del equipo:
SHA final (40 caracteres):
Enlace a Actions de ese SHA:
Mi sección en evidence/individual.md:
Mi contribución y enlace al archivo, commit o revisión correspondiente:
Acceso del docente: invitado / confirmado / falta cuenta por indicar
Incidencia, si existe:
Adjuntos: verification.json y evidence/individual.md
```

No se requiere pull request adicional. El equipo entrega un producto común; los registros de Classroom permiten asociarlo a cada estudiante. No creen una copia del proyecto por integrante.

## Rúbrica explicada

Se mantienen los pesos originales: AC-01 = 2, AC-02 = 3, AC-03 = 2 y AC-04 = 1. Los desgloses aclaran la evaluación, sin añadir funcionalidades ni pruebas.

- **AC-01, 2 puntos compartidos:** 1 por instalación reproducible con lockfile; 1 por build exitoso. Cada comprobación se puntúa por separado.
- **AC-02, 3 puntos compartidos:** 1 por problema, usuarios y dos escenarios coherentes; 1 por requisitos funcionales vinculados a esos escenarios y verificables; 1 por requisitos no funcionales medibles, datos sintéticos y límites. En cada componente: 1 si está completo y coherente, 0.5 si existe pero tiene omisiones o ambigüedades, 0 si falta o solo conserva las instrucciones sin análisis.
- **AC-03, 2 puntos:** 1 compartido por ejecutar con éxito la prueba proporcionada; 1 individual por documentar y explicar una ejecución, su resultado y una limitación. Para la explicación: 1 si es concreta y correcta, 0.5 si es parcial, 0 si no hay evidencia propia. No se exige escribir pruebas nuevas.
- **AC-04, 1 punto compartido:** 1 si compara las cuatro opciones, justifica la decisión con restricciones e incluye riesgos y validación futura; 0.5 si el análisis es parcial; 0 si falta o solo enumera definiciones.

La base compartida suma hasta 7 puntos; la evidencia de verificación de cada integrante suma hasta 1. Una contribución dudosa genera revisión focalizada, no una sanción automática. Se aceptan documentos equivalentes de la primera versión y no se aplican exigencias nuevas retroactivamente.

## Anexo de referencia académica y evaluación

Las secciones siguientes describen el contrato docente. No son entregables adicionales.

## Scenario

Inspecciones de mantenimiento de laboratorios de la UTT con conectividad intermitente y datos sintéticos.

## Objective

Convertir el caso en requisitos verificables, justificar la estrategia PWA y demostrar un entorno reproducible.

## Competencies

Primaria C08; se introducen y practican C01 y C02. No se presume dominio previo. Antes del arranque, el docente diagnostica brevemente uso de terminal, Git, JavaScript y lectura de errores con el propio starter; las dificultades reciben apoyo y no una penalización adicional.

## Engineering uplift traceability

Mínimo oficial: Unidad I, conceptos, escenarios y herramientas; determinación del tipo de proyecto. Engineering Target: decidir con restricciones y aportar evidencia reproducible, con andamiaje para el estado inicial registrado en PROGRESS.md.

## Prerequisites

Node, npm, Git y acceso a GitHub; instrucciones y apoyo en el paso 1. No se requieren productos de semanas previas.

## Schedule and one-week submission window

Semana 1, Parcial 1, máximo 7 días calendario. Fecha y hora concretas en Classroom. No se modifica aquí la fecha publicada ni se asignan actividades en semanas 7 o 14.

## Difficulty

5/10: ejecución guiada, requisitos verificables y decisión justificada. El producto futuro se especifica sin implementarlo completo.

## Requirements

Un repositorio privado por equipo asignado, starter ejecutable, documentación del equipo y evidencia por integrante. Equipos ordinarios de tres; se conservan las excepciones autorizadas 9A-E11 y 9B-E13 de cuatro.

## Deliverables

Repositorio con `docs/requirements.md`, `docs/decision-record.md`, `evidence/individual.md`, README con instrucciones de ejecución y limitaciones, y los archivos funcionales del starter. `package.json`, lockfile, scripts y pruebas se conservan: no hay que reescribirlos. En Classroom: formato de entrega y dos adjuntos indicados arriba.

## Repository and reproducibility

Desde la raíz: `npm ci`, `npm run dev` y `npm run verify` (equivalente a `make verify`). CI proporciona feedback; el docente verifica la versión fijada independientemente. README registra versiones usadas y cualquier fallo de entorno encontrado. No se requieren Make ni servicios privados para ejecutar el proyecto.

## Acceptance criteria

AC-01: instalación y build. AC-02: requisitos completos y verificables. AC-03: prueba proporcionada y explicación individual. AC-04: comparación y decisión justificadas. Se aplican los niveles de la rúbrica explicada.

### Rubric

| Criterio | Evidencia | Points |
|---|---|---:|
| AC-01 Reproducibilidad | instalación y build del SHA entregado | 2 |
| AC-02 Implementación del alcance documental | requisitos, escenarios, datos y límites | 3 |
| AC-03 Calidad verificable | prueba proporcionada (1) y explicación individual (1) | 2 |
| AC-04 Ingeniería | comparación, decisión, riesgos y validación | 1 |
| Total | | 8 |

## Quality gates

Los fallos técnicos afectan únicamente al componente correspondiente; no anulan automáticamente los demás puntos. Una falta de acceso, discrepancia de SHA o posible exposición de datos abre revisión para resolver la incidencia. La falta de evidencia individual deja pendiente ese componente hasta verificarla; no castiga automáticamente al resto del equipo. No hay topes ni sanciones adicionales implícitos.

## Individual evidence

Una sección por persona en `evidence/individual.md` y una entrega por persona en Classroom. Se permiten evidencias equivalentes ya realizadas. La defensa breve verifica autoría o contradicciones; no introduce puntos ni contenidos nuevos.

## AI policy

IA permitida en la actividad con declaración de herramienta, propósito, partes influenciadas y verificación humana. Cada persona responde por lo que entrega. IA prohibida en los quizzes.

## Submission

La única ruta es la sección «Entrega en Classroom»: un producto por equipo y registro de entrega por integrante. El SHA final se escribe en Classroom después del último commit, no dentro de ese mismo commit.

## Instructor / evaluator

Evaluar una vez la base técnica y documental por equipo y SHA. Asociar a cada integrante su evidencia; registrar nota compartida, componente individual y total. El validador de estructura no asigna calificación por calidad. Usar `INSTRUCTOR_REVIEW.md` y `evaluation.json`; la extracción de documentos en el reporte acelera la revisión semiautomática.

## Automation plan

CI híbrida. Instalación, build y prueba se comprueban automáticamente; los documentos y la explicación se presentan junto a la evidencia para revisión semiautomática. Meta 90% automático o semiautomático, máximo 10% manual independiente; revisión focalizada prevista de hasta 5 minutos por equipo, sin aprobar análisis por simple existencia de archivos.

## Public tests

`npm run verify` genera `reports/verification.json`, ejecuta prueba y build. `bash public-tests/check.sh` verifica solo estructura. Se explicitan los límites de ambas comprobaciones. No se prometen reportes de cobertura ni `evaluation-result.json` que el starter no genera.

## Hidden tests

No hay requisitos ocultos. El docente vuelve a comprobar los mismos criterios en el SHA fijado con herramientas bajo su control. Se retiran los antiguos checks que confundían palabras de documentación con secretos y no verificaban comportamiento.

## Manual review

La revisión del contenido es parte de los criterios semiautomáticos y requiere juicio docente. Ningún comando concede esos puntos automáticamente. Las incidencias se registran y se revisan de manera focalizada.

## Anti-gaming review

Un reporte verde o plantillas sin completar no demuestran dominio. Contrastar documentos, versión, prueba y explicación individual. No usar conteo de commits ni detectores de IA como evidencia única.

## Score calculation

Total individual = base compartida (hasta 7) + explicación individual de AC-03 (hasta 1). Mantener la contribución de 8 puntos al parcial y los pesos AC-01/02/03/04 de 2/3/2/1.

## Manual-review flags

SHA o reporte incongruente, acceso pendiente, documentación sin análisis, evidencia individual ausente o contradictoria, posible dato real o secreto. Una bandera solicita revisión; no es una acusación ni una deducción automática.

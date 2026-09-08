# Requisitos del producto — documento del equipo

Equipo: **9B-E02** · Actividad 1 · Semana 1 (2026-09-04)

## 1. Problema y contexto

El personal técnico de los laboratorios registra las inspecciones de mantenimiento en hojas de cálculo y cuadernos. Esto provoca registros incompletos, pérdidas de información al cambiar de equipo y dificultad para dar seguimiento a un hallazgo. Un registro interrumpido por la falta de conexión agrava el problema: si el técnico no puede anotar en el momento, el hallazgo se olvida o se anota tarde.

Se construirá una PWA de inspecciones que permita consultar y registrar inspecciones desde el teléfono o la computadora del técnico. La conectividad importa porque los laboratorios tienen zonas con señal débil y el personal se desplaza entre edificios: la aplicación debe seguir siendo útil con conexión intermitente (capacidad futura, no implementada en Semana 1).

Fuera de alcance en la Semana 1: modo offline, manifest, service worker, sincronización, notificaciones, autenticación y despliegue. Esta semana solo se instala, ejecuta, documenta y verifica el proyecto base con datos sintéticos. Los requisitos del producto futuro se describen aquí y se implementarán en las semanas correspondientes.

## 2. Usuarios y escenarios

Usuarios principales:

- **Técnica/o de mantenimiento:** realiza y consulta inspecciones en campo, muchas veces en movimiento.
- **Coordinación de laboratorios:** revisa el estado de las inspecciones y prioriza los hallazgos.
- **Estudiante/desarrollador (equipo del curso):** extiende la aplicación semana a semana.

### Escenario E-01 — Consulta con conexión estable

- **Situación inicial:** la técnica A entra a un laboratorio con red disponible y necesita saber qué espacios ya fueron revisados.
- **Acción:** abre la aplicación en su teléfono y mira la lista de inspecciones recientes.
- **Resultado esperado:** ve las tres inspecciones sintéticas con su estado (sin incidencias / requiere atención), fecha, laboratorio y número de hallazgos, y confirma qué espacios están al día.

### Escenario E-02 — Registro con conectividad intermitente

- **Situación inicial:** el técnico B inicia una inspección en un laboratorio con señal débil y la conexión se corta a mitad del recorrido.
- **Acción:** sigue registrando el hallazgo en la aplicación y espera conservarlo para enviarlo después.
- **Resultado esperado (capacidad futura):** la aplicación conserva el registro en curso sin perder información y, al recuperar la conexión, lo envía y queda visible en la lista.

En la Semana 1 E-02 se documenta como objetivo futuro: la cola offline y la sincronización se implementarán en semanas posteriores.

## 3. Requisitos funcionales

Cada requisito se vincula a los escenarios y declara si aplica desde Semana 1 o es del producto futuro.

| ID | Acción del producto | Condición observable de aceptación | Alcance | Escenario |
|---|---|---|---|---|
| RF-01 | Mostrar los registros sintéticos del starter | Al abrir `http://localhost:3000` tras `npm run dev` se ven las 3 inspecciones con ubicación, fecha, responsable, estado y hallazgos | Semana 1 | E-01 |
| RF-02 | Etiquetar el estado de cada inspección | Las tarjetas muestran "Sin incidencias" o "Requiere atención" según el campo `status` | Semana 1 | E-01 |
| RF-03 | Indicar cuántos registros se muestran | La sección de inspecciones incluye un contador con el total (3) | Semana 1 | E-01 |
| RF-04 | Instalarse de forma reproducible | `npm ci` termina sin errores usando `package-lock.json`, sin dependencias añadidas manualmente | Semana 1 | — |
| RF-05 | Verificar la estructura del proyecto | `npm run verify` genera `reports/verification.json` con `status: "pass"` y sin archivos faltantes | Semana 1 | — |
| RF-06 | Registrar una inspección | Al guardar datos válidos de laboratorio, fecha y hallazgo, aparece un registro nuevo con esos mismos valores | Futuro | E-02 |
| RF-07 | Conservar un registro sin conexión | Al perder la conexión, un registro en curso permanece disponible en el dispositivo y no se pierde al recargar | Futuro | E-02 |
| RF-08 | Sincronizar registros pendientes | Al recuperar la conexión, los registros conservados se envían y quedan visibles en la lista sin duplicarse | Futuro | E-02 |

## 4. Requisitos no funcionales

| ID | Condición (medible) | Método de comprobación | Momento de validación |
|---|---|---|---|
| RNF-01 Reproducibilidad | En una copia limpia, con las versiones declaradas en el README (Node v26.2.0 / npm 11.13.0 locales, Node 20.19.6 en CI), `npm ci` y `npm run verify` terminan con código 0 | Ejecutar ambos comandos en un clon sin `node_modules` ni `.next` | Semana 1 y en cada entrega |
| RNF-02 Rendimiento | La página principal responde en menos de 2 s en la máquina de desarrollo y el HTML inicial incluye el contenido de las inspecciones (renderizado del lado del servidor). Supuesto: máquina de desarrollo con red local; el umbral es ilustrativo, no un resultado ya medido | Inspeccionar el HTML devuelto por `http://localhost:3000` y medir el tiempo de respuesta | Semana 1 (carga actual); re-medir con 100 registros sintéticos en la semana de datos |
| RNF-03 Accesibilidad | La estructura de encabezados es jerárquica (`h1`→`h3`) y las secciones usan `aria-labelledby` | Revisión manual de la estructura de encabezados y de atributos ARIA en `src/app/page.tsx` | Semana 1; re-auditar al agregar formularios |
| RNF-04 Seguridad y privacidad | El repositorio no contiene credenciales, claves, `.env` ni datos personales reales; solo datos sintéticos. Nota: `npm run verify` no certifica ausencia de secretos | Revisión manual del contenido versionado y de `.gitignore` (excluye `node_modules/`, `.next/` y `reports/verification.json`) | Antes de cada push; el reporte de verificación declara sus límites |
| RNF-05 Operación offline futura | Con la red desactivada, las 3 inspecciones ya consultadas siguen visibles y un registro nuevo se conserva en el dispositivo. Supuesto: se implementará con service worker y almacenamiento local en semanas posteriores | Prueba manual: cargar la página con red, desactivar la red, recargar y registrar | Semana en la que se implemente offline (no en Semana 1) |
| RNF-06 Mantenibilidad | El proyecto usa TypeScript estricto con tipado explícito (`Inspection`, `InspectionStatus`) y sin dependencias adicionales a Next.js, React y TypeScript | Revisar `tsconfig.json` y `package.json` | Semana 1 y en cada entrega |

## 5. Datos sintéticos y límites

Los datos usados son 100 % sintéticos y viven en `src/lib/data/inspections.ts`: tres inspecciones de laboratorios ficticios con fechas de agosto de 2026, responsables genéricos (Técnica A, Técnico B, Técnica C) y conteos de hallazgos inventados. Campos ficticios: `id`, `location`, `date`, `inspector`, `status`, `findings`, `summary`.

Queda excluida del repositorio y de la documentación: información personal real de estudiantes o personal, fotografías de instalaciones, credenciales, claves, identificadores institucionales sensibles y datos de equipos reales. La identificación académica de los integrantes se registra solo en la evidencia del repositorio privado y en Classroom.

## 6. Criterios de aceptación de la Semana 1

| Entrega | Comprobación técnica | Juicio sobre contenido |
| --- | --- | --- |
| Instalación limpia y reproducible | `npm ci` termina sin errores | — |
| App ejecutable con 3 inspecciones | `npm run dev` + abrir `http://localhost:3000` | — |
| Prueba proporcionada | `npm test` (o `npm run verify`, que la incluye) | — |
| Build reproducible | `npm run build` (incluido en `npm run verify`) | — |
| Estructura y artefactos | `npm run verify` → `reports/verification.json` con `status: "pass"`; `bash public-tests/check.sh` solo valida estructura | El reporte no califica la calidad del análisis |
| Requisitos verificables | — | Revisión de `docs/requirements.md`: escenarios, RF vinculados, RNF medibles, datos y límites |
| Comparación de alternativas | — | Revisión de `docs/decision-record.md` |
| Evidencia por integrante | — | Revisión de `evidence/individual.md` |
| CI en verde | GitHub Actions: workflow "Starter Semana 1 — feedback" exitoso | — |

`npm run verify` valida estructura, prueba y build; NO valida la calidad de los documentos ni certifica ausencia de secretos.

## 7. Requisitos funcionales extendidos (RF-09 a RF-90)

Los RF-09 a RF-90 amplían los requisitos funcionales RF-01 a RF-08 de la sección 3 y sirven como base conceptual estricta para el diseño de pantallas, flujos y estados de UI/UX. Provienen del documento de trabajo `RF-09-a-RF-90.md`. Todos son de alcance **Futuro** (producto en semanas posteriores; no implementados en la Semana 1). Se agrupan en los 13 módulos siguientes.

### Módulo 1 — Acceso y sesión

#### RF-09 — Iniciar sesión
El sistema deberá permitir que un usuario autorizado acceda a la aplicación mediante credenciales.

**Datos a mostrar**
- Identificador o correo del usuario.
- Campo de contraseña.
- Mensajes de error de autenticación.

**Acciones**
- Iniciar sesión.
- Reintentar acceso tras un error.

---

#### RF-10 — Identificar el rol del usuario
El sistema deberá determinar el rol del usuario autenticado.

**Roles conceptuales**
- Técnico/a de mantenimiento.
- Coordinación de laboratorios.

**Acciones**
- Mostrar la navegación y funcionalidades correspondientes al rol.

---

#### RF-11 — Mantener la sesión activa
El sistema deberá conservar la sesión del usuario entre aperturas de la PWA mientras la sesión siga siendo válida.

**Datos a mostrar**
- Estado de sesión cuando sea necesario.

**Acciones**
- Reanudar la aplicación sin solicitar autenticación de nuevo mientras corresponda.

---

#### RF-12 — Cerrar sesión
El sistema deberá permitir finalizar la sesión activa.

**Acciones**
- Cerrar sesión.
- Regresar a la pantalla de acceso.

**Regla**
- Los borradores locales pendientes no deberán eliminarse automáticamente al cerrar sesión.

---

### Módulo 2 — Navegación general y estado de aplicación

#### RF-13 — Mostrar navegación según rol
El sistema deberá mostrar las secciones disponibles para cada tipo de usuario.

**Técnico**
- Inicio.
- Inspecciones.
- Nueva inspección.
- Sincronización.
- Perfil.

**Coordinación**
- Dashboard.
- Inspecciones.
- Hallazgos.
- Perfil.

---

#### RF-14 — Mostrar el estado de conectividad
La aplicación deberá indicar si el dispositivo tiene conexión disponible.

**Estados**
- En línea.
- Sin conexión.
- Conectividad inestable cuando sea detectable.

---

#### RF-15 — Mostrar el estado global de sincronización
La aplicación deberá informar si existen datos pendientes de sincronización.

**Estados**
- Todo sincronizado.
- Registros pendientes.
- Sincronizando.
- Error de sincronización.

---

#### RF-16 — Mostrar cantidad de registros pendientes
El sistema deberá indicar cuántos registros locales esperan sincronización.

**Ejemplo**
- `3 registros pendientes`.

---

### Módulo 3 — Inicio del técnico

#### RF-17 — Mostrar resumen operativo del técnico
La pantalla principal deberá mostrar un resumen de las inspecciones visibles para el técnico.

**Datos**
- Total de inspecciones.
- Sin incidencias.
- Requieren atención.
- Pendientes de sincronización.

---

#### RF-18 — Mostrar inspecciones recientes
La pantalla principal deberá mostrar una lista de inspecciones recientes.

**Datos**
- Laboratorio.
- Fecha.
- Responsable.
- Estado.
- Número de hallazgos.
- Resumen breve.
- Estado de sincronización.

---

#### RF-19 — Abrir una inspección reciente
El técnico deberá poder seleccionar una inspección reciente y abrir su detalle.

---

#### RF-20 — Iniciar una nueva inspección desde el inicio
La pantalla principal deberá incluir una acción rápida para crear una nueva inspección.

---

### Módulo 4 — Listado de inspecciones

#### RF-21 — Consultar todas las inspecciones disponibles
El usuario deberá poder consultar el listado completo de inspecciones disponibles según su rol.

**Datos**
- ID.
- Laboratorio.
- Fecha.
- Técnico.
- Estado.
- Hallazgos.
- Estado de sincronización.

---

#### RF-22 — Buscar inspecciones
El usuario deberá poder buscar inspecciones mediante texto.

**Campos mínimos de búsqueda**
- Laboratorio.
- Técnico responsable.

---

#### RF-23 — Filtrar inspecciones por estado
El usuario deberá poder filtrar por:

- Todas.
- Sin incidencias.
- Requiere atención.

---

#### RF-24 — Filtrar inspecciones por fecha
El usuario deberá poder filtrar por:

- Hoy.
- Semana.
- Mes.
- Rango personalizado.

---

#### RF-25 — Filtrar por estado de sincronización
El técnico deberá poder filtrar inspecciones según:

- Sincronizada.
- Pendiente.
- Error.

---

#### RF-26 — Ordenar inspecciones
El usuario deberá poder ordenar las inspecciones por:

- Más recientes.
- Más antiguas.
- Mayor número de hallazgos.

---

#### RF-27 — Mostrar estado sin resultados
Cuando una búsqueda o filtro no produzca resultados, la interfaz deberá indicarlo.

**Acciones**
- Limpiar filtros.
- Volver al listado completo.

---

### Módulo 5 — Detalle de inspección

#### RF-28 — Consultar detalle completo de una inspección
El sistema deberá mostrar la información completa de una inspección.

**Datos**
- ID.
- Laboratorio.
- Fecha.
- Técnico.
- Estado.
- Resumen.
- Número de hallazgos.
- Lista de hallazgos.
- Estado de sincronización.
- Fecha de creación.
- Última modificación.

---

#### RF-29 — Consultar los hallazgos asociados
El detalle deberá mostrar todos los hallazgos relacionados con la inspección.

---

#### RF-30 — Abrir el detalle de un hallazgo
El usuario deberá poder seleccionar un hallazgo y consultar su información completa.

---

#### RF-31 — Editar una inspección en borrador
El técnico deberá poder modificar una inspección mientras permanezca en estado editable.

**Datos editables**
- Laboratorio.
- Fecha.
- Resumen.
- Hallazgos.

---

#### RF-32 — Diferenciar inspección editable y finalizada
La interfaz deberá distinguir claramente entre:

- Borrador.
- Finalizada.
- Pendiente de sincronización.
- Sincronizada.

---

### Módulo 6 — Nueva inspección

#### RF-33 — Crear una nueva inspección
El técnico deberá poder iniciar una inspección nueva.

**Datos**
- Laboratorio.
- Fecha.
- Técnico.
- Resumen.
- Hallazgos.

---

#### RF-34 — Crear inspección en estado borrador
Toda inspección iniciada deberá poder existir como borrador antes de ser finalizada.

---

#### RF-35 — Guardar automáticamente el progreso
El sistema deberá conservar automáticamente los cambios de una inspección en curso.

**Datos a mostrar**
- Indicador de guardado local.
- Momento aproximado del último guardado.

---

#### RF-36 — Validar campos obligatorios
El sistema deberá impedir finalizar una inspección cuando falten datos obligatorios.

**Validaciones mínimas**
- Laboratorio.
- Fecha válida.
- Resultado de inspección.

---

#### RF-37 — Mostrar errores de validación junto al campo
Cada error deberá aparecer asociado al campo correspondiente.

---

#### RF-38 — Finalizar una inspección
El técnico deberá poder marcar una inspección como completada.

**Acciones del sistema**
- Validar.
- Guardar.
- Determinar estado.
- Sincronizar o encolar según conectividad.

---

#### RF-39 — Confirmar finalización
Antes de finalizar, la aplicación deberá solicitar confirmación.

---

#### RF-40 — Descartar un borrador
El técnico deberá poder eliminar un borrador no finalizado.

**Regla**
- La acción deberá requerir confirmación.

---

### Módulo 7 — Hallazgos

#### RF-41 — Registrar un hallazgo
El técnico deberá poder agregar uno o varios hallazgos a una inspección.

**Datos mínimos**
- Descripción.
- Inspección de origen.
- Laboratorio.
- Fecha de registro.

---

#### RF-42 — Asignar identificador único a cada hallazgo
Cada hallazgo deberá tener un ID independiente.

---

#### RF-43 — Consultar lista de hallazgos de una inspección
El sistema deberá mostrar todos los hallazgos asociados a una inspección.

---

#### RF-44 — Editar un hallazgo
El técnico deberá poder editar un hallazgo mientras la inspección sea editable.

---

#### RF-45 — Eliminar un hallazgo
El técnico deberá poder eliminar un hallazgo no finalizado.

**Regla**
- Requiere confirmación.

---

#### RF-46 — Consultar detalle de hallazgo
El usuario deberá poder abrir un hallazgo individual.

**Datos**
- ID.
- Descripción.
- Laboratorio.
- Fecha.
- Técnico.
- Inspección relacionada.
- Prioridad.
- Estado.
- Fecha de creación.
- Última modificación.

---

#### RF-47 — Asignar prioridad a un hallazgo
El sistema deberá permitir clasificar la prioridad de un hallazgo.

**Valores conceptuales**
- Baja.
- Media.
- Alta.

---

#### RF-48 — Modificar prioridad de un hallazgo
Coordinación deberá poder actualizar la prioridad asignada.

---

#### RF-49 — Registrar estado de seguimiento
Cada hallazgo deberá tener un estado de seguimiento.

**Estados conceptuales**
- Pendiente.
- En revisión.
- Atendido.

---

#### RF-50 — Actualizar estado de seguimiento
Coordinación deberá poder cambiar el estado de un hallazgo.

---

#### RF-51 — Mantener relación entre hallazgo e inspección
Cada hallazgo deberá conservar referencia a su inspección de origen.

---

#### RF-52 — Navegar del hallazgo a la inspección
Desde un hallazgo deberá ser posible abrir la inspección relacionada.

---

### Módulo 8 — Dashboard de coordinación

#### RF-53 — Mostrar resumen general de inspecciones
Coordinación deberá visualizar:

- Total de inspecciones.
- Sin incidencias.
- Requieren atención.
- Total de hallazgos.
- Hallazgos pendientes.

---

#### RF-54 — Mostrar inspecciones que requieren atención
El dashboard deberá destacar inspecciones relevantes.

**Datos**
- Laboratorio.
- Fecha.
- Técnico.
- Número de hallazgos.
- Estado.

---

#### RF-55 — Mostrar actividad reciente
El dashboard deberá mostrar las inspecciones más recientes.

---

#### RF-56 — Navegar desde indicadores del dashboard
Los indicadores deberán poder abrir vistas filtradas relacionadas.

---

#### RF-57 — Mostrar distribución de hallazgos por prioridad
Coordinación deberá poder visualizar cuántos hallazgos existen por nivel de prioridad.

---

#### RF-58 — Mostrar distribución de hallazgos por estado
Coordinación deberá poder visualizar cuántos hallazgos existen por estado de seguimiento.

---

### Módulo 9 — Gestión de hallazgos de coordinación

#### RF-59 — Consultar todos los hallazgos
Coordinación deberá disponer de un listado global.

**Datos**
- Descripción.
- Laboratorio.
- Fecha.
- Técnico.
- Prioridad.
- Estado.
- Inspección.

---

#### RF-60 — Buscar hallazgos
Coordinación deberá poder buscar por texto.

**Campos**
- Descripción.
- Laboratorio.
- Técnico.

---

#### RF-61 — Filtrar hallazgos por prioridad
Filtros:
- Baja.
- Media.
- Alta.

---

#### RF-62 — Filtrar hallazgos por estado
Filtros:
- Pendiente.
- En revisión.
- Atendido.

---

#### RF-63 — Filtrar hallazgos por laboratorio
El usuario deberá poder restringir los resultados a un laboratorio determinado.

---

#### RF-64 — Filtrar hallazgos por fecha
El usuario deberá poder utilizar rangos temporales.

---

#### RF-65 — Ordenar hallazgos
Opciones conceptuales:
- Más recientes.
- Más antiguos.
- Prioridad.
- Estado.

---

### Módulo 10 — Operación offline

#### RF-66 — Mantener una inspección en curso sin conexión
Si se pierde la conexión, la inspección abierta deberá continuar siendo utilizable.

---

#### RF-67 — Conservar cambios al recargar sin conexión
Los datos capturados localmente no deberán perderse al recargar la aplicación.

---

#### RF-68 — Consultar inspecciones previamente almacenadas sin conexión
Las inspecciones ya disponibles localmente deberán seguir visibles.

---

#### RF-69 — Crear múltiples inspecciones offline
El técnico deberá poder generar más de un registro sin conexión.

---

#### RF-70 — Crear y editar hallazgos offline
La captura de hallazgos deberá seguir disponible sin conexión.

---

#### RF-71 — Mostrar que los datos visibles pueden estar desactualizados
Cuando se opere offline, la interfaz deberá advertir que se muestran datos locales.

---

#### RF-72 — Diferenciar registros locales y sincronizados
La UI deberá identificar claramente el estado de persistencia.

---

### Módulo 11 — Sincronización

#### RF-73 — Encolar registros pendientes
Toda inspección finalizada sin conexión deberá agregarse a una cola local.

---

#### RF-74 — Sincronizar automáticamente al recuperar conexión
Al volver la conectividad, el sistema deberá intentar enviar registros pendientes.

---

#### RF-75 — Mostrar progreso de sincronización
La interfaz deberá informar el progreso.

**Ejemplo**
- `Sincronizando 2 de 4`.

---

#### RF-76 — Confirmar sincronización exitosa
El sistema deberá notificar cuándo un registro se sincronizó correctamente.

---

#### RF-77 — Mostrar errores de sincronización
La aplicación deberá indicar qué registros fallaron.

---

#### RF-78 — Reintentar sincronización manualmente
El usuario deberá poder reintentar un envío fallido.

---

#### RF-79 — Evitar registros duplicados
La sincronización deberá utilizar identificadores únicos o un mecanismo equivalente.

---

#### RF-80 — Detectar conflictos de sincronización
El sistema deberá identificar cuando existan versiones incompatibles de un mismo registro.

---

#### RF-81 — Resolver conflictos sin pérdida de información
El sistema deberá aplicar la estrategia documentada de resolución o solicitar intervención cuando sea necesario.

---

#### RF-82 — Mostrar fecha/hora de última sincronización
El usuario deberá poder consultar cuándo ocurrió la última sincronización correcta.

---

### Módulo 12 — Capacidades PWA

#### RF-83 — Permitir instalación como PWA
Cuando el navegador lo soporte, deberá poder instalarse desde el navegador.

---

#### RF-84 — Ejecutar la aplicación instalada
La aplicación instalada deberá conservar los mismos flujos funcionales.

---

#### RF-85 — Cargar el shell básico sin conexión
La interfaz esencial deberá poder abrirse sin conectividad.

---

#### RF-86 — Detectar una nueva versión de la PWA
La aplicación deberá identificar cuando exista una versión más reciente disponible.

---

#### RF-87 — Solicitar actualización de la PWA
La interfaz deberá permitir actualizar la aplicación.

**Regla**
- La actualización no deberá destruir borradores o registros pendientes.

---

### Módulo 13 — Perfil y estado del sistema

#### RF-88 — Consultar información básica del usuario
La pantalla de perfil deberá mostrar:

- Nombre o identificador.
- Rol.

---

#### RF-89 — Consultar información de la aplicación
La aplicación deberá mostrar:

- Versión.
- Estado de conectividad.
- Estado de sincronización.
- Última sincronización.

---

#### RF-90 — Ejecutar sincronización manual
El usuario deberá disponer de una acción `Sincronizar ahora` cuando exista conectividad.

---

### Resumen conceptual de módulos

Los RF-09 a RF-90 quedan agrupados en:

1. Acceso y sesión.
2. Navegación y estado global.
3. Inicio del técnico.
4. Listado de inspecciones.
5. Detalle de inspección.
6. Nueva inspección.
7. Hallazgos.
8. Dashboard de coordinación.
9. Gestión de hallazgos.
10. Operación offline.
11. Sincronización.
12. Capacidades PWA.
13. Perfil y estado del sistema.

Estos requisitos deben utilizarse junto con RF-01 a RF-08 ya documentados en `docs/requirements.md`.

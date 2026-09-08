# Plan de mitigación del principal gap conceptual antes de diseñar UI/UX

Proyecto: **PWA UTT — Inspecciones de mantenimiento en laboratorios**  
Problema a resolver: **los hallazgos actualmente están modelados como un contador/resumen y no como entidades independientes con seguimiento.**

---

# 1. Problema detectado

La documentación actual establece dos necesidades de negocio importantes:

- El técnico registra inspecciones y hallazgos.
- Coordinación revisa el estado de las inspecciones y debe poder priorizar hallazgos.

Sin embargo, el modelo conceptual actual de una inspección contiene campos similares a:

```ts
{
  id,
  location,
  date,
  inspector,
  status,
  findings,
  summary
}
```

donde `findings` representa únicamente una cantidad.

Este modelo permite representar:

```text
Laboratorio A
3 hallazgos
Requiere atención
```

pero no permite responder preguntas esenciales como:

- ¿Cuáles son esos tres hallazgos?
- ¿Cuál de ellos es el más importante?
- ¿Cuál ya fue atendido?
- ¿Quién lo detectó?
- ¿A qué inspección pertenece?
- ¿Cuándo se modificó?
- ¿Cómo debe sincronizarse individualmente?
- ¿Qué sucede si un hallazgo cambia mientras existe una versión local pendiente?

Por lo tanto, diseñar las pantallas antes de resolver esto podría provocar que el diseño visual se construya alrededor de un modelo de datos insuficiente.

---

# 2. Objetivo del plan

Definir antes del diseño UI/UX una estructura conceptual estable para:

- Inspecciones.
- Hallazgos.
- Prioridad.
- Seguimiento.
- Relaciones entre entidades.
- Estados.
- Operación offline.
- Sincronización.

El resultado deberá permitir diseñar pantallas sin tener que rehacer posteriormente la arquitectura de información.

---

# 3. Decisión conceptual propuesta

Separar `Inspection` y `Finding` como entidades independientes.

## Inspection

```ts
type InspectionStatus =
  | "draft"
  | "without_findings"
  | "requires_attention"
  | "completed";

type SyncStatus =
  | "local"
  | "pending"
  | "syncing"
  | "synced"
  | "error";

interface Inspection {
  id: string;
  location: string;
  date: string;
  inspectorId: string;
  status: InspectionStatus;
  summary: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}
```

## Finding

```ts
type FindingPriority =
  | "low"
  | "medium"
  | "high";

type FindingStatus =
  | "pending"
  | "in_review"
  | "resolved";

interface Finding {
  id: string;
  inspectionId: string;
  description: string;
  priority: FindingPriority;
  status: FindingStatus;
  createdAt: string;
  updatedAt: string;
}
```

La cantidad de hallazgos deberá derivarse de:

```ts
inspection.findings.length
```

o de una consulta equivalente, en lugar de almacenarse como un simple número sin relación con registros reales.

---

# 4. Fase 1 — Cerrar reglas de negocio

Antes de diseñar pantallas, el equipo deberá responder y documentar las siguientes decisiones.

## 4.1 ¿Quién crea hallazgos?

Propuesta:

- Técnico: puede crear hallazgos durante una inspección.
- Coordinación: no crea hallazgos dentro de una inspección ya realizada.

---

## 4.2 ¿Quién puede editar hallazgos?

Propuesta:

- Técnico: mientras la inspección permanezca en borrador.
- Coordinación: puede modificar prioridad y estado de seguimiento.
- Una inspección finalizada no debe permitir alterar libremente su evidencia original.

---

## 4.3 ¿Quién asigna prioridad?

Decisión recomendada:

- El técnico puede registrar el hallazgo inicialmente.
- Coordinación determina o modifica la prioridad.

Motivo:
La documentación define expresamente a Coordinación como responsable de revisar y priorizar hallazgos.

---

## 4.4 ¿Cuándo una inspección requiere atención?

Regla propuesta:

```text
Si findings.length === 0
→ "Sin incidencias"

Si findings.length > 0
→ "Requiere atención"
```

Esto evita que el técnico tenga que seleccionar manualmente un estado que puede deducirse.

---

## 4.5 ¿Cuándo un hallazgo se considera resuelto?

Definir una transición explícita:

```text
Pendiente
   ↓
En revisión
   ↓
Atendido
```

Debe decidirse si se permite:

- Volver de `Atendido` a `En revisión`.
- Saltar directamente de `Pendiente` a `Atendido`.

---

# 5. Fase 2 — Definir ciclo de vida

## 5.1 Ciclo de vida de una inspección

```text
Nueva
 ↓
Borrador
 ↓
En captura
 ↓
Finalizada
 ↓
Pendiente de sincronización
 ↓
Sincronizada
```

Casos alternos:

```text
Borrador
 ↓
Descartada
```

y:

```text
Pendiente de sincronización
 ↓
Error
 ↓
Reintento
 ↓
Sincronizada
```

---

## 5.2 Ciclo de vida de un hallazgo

```text
Creado
 ↓
Pendiente
 ↓
En revisión
 ↓
Atendido
```

La prioridad debe existir de forma independiente del estado.

Ejemplo:

```text
Prioridad: Alta
Estado: Pendiente
```

---

# 6. Fase 3 — Resolver propiedad de los datos

Cada entidad deberá tener un propietario y relaciones claras.

## Inspection

```text
Inspection
├── id
├── inspectorId
├── location
├── date
├── status
├── summary
├── syncStatus
├── createdAt
└── updatedAt
```

## Finding

```text
Finding
├── id
├── inspectionId
├── description
├── priority
├── status
├── createdAt
└── updatedAt
```

## Relación

```text
Inspection 1 ────────── N Finding
```

Una inspección puede tener:

```text
0..N hallazgos
```

Cada hallazgo pertenece exactamente a una inspección.

---

# 7. Fase 4 — Diseñar el modelo offline antes de la UI

Este punto debe resolverse antes de diseñar flujos porque la aplicación fue elegida como PWA precisamente por la conectividad intermitente.

## 7.1 Identificadores generados localmente

Los IDs deberán generarse desde el dispositivo, no esperar una respuesta del servidor.

Ejemplo conceptual:

```text
inspectionId = UUID
findingId = UUID
```

Esto permite:

- Crear inspecciones offline.
- Crear hallazgos offline.
- Relacionarlos antes de tener conexión.
- Evitar duplicados posteriormente.

---

## 7.2 Persistencia local

Debe existir almacenamiento local para:

- Inspecciones.
- Hallazgos.
- Cola de operaciones pendientes.

Modelo conceptual:

```text
IndexedDB
│
├── inspections
├── findings
└── syncQueue
```

---

## 7.3 Cola de sincronización

Ejemplo:

```json
{
  "id": "operation-01",
  "entity": "finding",
  "entityId": "finding-123",
  "operation": "create",
  "createdAt": "..."
}
```

La implementación concreta podrá definirse posteriormente; para UI/UX basta con que exista conceptualmente una cola visible mediante estados.

---

# 8. Fase 5 — Definir estrategia de conflictos

El ADR ya contempla resolución por fecha, pero debe concretarse antes de implementar.

## Estrategia mínima propuesta

Cada entidad tendrá:

```text
id
createdAt
updatedAt
```

Cuando se sincronice:

```text
Si servidor.updatedAt <= local.updatedAt
→ enviar versión local

Si servidor.updatedAt > local.updatedAt
→ detectar conflicto
```

---

## Conflictos que deben contemplarse

### Caso A — Registro nuevo offline

```text
Local existe
Servidor no existe
→ Crear
```

### Caso B — Mismo ID y misma versión

```text
Sin cambios
→ No hacer nada
```

### Caso C — Local más reciente

```text
→ Actualizar servidor
```

### Caso D — Servidor más reciente

```text
→ Actualizar local o solicitar resolución
```

### Caso E — Ambos modificados

```text
→ Conflicto
```

Para el alcance académico, se recomienda comenzar con una política simple y documentada, evitando edición concurrente compleja.

---

# 9. Fase 6 — Cerrar permisos por rol

Crear una matriz antes de diseñar pantallas.

| Acción | Técnico | Coordinación |
|---|---|---|
| Ver inspecciones | Sí | Sí |
| Crear inspección | Sí | No |
| Editar borrador | Sí | No |
| Finalizar inspección | Sí | No |
| Crear hallazgo | Sí | No |
| Editar descripción antes de finalizar | Sí | No |
| Ver hallazgos | Sí | Sí |
| Asignar prioridad | Opcional | Sí |
| Cambiar estado de seguimiento | No | Sí |
| Ver dashboard global | No | Sí |
| Reintentar sincronización propia | Sí | Opcional |

Esta matriz debe quedar aprobada antes de diseñar navegación.

---

# 10. Fase 7 — Derivar pantallas desde el dominio

Cuando el modelo anterior esté cerrado, diseñar las pantallas.

## Técnico

```text
Inicio
 ↓
Inspecciones
 ↓
Nueva inspección
 ↓
Datos generales
 ↓
Hallazgos
 ↓
Resumen
 ↓
Finalizar
 ↓
Sincronización
```

## Coordinación

```text
Dashboard
 ↓
Inspecciones
 ↓
Hallazgos
 ↓
Detalle
 ↓
Prioridad / seguimiento
```

---

# 11. Fase 8 — Diseñar estados, no solo pantallas

Cada vista debe diseñarse en varios estados.

Ejemplo: `Nueva inspección`

```text
Normal
Sin conexión
Guardando local
Guardado
Error
Validación incorrecta
Finalización
Pendiente de sincronización
```

Ejemplo: `Hallazgos`

```text
Con resultados
Vacío
Filtrado sin resultados
Cargando
Error
Offline
```

Esto evita tener que improvisar estados visuales durante desarrollo.

---

# 12. Fase 9 — Actualizar requirements.md

Antes de iniciar diseño visual, agregar a `requirements.md` al menos:

- Hallazgo como entidad.
- Prioridad.
- Estado de seguimiento.
- Relación con inspección.
- Reglas de edición.
- Estados de inspección.
- Estados de sincronización.
- Roles y permisos.
- Conflictos básicos.

El objetivo es que Figma no se convierta en la fuente real de requisitos.

La jerarquía deberá ser:

```text
requirements.md
      ↓
modelo conceptual
      ↓
flujos
      ↓
wireframes
      ↓
UI
      ↓
implementación
```

---

# 13. Criterios de salida antes de comenzar UI/UX

No iniciar diseño visual definitivo hasta cumplir todos estos puntos.

## Checklist

- [ ] `Finding` existe como entidad conceptual.
- [ ] Cada hallazgo posee `id`.
- [ ] Cada hallazgo referencia `inspectionId`.
- [ ] Existe una taxonomía de prioridad.
- [ ] Existe un flujo de seguimiento.
- [ ] Está definido quién crea hallazgos.
- [ ] Está definido quién puede editarlos.
- [ ] Está definido quién asigna prioridad.
- [ ] Está definido cuándo una inspección requiere atención.
- [ ] Está definido cuándo una inspección deja de ser editable.
- [ ] Los estados de sincronización están definidos.
- [ ] Los IDs pueden generarse offline.
- [ ] La política básica de conflictos está documentada.
- [ ] La matriz de permisos Técnico/Coordinación está aprobada.
- [ ] Los requisitos funcionales se actualizaron.

---

# 14. Orden recomendado de trabajo

```text
1. Definir entidades
        ↓
2. Definir estados
        ↓
3. Definir reglas
        ↓
4. Definir permisos
        ↓
5. Definir offline/sync
        ↓
6. Actualizar requisitos
        ↓
7. Crear user flows
        ↓
8. Crear wireframes
        ↓
9. Crear sistema visual
        ↓
10. Diseñar UI final
```

---

# 15. Resultado esperado

Al completar este plan, el equipo debería ser capaz de describir un hallazgo sin depender de la interfaz:

```text
El técnico crea una inspección.
Durante la inspección registra uno o varios hallazgos.
Cada hallazgo tiene identidad propia y pertenece a esa inspección.
La inspección puede finalizarse sin conexión.
Los datos se conservan localmente y después se sincronizan.
Coordinación puede consultar cada hallazgo,
asignar prioridad y actualizar su estado de seguimiento.
```

Si esa historia puede representarse únicamente con el modelo de dominio y los requisitos, entonces ya existe una base suficientemente estable para comenzar el diseño UI/UX.

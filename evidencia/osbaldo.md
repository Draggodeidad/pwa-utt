# Evidencia técnica individual — Osbaldo

**Nombre:** Álvarez Martínez Osbaldo  
**Matrícula:** 3523110279  
**Proyecto:** CampusOps / PWA Inspecciones  
**Criterios de rúbrica asignados:** AC-03 (Diagnóstico y manejo del fallo - 1.5 pts) y AC-05 (Aportación individual - 0.5 pts)

---

## 1. Trabajo realizado

* **Diagnóstico y reproducción del fallo controlado:** Creé una suite de pruebas en `tests/inspections.spec.mjs` para verificar la consistencia de etiquetas y estado de las inspecciones de laboratorio (`getInspectionStatusLabel` y `validateInspection`).
* **Investigación de Causa Raíz:** Identifiqué y documenté en `docs/bug-diagnosis.md` el error de asignación (`=`) en lugar de comparación (`===`) en `src/lib/data/inspections.ts` que mutaba el objeto de inspección en memoria y hacía retornar `"Sin incidencias"` para inspecciones que requerían atención.
* **Corrección técnica:** Refactoricé la función `getInspectionStatusLabel` garantizando la comparación inmutable y asegurando que las inspecciones con hallazgos devuelvan `"Requiere atención"`.
* **Configuración del entorno de pruebas:** Actualicé `package.json` para agregar `"type": "module"` y ejecutar la prueba de inspecciones junto a las pruebas starter base con Node.js 22.
* **Documentación académica:** Creé la documentación técnica formal de diagnóstico en `docs/bug-diagnosis.md` y actualicé los artefactos de verificación en `scripts/verify.mjs`.

---

## 2. Archivos modificados

* `src/lib/data/inspections.ts`: Implementación de funciones auxiliares `getInspectionStatusLabel` y `validateInspection` con corrección de comparación.
* `tests/inspections.spec.mjs`: Creación de la prueba unitaria de regresión para consistencia de datos de inspección.
* `package.json`: Configuración de `"type": "module"` y actualización del script `"test"` para ejecutar la suite completa.
* `scripts/verify.mjs`: Inclusión de `docs/bug-diagnosis.md` y `tests/inspections.spec.mjs` en las comprobaciones del starter.
* `docs/bug-diagnosis.md`: Creación del reporte completo de diagnóstico del fallo controlado (AC-03).
* `evidence/osbaldo.md`: Creación de este reporte de evidencia individual.

---

## 3. Verificación de comandos ejecutados

* `npm test`:
  ```text
  starter.spec.mjs: PASS
  inspections.spec.mjs: PASS
  ```
* `node scripts/verify.mjs`:
  ```text
  Starter verificable: PASS
  Reporte: C:\Users\Baldo\OneDrive\Escritorio\cd\pwa-utt\reports\verification.json
  ```
* `bash scripts/verificar_cierre.sh`:
  ```text
  == 1. Tests desactivados o aislados (.skip / .only) ==
  OK: no hay tests desactivados ni aislados.
  == 2. Posibles secretos en el código ==
  OK: no se detectaron secretos evidentes.
  == 3. Archivo .env rastreado por git ==
  OK: ningún .env está siendo rastreado.
  ```

---

## 4. Registro de Commit y SHA Evaluado

* **Rama de trabajo:** `feature/osbaldo-bug-diagnosis`
* **Autor Git:** Osbaldo Álvarez Martínez (`osbaldoXxC <baldo2005_@outlook.com>`)
* **SHA Evaluado:** `072295e0a1b2552ac45b1e7ec067808dd7f35654`

---

## 5. Declaración sobre uso de IA

Se utilizó el asistente de IA Antigravity para guiar el flujo metodológico de auditoría y estructurar la documentación técnica de acuerdo con los criterios del curso. Toda la implementación en código, ejecución de pruebas en terminal, diagnóstico de causa raíz y corrección fue validada de forma directa y empírica en el entorno local. La responsabilidad técnica del entregable es 100% de Álvarez Martínez Osbaldo.

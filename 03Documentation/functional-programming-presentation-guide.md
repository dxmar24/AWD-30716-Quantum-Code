# Guia para explicar la implementacion de programacion funcional

## Proposito del documento

Este documento explica que se implemento, por que se implemento y como se implemento la parte de programacion funcional e interfaces funcionales en el sistema American Latin Class.

Esta escrito como una guia que luego se puede transformar facilmente en diapositivas para una exposicion academica.

---

## Diapositiva 1: Titulo

### Programacion funcional aplicada al sistema American Latin Class

**Tema:** uso de funciones puras e interfaces funcionales en la capa de reportes academicos.

**Sistema:** American Latin Class, plataforma academica para gestion de asistencia, estudiantes, pagos, eventos y reportes.

**Modulo trabajado:** reportes generales y reportes por sede.

---

## Diapositiva 2: Contexto del sistema

American Latin Class necesita reportes reales para la administracion de una academia de baile.

Los directores necesitan consultar informacion como:

- Estudiantes activos.
- Estudiantes retirados.
- Alumnos pendientes de pago.
- Ingresos por mensualidades.
- Ingresos por shows o eventos.
- Asistencia general.
- Reportes por sede.
- Distribucion de estudiantes por nivel B1 y B2.

Antes de esta mejora, parte de esos calculos estaban dentro del controlador de reportes.

---

## Diapositiva 3: Problema detectado

El archivo `ReportsController.js` tenia dos responsabilidades mezcladas:

- Obtener datos desde la base de datos.
- Calcular metricas academicas y financieras.

Esto hacia que el controlador tuviera demasiada logica interna.

Tambien dificultaba probar los calculos de forma aislada, porque las operaciones de negocio estaban mezcladas con la logica del servidor.

---

## Diapositiva 4: Decision de diseno

Se decidio mover los calculos de reportes a un modulo funcional independiente.

El controlador mantiene su responsabilidad principal:

- Recibir la solicitud.
- Aplicar permisos.
- Consultar los datos necesarios.
- Responder al usuario.

El nuevo modulo funcional queda encargado de:

- Calcular ingresos.
- Calcular asistencia.
- Contar estudiantes activos y retirados.
- Agrupar informacion por sede.
- Construir el reporte general.

---

## Diapositiva 5: Archivos modificados

Se implemento la mejora en estos archivos:

- `06Code/src/functional/reportMetrics.js`
- `06Code/src/controllers/ReportsController.js`
- `06Code/tests/unit/report-metrics.test.js`
- `03Documentation/functional-programming-report-layer.md`
- `03Documentation/functional-programming-presentation-guide.md`

El archivo principal de la implementacion es:

```text
06Code/src/functional/reportMetrics.js
```

---

## Diapositiva 6: Que son interfaces funcionales

Una interfaz funcional representa un contrato para una funcion.

En lenguajes como Java, una interfaz funcional suele tener un solo metodo abstracto.

En JavaScript no existen interfaces funcionales nativas, pero se pueden representar usando contratos documentados con JSDoc.

En este proyecto se usaron tipos JSDoc para documentar funciones que reciben otras funciones como parametro.

---

## Diapositiva 7: Interfaces funcionales implementadas

En `reportMetrics.js` se documentaron estas interfaces funcionales:

```js
Predicate<T>
Mapper<T, R>
Reducer<T, R>
NumberSelector<T>
ReportMetricCalculator<TContext, TResult>
```

Cada una describe un tipo de funcion:

- `Predicate<T>`: evalua si un elemento cumple una condicion.
- `Mapper<T, R>`: transforma un elemento en otro valor.
- `Reducer<T, R>`: acumula resultados.
- `NumberSelector<T>`: extrae un numero de un objeto.
- `ReportMetricCalculator<TContext, TResult>`: calcula metricas de reportes.

---

## Diapositiva 8: Ejemplo de Predicate

Un `Predicate` recibe un elemento y devuelve `true` o `false`.

Ejemplo aplicado al sistema:

```js
const isActiveStudent = (student) => student.active !== false;
```

Este predicado permite saber si un estudiante esta activo.

Luego se puede usar con funciones como `filter` o con una funcion reutilizable como `countBy`.

---

## Diapositiva 9: Ejemplo de Mapper

Un `Mapper` transforma un dato en otro.

Ejemplo:

```js
const studentIds = idSetFrom(students, (student) => student.id);
```

Aqui la funcion `(student) => student.id` transforma un estudiante en su identificador.

Eso permite crear un conjunto de IDs sin escribir logica repetida.

---

## Diapositiva 10: Ejemplo de Reducer

Un `Reducer` acumula informacion.

Ejemplo del sistema:

```js
const sumBy = (items, selector) =>
  toMoney(items.reduce((total, item) => total + Number(selector(item) || 0), 0));
```

Esta funcion permite sumar montos de pagos, ingresos de eventos o cualquier otro valor numerico.

La logica se vuelve reutilizable porque recibe una funcion selectora.

---

## Diapositiva 11: Funciones puras

Una funcion pura cumple dos reglas:

- Con los mismos datos de entrada, siempre produce el mismo resultado.
- No modifica datos externos ni altera sus parametros.

En el sistema, funciones como estas son puras:

- `toMoney`
- `sumBy`
- `countBy`
- `calculateAttendanceRate`
- `createBranchReport`
- `buildAcademicReport`

Esto hace que los calculos sean mas faciles de probar y mantener.

---

## Diapositiva 12: Paso 1 de implementacion

### Crear un modulo funcional

Se creo la carpeta:

```text
06Code/src/functional
```

Dentro se agrego:

```text
reportMetrics.js
```

Este archivo contiene la logica funcional de los reportes.

La idea fue sacar del controlador todo calculo que no dependiera directamente de Express ni de la base de datos.

---

## Diapositiva 13: Paso 2 de implementacion

### Definir contratos funcionales

Al inicio de `reportMetrics.js` se agregaron los contratos JSDoc:

```js
/**
 * @template T
 * @typedef {(item: T) => boolean} Predicate
 */
```

Estos contratos documentan como deben comportarse las funciones que se pasan como parametros.

Aunque JavaScript no obliga estos tipos en tiempo de ejecucion, ayudan a explicar y mantener el codigo.

---

## Diapositiva 14: Paso 3 de implementacion

### Crear helpers reutilizables

Se crearon funciones reutilizables:

```js
toMoney(value)
sumBy(items, selector)
countBy(items, predicate)
idSetFrom(items, selector)
```

Estas funciones evitan repetir operaciones comunes.

Por ejemplo, `sumBy` puede sumar pagos o ingresos de eventos usando la misma estructura funcional.

---

## Diapositiva 15: Paso 4 de implementacion

### Crear predicados de negocio

Se crearon predicados especificos del dominio academico:

```js
isActiveStudent
isRetiredStudent
isB1Student
isB2Student
isPaidPayment
isPendingPayment
isPositiveAttendance
```

Estos predicados hacen que las reglas de negocio sean mas claras.

Ejemplo:

```js
const isPendingPayment = (payment) => PENDING_PAYMENT_STATUSES.has(payment.status);
```

---

## Diapositiva 16: Paso 5 de implementacion

### Calcular asistencia con funciones funcionales

Se implemento:

```js
calculateAttendanceRate(records)
```

Esta funcion:

- Recibe una lista de asistencias.
- Cuenta las asistencias positivas.
- Calcula el porcentaje.
- Devuelve un numero entero.

Estados considerados positivos:

- `present`
- `late`
- `justified`

---

## Diapositiva 17: Paso 6 de implementacion

### Crear el reporte por sede

Se implemento:

```js
createBranchReport(branch, source)
```

Esta funcion calcula para una sede:

- Estudiantes activos.
- Estudiantes retirados.
- Estudiantes B1.
- Estudiantes B2.
- Pagos pendientes.
- Monto pendiente.
- Ingreso por mensualidades.
- Ingreso por eventos.
- Ingreso total.
- Porcentaje de asistencia.
- Cantidad de eventos.

---

## Diapositiva 18: Paso 7 de implementacion

### Crear el reporte general

Se implemento:

```js
buildAcademicReport(source)
```

Esta funcion compone todos los reportes por sede y calcula los totales generales.

Internamente usa:

- `map` para crear reportes por sede.
- `reduce` para acumular totales.
- funciones puras para calcular metricas.

---

## Diapositiva 19: Paso 8 de implementacion

### Refactorizar el controlador

Antes, `ReportsController.js` calculaba las metricas directamente.

Despues del cambio, el controlador llama al modulo funcional:

```js
const { buildAcademicReport } = require('../functional/reportMetrics');
```

Y el metodo principal queda mas limpio:

```js
async buildReport(user) {
  const source = await this.reportSource(user);
  return buildAcademicReport(source);
}
```

Esto separa mejor las responsabilidades.

---

## Diapositiva 20: Antes y despues

### Antes

El controlador hacia demasiadas cosas:

- Consultaba datos.
- Filtraba datos.
- Calculaba ingresos.
- Calculaba asistencia.
- Construia totales.
- Armaba la respuesta.

### Despues

El controlador:

- Consulta los datos.
- Aplica permisos.
- Entrega los datos al modulo funcional.

El modulo funcional:

- Calcula las metricas.
- Construye reportes.
- Devuelve resultados listos para responder.

---

## Diapositiva 21: Pruebas agregadas

Se agrego el archivo:

```text
06Code/tests/unit/report-metrics.test.js
```

Las pruebas verifican:

- Que los helpers funcionales funcionen correctamente.
- Que la asistencia se calcule bien.
- Que el reporte por sede calcule datos academicos y financieros.
- Que el reporte general acumule totales.
- Que las funciones no muten los datos originales.

---

## Diapositiva 22: Evidencia de pruebas

Se ejecuto la prueba especifica:

```bash
npm test -- --runTestsByPath tests/unit/report-metrics.test.js
```

Resultado:

```text
5 tests passed
```

Tambien se ejecuto toda la suite:

```bash
npm test
```

Resultado:

```text
7 test suites passed
46 tests passed
```

---

## Diapositiva 23: Beneficios tecnicos

La implementacion mejora el sistema porque:

- Reduce la responsabilidad del controlador.
- Facilita probar reglas de negocio.
- Evita duplicar calculos.
- Hace mas claro el codigo de reportes.
- Permite reutilizar funciones para futuros reportes.
- Separa acceso a datos de calculo de metricas.
- Permite explicar el uso real de programacion funcional.

---

## Diapositiva 24: Beneficios para American Latin Class

La mejora no es solo tecnica.

Tambien ayuda a la academia porque los reportes son mas confiables para tomar decisiones.

Los directores pueden analizar:

- Ingresos por sede.
- Pagos pendientes.
- Asistencia de estudiantes.
- Eventos realizados.
- Estudiantes activos y retirados.
- Distribucion por niveles.

Esto apoya la gestion academica y administrativa de la escuela.

---

## Diapositiva 25: Como explicarlo en clase

Una forma simple de explicarlo:

> Implementamos programacion funcional en la capa de reportes. Antes el controlador mezclaba acceso a datos y calculos. Ahora el controlador obtiene los datos y un modulo funcional se encarga de transformar esos datos en reportes. Para eso usamos funciones puras, predicados, mappers, reducers e interfaces funcionales documentadas con JSDoc.

Luego se puede mostrar:

- El archivo `reportMetrics.js`.
- Las interfaces funcionales documentadas.
- Una funcion como `sumBy`.
- Una funcion de negocio como `createBranchReport`.
- Las pruebas unitarias.

---

## Diapositiva 26: Fragmento clave para mostrar

Este fragmento muestra la idea principal:

```js
const sumBy = (items, selector) =>
  toMoney(items.reduce((total, item) => total + Number(selector(item) || 0), 0));
```

Por que es importante:

- Recibe una funcion como parametro.
- Reutiliza la misma logica para diferentes calculos.
- Evita codigo duplicado.
- Aplica una interfaz funcional tipo `NumberSelector`.

---

## Diapositiva 27: Segundo fragmento clave

Este fragmento muestra composicion funcional:

```js
const branches = safeSource.branches.map((branch) =>
  createBranchReport(branch, safeSource)
);

const totals = branches.reduce(combineBranchTotals, emptyTotals());
```

Aqui se ve el uso de:

- `map` para transformar sedes en reportes.
- `reduce` para acumular totales.
- funciones puras para mantener el calculo separado.

---

## Diapositiva 28: Conclusiones

La implementacion cumple con la tarea de programacion funcional porque:

- Usa funciones puras.
- Usa funciones como parametros.
- Usa interfaces funcionales documentadas.
- Usa `map`, `filter` y `reduce`.
- Separa la logica de negocio del controlador.
- Tiene pruebas unitarias.
- Esta aplicada a una necesidad real del sistema.

No se agrego codigo artificial solo para cumplir la tarea.

La funcionalidad esta conectada con reportes reales que necesita una academia de baile.

---

## Resumen final para exposicion

Se implemento programacion funcional en el modulo de reportes de American Latin Class. La solucion separa los calculos academicos y financieros del controlador, usando funciones puras e interfaces funcionales documentadas con JSDoc.

Esto permite que los reportes sean mas faciles de probar, mantener y extender. Ademas, el cambio aporta valor real al sistema porque apoya la toma de decisiones de directores y administradores de la academia.

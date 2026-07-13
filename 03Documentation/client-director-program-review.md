# Revisión del programa desde la perspectiva del director de la academia

**Perfil de quien revisa:** director de academia de baile y exbailarín
**Alcance:** operación académica, comercial y administrativa del sistema American Latin Class
**Objetivo:** determinar si el programa ayuda a dirigir la academia con control, información confiable y una experiencia útil para cada usuario

## Dictamen ejecutivo

Como director y exbailarín, mi principal preocupación no es cuántas pantallas tiene el sistema, sino si me permite cuidar la experiencia del alumno, sostener la calidad de las clases y saber qué está ocurriendo en la academia sin depender de mensajes, memoria o varias hojas de cálculo.

La solución revisada responde bien a esa necesidad. Su mayor avance es que conecta la operación real: un estudiante se inscribe en un grupo con cupo, asiste a sesiones concretas, puede justificar una ausencia, recibe una evaluación con evidencia suficiente y genera movimientos financieros que no pueden alterarse silenciosamente. Del mismo modo, un profesor registra su jornada contra una clase asignada y el director obtiene indicadores con una fuente identificable.

Mi valoración es **favorable para una puesta en marcha controlada**, no para una activación improvisada en toda la academia. La aplicación ya contiene reglas serias de negocio, separación de responsabilidades, trazabilidad y reportes útiles. La salida a producción debe quedar condicionada a completar la seguridad externa, validar datos reales, hacer pruebas de aceptación con usuarios y comprobar copias de seguridad. Este documento no afirma que el despliegue externo ni la rotación de credenciales ya se hayan realizado.

## Qué problemas de la academia resuelve

### Orden académico

El sistema convierte la programación de clases en una operación verificable. Los grupos tienen sede, nivel, profesor y capacidad; las sesiones se programan con horario; las inscripciones conservan su historia y una persona que excede el cupo pasa a lista de espera. Esto evita situaciones frecuentes como grupos sobrevendidos, alumnos presentes sin inscripción válida, profesores duplicados en dos clases o promociones decididas solo por recuerdo personal.

La asistencia se maneja por lista de la sesión. Puede guardarse como borrador y, cuando la clase termina, finalizarse. Una corrección posterior requiere autoridad y motivo. Para mí, esta regla es importante: un error se puede corregir, pero la historia no se reescribe sin explicación.

### Seguimiento del estudiante

El alumno puede consultar sus clases, asistencia, pagos y solicitudes de justificación. El director conserva dos lecturas distintas de la asistencia:

- La asistencia física muestra lo que ocurrió: presente, tarde o ausente.
- La asistencia ajustada excluye del cálculo las ausencias justificadas y aprobadas, sin fingir que el estudiante estuvo presente.

Esta separación protege la honestidad académica y, al mismo tiempo, permite tratar con justicia una incapacidad médica u otra situación válida.

Las decisiones de beca o promoción se apoyan únicamente en sesiones finalizadas y requieren un mínimo de ocho sesiones contabilizables. La evaluación también conserva sus resultados. El programa ayuda a decidir con consistencia; no reemplaza el criterio artístico y pedagógico del director o del maestro.

### Control del equipo docente

El profesor registra entrada únicamente para una sesión activa que le corresponde y dentro de una ventana razonable alrededor de la clase. La salida calcula minutos pagables con límites y conserva la tarifa aplicable en ese momento. Así, el pago no depende de reconstruir semanas después qué tarifa tenía el docente ni de aceptar jornadas abiertas sin relación con una clase.

Este control debe comunicarse como una forma de proteger a ambas partes: el maestro puede comprobar su trabajo y la academia puede explicar el cálculo.

### Ingresos y cartera

Los cobros se vinculan al estudiante y a su sede. Se controlan duplicados, periodo, valor y coherencia entre estado y fecha de pago. Un cobro pagado no se edita como si nunca hubiera existido; si fue incorrecto, se crea una reversión negativa enlazada y con motivo.

Para dirección, esto ofrece una bitácora mucho más confiable que cambiar celdas en una hoja. Aun así, el módulo es un **libro operativo de la academia**: antes de usarlo como contabilidad oficial, facturación fiscal o nómina legal debe integrarse o conciliarse con los procesos contables exigidos en el país.

### Admisiones y crecimiento

Las solicitudes de nuevos alumnos recorren estados claros: pendiente, contactado, clase de prueba programada, inscrito o perdido. Programar una prueba exige fecha; cerrar una oportunidad como perdida exige motivo; marcarla como inscrita exige que exista el alumno real.

Esto permite saber cuántas personas preguntan, cuántas reciben seguimiento y dónde se pierde interés. Para una academia que quiere crecer, este recorrido comercial es tan importante como contar seguidores en redes sociales.

### Responsabilidad y auditoría

Las operaciones sensibles dejan registro: quién actuó, sobre qué elemento, cuándo y con qué resultado o motivo. Cada rol ve solo lo que necesita según su función y sede. La auditoría no es una pantalla decorativa; sirve para investigar una corrección de asistencia, un cambio de acceso, una reversión financiera o una decisión académica.

## Recorrido de trabajo que esperaría como director

### Al abrir la academia

1. Consulto el tablero general o el de mi sede.
2. Reviso alertas de calidad de datos, cobros vencidos, ocupación y lista de espera.
3. Confirmo las clases del día, profesores asignados y solicitudes de prueba pendientes.
4. Atiendo primero las excepciones: una sesión sin cerrar, una jornada docente abierta o un prospecto sin seguimiento.

### Antes y durante las clases

1. El equipo verifica que el grupo tenga capacidad y estudiantes activos.
2. El profesor consulta sus sesiones asignadas y registra su entrada.
3. La lista de asistencia se carga desde las inscripciones vigentes para esa fecha; los alumnos en espera no aparecen como asistentes regulares.
4. El profesor marca presentes, tardanzas y ausencias. Puede guardar un borrador si aún está trabajando.

### Al terminar la clase

1. El profesor revisa que todos los alumnos tengan estado y finaliza la asistencia.
2. La sesión queda completada con evidencia de quién y cuándo la cerró.
3. El profesor registra salida.
4. Si se descubre un error después, el director corrige con un motivo, sin eliminar la versión previa de la decisión.

### En la revisión semanal

1. Atiendo justificaciones y dejo una decisión explicada.
2. Reviso prospectos, clases de prueba y motivos de pérdida.
3. Comparo cupos, ocupación y lista de espera para abrir, combinar o ajustar grupos.
4. Reviso cartera y realizo cobros o correcciones autorizadas.
5. Identifico sesiones sin asistencia finalizada y registros de mala calidad antes de que contaminen los informes.

### En el cierre mensual

1. Comparo ingresos brutos, reversiones e ingreso neto.
2. Reviso cartera pendiente y su antigüedad.
3. Valido las horas pagables de profesores contra sesiones cerradas.
4. Analizo asistencia, puntualidad, ocupación y conversión comercial por sede.
5. Reviso candidatos a beca o promoción con sus evaluaciones, sin automatizar el criterio pedagógico final.
6. Exporto o concilio los resultados con contabilidad y nómina externas cuando corresponda.

## Reglas que me dan confianza

| Situación | Control del programa | Valor para dirección |
| --- | --- | --- |
| Un grupo alcanza su capacidad | La siguiente inscripción pasa a lista de espera de forma controlada. | Evita promesas de cupo que la sede no puede cumplir. |
| Un alumno cambia o regresa a un grupo | Se crea un nuevo episodio de inscripción y se conserva el historial. | Permite explicar quién pertenecía al grupo en cada fecha. |
| Se programa una clase | Se valida duración, grupo activo y cruce de horario del grupo o profesor. | Reduce conflictos que deterioran la experiencia. |
| Se cierra asistencia | Debe incluir exactamente la lista válida y esperar al final de la sesión. | Hace que el reporte se base en clases realmente impartidas. |
| Se corrige una asistencia cerrada | Solo dirección, con motivo y versión auditada. | Permite corregir sin perder trazabilidad. |
| Se aprueba una justificación | Se conserva la ausencia física y se ajusta el denominador académico. | Combina verdad operacional con trato justo. |
| Se evalúa una beca o promoción | Usa sesiones finalizadas, mínimo de evidencia y resultados guardados. | Evita decisiones prematuras o difíciles de defender. |
| Un profesor registra jornada | Debe corresponder a su sesión y horario; la tarifa queda registrada históricamente. | Mejora la transparencia del pago. |
| Un cobro ya fue pagado | No se modifica; una corrección se realiza mediante reversión enlazada. | Protege el historial financiero. |
| Un director de sede trabaja | Solo accede a sus sedes; los cambios globales quedan reservados. | Reduce errores y exposición innecesaria de información. |

## Indicadores que sí usaría para dirigir

### Experiencia y permanencia del alumno

- **Asistencia física:** porcentaje de presencia real, incluyendo tardanzas según la fórmula definida.
- **Asistencia ajustada:** resultado después de excluir ausencias justificadas aprobadas del universo contabilizable.
- **Puntualidad:** permite separar el hábito de llegar tarde de una ausencia completa.
- **Tendencia mensual:** muestra si la situación mejora o empeora; una cifra aislada no cuenta toda la historia.

### Uso de la capacidad

- **Ocupación:** alumnos activos o en prueba frente a cupos disponibles.
- **Lista de espera:** demanda que la sede todavía no puede atender.
- **Capacidad por grupo:** ayuda a decidir si abrir otro horario, mover salón o ajustar oferta.

Una ocupación alta no siempre es positiva: si perjudica el espacio para bailar o la atención del maestro, la capacidad configurada debe reducirse. El dato orienta; el estándar de calidad lo decide la academia.

### Salud financiera

- **Ingreso bruto:** cobros pagados antes de correcciones.
- **Reversiones:** ajustes negativos identificables.
- **Ingreso neto:** resultado después de reversiones.
- **Cartera y antigüedad:** saldos por vencer o vencidos y cuánto tiempo llevan pendientes.
- **Detalle de pago docente:** minutos pagables, tarifa histórica y total por sesión.

Estas cifras deben poder conciliarse con una muestra de movimientos individuales antes de aceptar el cierre.

### Crecimiento comercial

- Solicitudes recibidas.
- Personas contactadas.
- Clases de prueba programadas.
- Inscripciones efectivas.
- Oportunidades perdidas y sus motivos.

El embudo permite mejorar el seguimiento, pero no debe convertirse en presión para registrar una inscripción que todavía no existe.

### Calidad de la información

Las alertas sobre sesiones sin finalizar, jornadas docentes abiertas, cobros inconsistentes, referencias faltantes, sobrecupo o prospectos abandonados son un indicador de gestión en sí mismas. Un tablero sin alertas no significa que la academia esté perfecta; significa que los controles automáticos conocidos no detectaron excepciones en ese momento.

## Utilidad de la experiencia por rol

| Rol | Lo que necesita hacer con rapidez | Evaluación desde dirección |
| --- | --- | --- |
| Director general | Comparar sedes, gestionar estructura, revisar reportes, auditoría, reversiones y decisiones académicas. | La visión consolidada es útil y mantiene separados los cambios de alto impacto. |
| Director de sede | Gestionar alumnos, grupos, sesiones, cobros, justificaciones y prospectos de sus sedes. | El alcance por sede evita ruido y limita errores fuera de su responsabilidad. |
| Profesor | Ver sus clases, registrar entrada/salida y diligenciar la lista del grupo. | El flujo está orientado al momento real de clase y reduce tareas administrativas innecesarias. |
| Estudiante | Consultar grupos, próximas clases, asistencia, pagos y enviar justificaciones. | Aumenta transparencia y reduce preguntas repetitivas a recepción. |
| Administrador técnico | Configurar accesos y atender soporte excepcional. | Debe usarse con moderación; no es una cuenta para la operación diaria del director. |

En una prueba con usuarios reales se debe comprobar que los nombres, mensajes y orden de acciones sean comprensibles sin capacitación técnica. Las gráficas deben conservar una tabla o detalle que permita verificar la cifra y apoyar a usuarios que no dependan de lo visual.

## Riesgos y pendientes antes de producción

Los siguientes puntos no invalidan el programa, pero sí condicionan una salida responsable:

1. **Credenciales externas:** revocar y rotar cualquier contraseña, llave, token o secreto que haya estado expuesto en historial, documentación o ambientes previos. Limpiar un archivo no invalida una credencial ya conocida.
2. **Despliegue real:** verificar en el servidor de destino HTTPS, dominio, variables de entorno, cookies seguras, política de origen, acceso restringido a base de datos y ausencia de herramientas administrativas públicas. Esta revisión no certifica que esa tarea externa ya esté completada.
3. **Base de datos y migraciones:** ejecutar las migraciones con respaldo, registro de versión y prueba de restauración. No improvisar cambios directos en tablas de producción.
4. **Datos iniciales:** depurar duplicados y validar alumnos, sedes, grupos, saldos, tarifas y matrículas antes de importar. Un buen sistema no vuelve verdadero un dato incorrecto.
5. **Aceptación humana:** probar los recorridos con al menos un director, un profesor y un estudiante, idealmente en una sede piloto y con teléfonos reales.
6. **Privacidad:** definir responsables, tiempo de conservación, atención de solicitudes del titular y reglas sobre fotografías, evidencias médicas y datos de menores conforme a la normativa aplicable.
7. **Continuidad:** configurar copias de seguridad automáticas, restauración ensayada, monitoreo, alertas, soporte y un procedimiento manual temporal si el servicio falla.
8. **Conciliación legal:** acordar cómo se conectan cobros y jornadas con contabilidad, facturación y nómina oficiales. El sistema no debe presentarse como sustituto legal sin esa validación.
9. **Gobierno de cambios:** asignar quién puede cambiar capacidades, tarifas, reglas de beca, roles y accesos; revisar periódicamente la auditoría y retirar usuarios inactivos.

## Criterios de aceptación del cliente

Consideraría el sistema aceptado para un piloto cuando se demuestre, con datos de prueba y evidencia guardada, lo siguiente:

### Operación académica

- [ ] Se puede crear un grupo con sede, nivel, profesor y capacidad válidos.
- [ ] Una inscripción dentro del cupo queda activa y una inscripción que lo supera pasa a espera.
- [ ] No se puede programar al mismo profesor o grupo en horarios cruzados.
- [ ] El profesor ve solo sus clases autorizadas y puede completar una lista desde un teléfono.
- [ ] La asistencia final exige todos los estudiantes de la lista y no admite volver silenciosamente a borrador.
- [ ] Una corrección deja actor, fecha y motivo visibles en auditoría.
- [ ] Una ausencia justificada conserva el hecho original y ajusta correctamente el indicador.

### Finanzas y personal

- [ ] No se crea dos veces el mismo cobro activo para alumno, periodo y concepto.
- [ ] Cobrar, cancelar y revertir producen el historial esperado y el neto se puede conciliar manualmente.
- [ ] El director de sede no puede realizar una reversión reservada al nivel global.
- [ ] La entrada docente solo funciona para una sesión asignada y la salida calcula minutos y tarifa esperados.
- [ ] El reporte de pago coincide con una muestra calculada manualmente.

### Dirección y crecimiento

- [ ] El embudo comercial exige fecha de prueba, motivo de pérdida y alumno real para una conversión.
- [ ] Los reportes cambian correctamente por periodo y sede.
- [ ] Asistencia, ocupación, cartera, ingreso bruto, reversión e ingreso neto se pueden rastrear hasta sus registros fuente.
- [ ] Las becas y promociones no usan sesiones en borrador y exigen la evidencia mínima definida.
- [ ] Las alertas identifican deliberadamente un dato incompleto introducido en el ambiente de prueba.

### Seguridad, privacidad y continuidad

- [ ] Cada rol intenta acceder a datos propios, de otra sede y globales; los accesos no autorizados son rechazados.
- [ ] Cambiar contraseña invalida sesiones anteriores y las cuentas inactivas no pueden continuar operando.
- [ ] Las credenciales externas fueron rotadas y el ambiente productivo no expone base de datos ni consola administrativa.
- [ ] Existe HTTPS válido, respaldo automático y una restauración probada.
- [ ] El responsable de datos aprobó la política de privacidad, conservación y tratamiento de evidencias.
- [ ] El equipo conoce a quién acudir y cómo operar temporalmente ante una caída.

### Usabilidad

- [ ] Director, profesor y estudiante completan sus tres tareas principales sin ayuda del desarrollador.
- [ ] La experiencia funciona en móvil y escritorio con textos legibles, foco de teclado y mensajes de error accionables.
- [ ] Una gráfica mantiene un detalle tabular o una ruta clara para verificar su cifra.
- [ ] Los usuarios distinguen guardar borrador, finalizar, cancelar y revertir antes de confirmar una acción irreversible.

## Recomendación de puesta en marcha

Recomiendo avanzar en cuatro pasos:

1. **Cerrar seguridad externa:** rotar credenciales, preparar infraestructura, aplicar migraciones y probar respaldo/restauración.
2. **Aceptar en preproducción:** ejecutar los criterios anteriores con un conjunto pequeño de datos representativos y documentar cualquier diferencia.
3. **Pilotar una sede:** operar durante al menos un ciclo completo de clases y un cierre de cobros, con acompañamiento diario y sin eliminar de inmediato el mecanismo anterior.
4. **Expandir con evidencia:** conciliar los resultados del piloto, corregir fricciones, capacitar por rol y luego incorporar las demás sedes.

Durante el piloto mediría cinco resultados sencillos: porcentaje de asistencias finalizadas a tiempo, prospectos sin seguimiento, diferencias de conciliación financiera, registros docentes abiertos y tareas que aún requieren hojas o mensajes externos. Si esas excepciones disminuyen y los usuarios pueden trabajar sin soporte permanente, el sistema estará demostrando valor real.

## Conclusión personal

Como exbailarín sé que una academia no se dirige solo con números. Importan el ambiente, la evolución del alumno, la confianza en el maestro y la energía de cada clase. Pero también sé que crecer sin registros claros termina afectando precisamente esas cosas.

Este programa ofrece una base sólida para profesionalizar la academia sin quitarle el criterio humano. Sus mejores cualidades son la historia de inscripciones, la asistencia finalizada y corregible con trazabilidad, el control de cupos, el libro financiero con reversiones, el seguimiento comercial y los reportes con alertas de calidad. Mi recomendación es **aprobarlo para piloto condicionado**, completar los pendientes externos y decidir la expansión después de observar un ciclo real de operación.

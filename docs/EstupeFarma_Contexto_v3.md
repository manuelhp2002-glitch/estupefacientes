# EstupeFarma — Memoria Completa del Proyecto

> Documento de contexto para el desarrollo de la aplicación web de gestión de estupefacientes del Servicio de Farmacia del Hospital Universitario Nuestra Señora de Candelaria (HUNSC).
> Versión consolidada — julio 2026 (v3: catálogo oficial Código V, umbrales de stock, códigos de error clasificados, ciclo de vida de pedidos, notificaciones)

---

## 1. Misión del proyecto

EstupeFarma es una aplicación web interna diseñada para digitalizar, centralizar y mejorar la gestión de los medicamentos estupefacientes en el Servicio de Farmacia del HUNSC.

Los estupefacientes son medicamentos de control legal estricto sujetos a la Convención Única de 1961 y a la normativa española vigente (AEMPS). Cualquier descuadre, movimiento anómalo o dato incorrecto tiene implicaciones regulatorias graves. La aplicación busca mejorar la trazabilidad, detectar errores de forma proactiva y facilitar las obligaciones de declaración.

El sistema actual se basa en hojas de cálculo Excel dispersas, registros manuales y el propio sistema ATHOS SADE. EstupeFarma centraliza todo esto en una única interfaz estructurada, sin sustituir el SADE sino complementándolo.

---

## 2. Regla de privacidad — ABSOLUTA E INVIOLABLE

**La aplicación nunca debe manejar, mostrar, almacenar, mencionar ni inferir nombres de pacientes**, bajo ninguna circunstancia ni formato.

Los movimientos de estupefacientes se vinculan exclusivamente a:
- Unidades clínicas (EAP02, HEMO, EN03, UVI, etc.)
- Números de vale
- Códigos de pacientes ficticios del sistema (ver sección 7.3)

Si en algún archivo de entrada se detecta un nombre de paciente, debe notificarse al farmacéutico y excluirse del procesamiento por completo.

---

## 3. Contexto hospitalario y operativo

### 3.1 Responsabilidades del equipo

| Rol | Responsabilidades clave |
|---|---|
| Jefe de Servicio de Farmacia | Solicitud de vales oficiales a la Delegación Provincial, diligencia de libros de contabilidad, declaración anual AEMPS |
| Farmacéutico adjunto / supervisor (×2) | Control del libro oficial, custodia de talonarios, gestión de caducidades, control de existencias y movimientos en SADE, supervisión de correcciones de stock, recepción formal de pedidos |
| Residente (×2) | Entradas en SADE de pedidos, control interno de pedidos, almacenaje. Uno responsable de orales, otro de parenterales/transdérmicos |
| Farmacéutico de guardia (tarde) | Avisa de la llegada física de pedidos fuera de horario habitual |
| Enfermería | Dispensación con vale y libro de contabilidad, elaboración de mezclas estériles con estupefacientes |
| Personal auxiliar | Entrega y control de talonarios a unidades clínicas |

### 3.2 Documentación oficial

- **Libro Oficial de Contabilidad de Estupefacientes (electrónico)** — registro de todos los movimientos del SF, exportable desde ATHOS SADE
- **Vale Oficial de Estupefacientes** — documento legal para pedido a proveedor. Talonarios de 100 vales numerados y sellados por la Delegación Provincial. Matrices conservadas 2 años (art. 34, Convención Única 1961)
- **Vale de Estupefacientes Intrahospitalario** — para solicitudes dentro del hospital sin prescripción electrónica o para unidades sin ATHOS
- **Libro de Contabilidad de Unidades Clínicas** — modelo H-290 (plantas/consultas) y H-578 (quirófanos)
- **Declaración Anual AEMPS** — notificación telemática de movimientos anuales a la Agencia Española de Medicamentos y Productos Sanitarios

---

## 4. Sistemas informáticos involucrados

| Sistema | Nombres alternativos | Función |
|---|---|---|
| ATHOS SADE | Athos Dosys SADE | Armario automatizado de almacenamiento, dispensación y registro. El 100% del stock del SF vive aquí |
| DRAGO Farma | FARMATOOLS, DRAGO | Sistema de gestión hospitalaria de farmacia. **DRAGO Farma y FARMATOOLS son el mismo sistema**, referenciado con ambos nombres indistintamente. NO son dos aplicaciones distintas |
| Seflogic® | — | Sistema de recepción de mercancía. Registra lote, caducidad y albarán |

### 4.1 Módulos de DRAGO Farma / FARMATOOLS

| Módulo | Descripción |
|---|---|
| **Maestro** | Catálogo de medicamentos con sus características y el stock registrado en el sistema. Es el "stock Maestro" comparado en el inventario semanal |
| **Gestión** | Permite modificar y corregir descuadres de stock entre sistemas. Siempre bajo supervisión de un farmacéutico adjunto responsable |

El SADE es la fuente de verdad operativa. Todos los movimientos (entrada, devolución, salida, reincorporación, traspaso) se realizan y quedan registrados en él. Todos los usuarios acceden con usuario y contraseña individuales para garantizar trazabilidad total.

---

## 5. Catálogo oficial de estupefacientes (Código V)

> ⚠️ **Regla fundamental:** el identificador único de medicamento en toda la aplicación es el **Código V**, NUNCA el Código Nacional (CN). El CN queda limitado exclusivamente al Registro de Pedidos (F4), que es donde se gestiona la relación con proveedores. En Inventario, Detector de Alertas, Caducados e Incidencias solo se usa Código V + nombre.
>
> Esta tabla sustituye cualquier lista o código de medicamento usado en versiones anteriores del proyecto — varios ejemplos previos usaban Códigos V incorrectos o inventados.

### 5.1 Orales
*(comprimidos, cápsulas, solución oral)*

| Código V | Estupefaciente | MAX (stock, 1 mes) | MIN (stock, 15 días) |
|---|---|---|---|
| V04751 | FENTANILO BUCAL 200 mcg comp | 100 | 50 |
| V04718 | FENTANILO BUCAL 400 mcg comp | 90 | 45 |
| V04740 | FENTANILO BUCAL 600 mcg comp | 0 | 0 |
| V04731 | FENTANILO BUCAL 800 mcg comp | 30 | 15 |
| V00639 | METADONA 5 mg comp or/sonda | 80 | 40 |
| V09424 | MORFINA RÁPIDA 10 mg comp (Sevredol) | 80 | 40 |
| V03592 | MORFINA MST LIB PROLONG 5 mg comp | 360 | 180 |
| V00655 | MORFINA MST LIB PROLONG 10 mg comp | 780 | 390 |
| V00656 | MORFINA MST LIB PROLONG 30 mg comp | 240 | 120 |
| V00657 | MORFINA MST LIB PROLONG 100 mg comp | 60 | 15 |
| V45673 | MORFINA sol oral 2 mg/1 mL 100mL (Oramorph) | 4 | 2 |
| V29931 | OXICODONA RÁPIDA 10 mg caps | 40 | 20 |
| V02175 | OXICODONA LIB PROLONGADA 10 mg comp | 300 | 150 |
| V02208 | OXICODONA LIB PROLONGADA 20 mg comp | 100 | 50 |
| V18636 | OXICODONA 10 mg/mL sol 30mL (Oxynorm) | 10 | 5 |
| T93631 | P METADONA CLORHIDRATO 100 g (O-29) *(materia prima farmacotecnia)* | — | — |

### 5.2 Intravenosos / Parenterales / Transdérmicos
*(ampollas, viales, parches)*

| Código V | Estupefaciente | MAX (stock, 1 mes) | MIN (stock, 15 días) |
|---|---|---|---|
| V07610 | FENTANILO 150 mcg/3mL amp | 10000 | 5000 |
| V02257 | FENTANILO TRANSDÉRMICO 100 mcg/h parche | 20 | 10 |
| V02227 | FENTANILO TRANSDÉRMICO 12 mcg/h parche | 200 | 100 |
| V02258 | FENTANILO TRANSDÉRMICO 25 mcg/h parche | 160 | 80 |
| V02256 | FENTANILO TRANSDÉRMICO 50 mcg/h parche | 50 | 30 |
| V02715 | FENTANILO TRANSDÉRMICO 75 mcg/h parche | 20 | 10 |
| V02304 | PETIDINA (MEPERIDINA) 100 mg/2mL amp | 180 | 90 |
| V03200 | METADONA 10 mg/1mL amp IV/SC/ORAL | 48 | 24 |
| V19632 | REMIFENTANILO 1 mg/3mL vial | 60 | 30 |
| V19630 | REMIFENTANILO 5 mg/10mL vial | 700 | 350 |
| V19176 | MORFINA 10 mg/1mL amp 1% | 4000 | 2000 |
| V02015 | MORFINA 2% 20 mL (400 mg) vial parenteral | 40 | 20 |
| Y81210 | MORFINA 400 mg/10mL amp 4% | 20 | 10 |
| V02016 | MORFINA 4% 10 mL (400 mg) ampolla parenteral | 20 | 10 |
| Y50002 | PCA MORFINA 100 mg (mezcla) | 20 | 10 |
| Y94156 | MEZCLA EPI 131 mL BUPI 0,099% + FENTA 0,00019% | 20 | 10 |

### 5.3 Lógica de umbrales MAX/MIN

Estos valores se aplican sobre el stock real (ATHOS REAL) registrado en el **Inventario Semanal (F1)**:

| Situación | Rango | Acción recomendada |
|---|---|---|
| 🟢 Stock sobrado | Stock ≥ MAX | Sin acción — nivel óptimo |
| 🟡 Pedir a laboratorio | MIN ≤ Stock < MAX | Generar pedido a través de Seflogic® / laboratorio habitual |
| 🔴 Pedir a cooperativa urgente | Stock < MIN | Pedido urgente a COFARTE (cooperativa) — riesgo de rotura de stock |

**Integración con F1 (Inventario Semanal):** al guardar un inventario, la aplicación debe comparar el valor de ATHOS REAL de cada medicamento contra su MIN/MAX correspondiente (por Código V) y, si cae en rango de "pedir a laboratorio" o por debajo de mínimo, generar automáticamente un **aviso para el farmacéutico supervisor** indicando el medicamento y la acción recomendada (pedir a laboratorio / pedir urgente a cooperativa).

---

## 6. Errores del Libro/Histórico — códigos y clasificación

Patrones de detección para la funcionalidad **Detector de Alertas (F3)**, con nombre técnico, descripción, lógica de detección y nivel de gravedad.

### 🔴 Críticos

| Código | Nombre | Descripción | Cómo se detecta |
|---|---|---|---|
| **E03** | Corrección rápida dispensación↔devolución | Dispensación seguida (o precedida) de una Devolución en menos de 60 minutos — sugiere error de manipulación real (medicamento/paciente/cantidad equivocada) corregido al momento. Puede ser del mismo estupefaciente o de otro distinto | Para cada `Dispensación`, buscar una `Devolución` (cualquier estupefaciente) en ventana de ±60 min |
| **E05** | Cantidad cero | Movimiento registrado con 0 unidades — no tiene sentido físico y compromete la integridad legal del libro | `Cantidad = 0` en cualquier tipo de movimiento |
| **E06** | Vale duplicado entre medicamentos | El mismo número de vale aparece en movimientos de dos medicamentos distintos — error de selección de medicamento al registrar | Agrupar por `Número Vale`; si el conjunto de `Código V` asociado tiene más de un valor → alerta |
| **E07** | Palabra clave de corrección en nota | El propio personal deja constancia escrita de un error ("error", "subsanación", "anulado", "compensación", "falso/a") — confirmación explícita, no sospecha estadística | Búsqueda de texto (case-insensitive) en campo `Nota` |
| **E08** | Stock final negativo | Stock resultante negativo tras un movimiento — físicamente imposible | `Cantidad Final < 0` (o `Cantidad Final Dispensador < 0`) |
| **E10** | Rotura fuera del SADE sin par completo | Según el Anexo I.1 del procedimiento oficial: una rotura fuera del SADE exige (1) Devolución de las unidades rotas no repuestas en Athos de planta, y (2) Dispensación de esas mismas unidades al paciente ficticio "ESTUPES Rotura en Farmacia" (código 99000000). Si falta cualquiera de los dos → error grave de trazabilidad | Buscar cada `Dispensación` a código 99000000; debe existir `Devolución` del mismo medicamento en ventana cercana. Si no existe el par completo → alerta |
| **E11** | Descuadre en par de rotura | El par Devolución + Dispensación(99000000) existe pero las cantidades no coinciden — no se dio salida a la cantidad exacta rota | Comparar `Cantidad` de ambos movimientos del par E10 |

### 🟡 De vigilar

| Código | Nombre | Descripción | Cómo se detecta |
|---|---|---|---|
| **E01** | Carga manual sospechosa | Entrada de stock manual que no proviene de una recepción de pedido validada. Puede tener justificación legítima | `Tipo = Carga` |
| **E02** | Descarga manual sospechosa | Salida de stock manual sin dispensación real asociada. Puede tener justificación legítima | `Tipo = Descarga` |
| **E04** | Devolución sin dispensación previa | Devolución sin dispensación de cantidad similar en rango cercano. Puede ser normal (sobrante de reposición de Athos) o un error | Para cada `Devolución`: buscar `Dispensación` del mismo Código V con cantidad similar en ventana ±48h. Si no existe → alerta |
| **E09** | Carga sin variación de stock | Carga que no modifica el stock final respecto al movimiento anterior — sugiere registro fantasma o duplicado, pero no genera descuadre real | `Tipo = Carga` Y `Cantidad Final(actual) = Cantidad Final(anterior)` para ese medicamento |
| **E12** | Caducidad sin par completo | Salida por caducidad debe ir al paciente ficticio "ESTUPES CADUCADOS FARMACIA" (código 99999944). Si el texto sugiere caducidad pero el código no coincide → se señala para comprobación manual, no se confirma automáticamente | Buscar "caduc" en `Nota`/`Descripción`; verificar destino = código 99999944 |

**Notas generales:**
- Los movimientos en horario inusual **NO** son criterio de alerta.
- Las entradas sin vale oficial (préstamos, intercambios, mezclas) pueden tener formatos muy variados — no tratarlas automáticamente como erróneas.
- Las salidas por caducidad (E12) solo generan alerta de comprobación manual — no se cruzan automáticamente con el Registro de Caducados (F5).
- Si no hay movimientos que cruzar entre Libro e Histórico para una fila dada, se incluye igualmente en la tabla sin cruzar (marcada como "solo en Libro" / "solo en Histórico"), sin forzar ningún cruce artificial.

---

## 7. Flujos operativos del SADE

### 7.1 Pedidos a proveedor

- **A laboratorio:** vía Seflogic® + vale oficial firmado, enviado por correo ordinario. Se pide por unidades.
- **A cooperativa (COFARTE):** vía web. Vale oficial entregado en mano en la recepción. Se pide por envases.

Proveedores habituales: COFARTE, COFARES, KERN PHARMA, FERRER FARMA, BRAUN, LAPHYSAN, MUNDIPHARMA, REIG JOFRE.

### 7.2 Tipos de movimiento válidos

| Tipo | Descripción |
|---|---|
| Dispensación | Salida a paciente o unidad clínica con vale. Genera consumo y nº de vale electrónico |
| Devolución | Retorno al SADE. Solo válida en 2 situaciones: sobrante de reposición Athos o devolución de dispensación previa |
| Reposición | Llenado de Athos de planta desde SADE. Vales con texto libre: "repo", "repo q-4", "repo athos en06-1"... (comportamiento normal del sistema) |
| Carga | Entrada manual de stock. Siempre requiere vale + proveedor válidos |
| Descarga | Salida manual de stock. Siempre sospechosa — debe justificarse |
| Retirada | Retirada de caducados o rotos desde Athos de planta |

### 7.3 Entradas al SADE sin vale oficial de proveedor

| Origen | Vale en sistema | Proveedor en sistema |
|---|---|---|
| Intercambio Hospital Sur | INTERCAMBIO | H. SUR |
| Mezclas estériles | NOMBRE MEZCLA | CAMPANAS |
| Préstamo de otro hospital | PRÉSTAMO | HOSPITAL |
| Fórmulas magistrales (metadona) | METADONA | FARMACOTECNIA |

### 7.4 Dispensación con pacientes ficticios (salidas especiales)

| Motivo de salida | Paciente ficticio | Código | Genera mov. FARMATOOLS |
|---|---|---|---|
| Rotura fuera del SADE | ESTUPES Rotura en Farmacia | 99000000 | ✅ SÍ |
| Medicamento caducado en farmacia | ESTUPES CADUCADOS FARMACIA | 99999944 | ✅ SÍ |
| Farmacotecnia / fórmulas | ESTUPES FARMACOTECNIA | 99990000 | ❌ NO |
| Préstamo a otro hospital | ESTUPES PRÉSTAMO | 99999000 | ❌ NO |
| Intercambio Hospital Sur | ESTUPES FARMACIA HOSPITAL SUR | 99999943 | ❌ NO |
| Mezclas Campanas | ESTUPES CAMPANAS | 99990010 | ❌ NO |
| Kit Lore | KIT LORE LORE | 0203 | ❌ NO |
| Reposición Athos | ATHOS (nombre de la unidad) | — | — |

### 7.5 Procedimiento de rotura (siempre 2 movimientos pareados)

Una rotura de medicamento **fuera** del SADE requiere exactamente estos dos movimientos en orden:
1. **DEVOLUCIÓN** al SADE de las unidades rotas (las que no se repusieron en el Athos de planta)
2. **DISPENSACIÓN** de esas mismas unidades al paciente ficticio 99000000 (Rotura en Farmacia)

Si falta uno de los dos, o las cantidades no coinciden → E10/E11, error grave de trazabilidad (ver sección 6).

### 7.6 Discrepancias en la reposición de Athos

Si al reponer un Athos la cantidad indicada no coincide con la real:
1. Cuadrar stock mediante el indicador de stock del Athos
2. Reponer de atrás hacia delante en cajones de máxima seguridad
3. Si sobra medicación → devolver al SADE a través del paciente Athos de la dispensación inicial

---

## 8. Estructura de los exports del SADE

### 8.1 Libro de Estupefacientes (export ATHOS SADE)

| Columna | Descripción |
|---|---|
| Estupefaciente | Nombre + Código V (ej: "FENTANILO 150 mcg/3mL amp (V07610)") |
| Fecha | Serial numérico de Excel (días desde 30/12/1899). Debe convertirse a fecha/hora legible |
| Número Vale | Identificador del movimiento. Puede ser vale oficial, "repo", "INTERCAMBIO", texto libre... |
| Tipo | Tipo de movimiento (Dispensación, Devolución, Reposición, Carga, Descarga, Retirada) |
| Proveedor | Proveedor o unidad origen/destino |
| Nota | Texto libre con observaciones |
| Cantidad | Unidades del movimiento |
| Unidad de Enfermería | Servicio hospitalario receptor |
| Cantidad Final | Stock acumulado tras el movimiento |

### 8.2 Histórico del SADE

| Columna | Descripción |
|---|---|
| Dispensador | Identificador del dispensador físico (ej: "D07 - ESTUPES") |
| Descripción | Descripción del movimiento |
| Medicamento | Nombre + Código V |
| Fecha | Serial numérico de Excel — misma conversión necesaria |
| Tipo | HistoricoDispensacion / HistoricoReposicion / HistoricoDevolucion |
| Suma | Signo del movimiento (+/−) |
| Cantidad | Unidades del movimiento |
| Cantidad Final | Stock global tras el movimiento |
| **Cantidad Final Dispensador** | Stock del cajón/dispensador específico tras el movimiento |
| Armario / Fila / Columna | Ubicación física exacta dentro del SADE |
| Sección | Sección del armario |
| Unidad de Enfermería | Servicio receptor |
| Servicio | Servicio clínico |
| **Usuario** | Farmacéutico/residente que realizó el movimiento |

**Clave de cruce entre Libro e Histórico:** `Código V + Fecha/hora exacta + Cantidad`

**Nota técnica — conversión de fechas Excel:**
```
fecha_legible = datetime(1899, 12, 30) + timedelta(days=serial_excel)
```
Ejemplo: serial `46203.32919` → 30/06/2026 07:54:02

---

## 9. Las 6 funcionalidades de EstupeFarma

### F1 — Inventario Semanal

**Propósito:** registrar el triple recuento semanal directamente en la app, eliminando el Excel manual.

**Lógica central:**

| Campo editable | Sistema | Descripción |
|---|---|---|
| ATHOS REAL | Físico | Recuento manual del farmacéutico. Fuente de verdad absoluta |
| ATHOS D07 | ATHOS SADE | Stock registrado en el ordenador del almacén |
| MAESTRO | DRAGO Farma | Stock registrado en el módulo Maestro |

Descuadres calculados automáticamente:
- `Real − D07` → indica error en ATHOS
- `D07 − Maestro` → indica error en DRAGO Farma

Código de color por fila:
- Sin descuadre → normal
- Descuadre 1–10 uds → amarillo ⚠️
- Descuadre >10 uds → rojo 🔴

**Aviso de reposición (nuevo):** al guardar, cada medicamento se compara automáticamente contra su MIN/MAX (Código V, sección 5). Si ATHOS REAL cae en rango "pedir a laboratorio" (MIN ≤ stock < MAX) o por debajo de MIN → se genera un **aviso al farmacéutico supervisor** con el medicamento y la acción recomendada.

Otros: selector Orales/Intravenosos, campo de fecha editable, botón "Guardar" → almacena en base de datos con fecha para consulta posterior.

---

### F2 — Inventarios Anteriores

**Propósito:** consultar cualquier inventario pasado guardado, en modo solo lectura.

- Selector de fechas con indicador visual del número de descuadres por semana
- Toggle Orales/Intravenosos
- Misma tabla e idéntico código de colores que F1
- Sin posibilidad de edición

---

### F3 — Detector de Alertas

**Propósito:** detectar movimientos sospechosos cruzando el Libro de Estupefacientes con el Histórico del SADE para un intervalo de fechas concreto.

**Flujo de 5 pasos:**

1. **Solicitud de archivos** — el usuario sube el Libro de Estupefacientes (.xlsx) y el Histórico del SADE (.xlsx), aclarando el intervalo de fechas de ambos (deben coincidir)
2. **Cruce de datos** — se cruzan por `Código V + Fecha/hora exacta + Cantidad`, eliminando información repetida y quedándose con lo complementario de cada archivo. Si un movimiento solo existe en uno de los dos, se incluye sin cruzar
3. **Tabla unificada** — se genera una tabla con toda la información combinada: medicamento (Código V), fecha/hora legible, tipo, cantidad, unidad, usuario, ubicación física, vale, cantidad final, notas
4. **Análisis automático** — el procesador lee la tabla y aplica los patrones de detección de la sección 6 (E01–E12)
5. **Resultado visual** — filas sospechosas resaltadas en amarillo (vigilar) o rojo (crítico) para valoración del farmacéutico

**Checklist de alertas críticas en Inicio (nuevo):** cada vez que se ejecuta el Detector, las alertas clasificadas como 🔴 críticas (E03, E05, E06, E07, E08, E10, E11) se importan automáticamente a un checklist en la pantalla de Inicio (ver sección 11). Las alertas 🟡 de vigilar permanecen solo en la vista de resultados de F3.

---

### F4 — Registro de Pedidos

**Propósito:** sustituir el Excel actual "Estupefacientes registro pedidos" por un registro estructurado dentro de la app.

**Ciclo de vida editable de un pedido:**

1. **Crear pedido** → estado inicial `Pendiente` (pedido activo, esperando llegada)
2. **Aviso de llegada** (farmacéutico de guardia, especialmente en turno de tarde) → deja constancia de que el pedido ha llegado físicamente. Esto dispara una **notificación al farmacéutico supervisor** (ver sección 11)
3. **Recepción formal** (farmacéutico supervisor) → edita el pedido y decide el desenlace:
   - **Recibido / Incidencia** → formulario con fecha de entrada, unidades recibidas, farmacéutico, incidencias opcionales. El sistema calcula automáticamente si queda como `Recibido` (todo cuadra) o `Incidencia` (unidades recibidas < pedidas o hay incidencias registradas)
   - **No servido** → toggle "No lo sirven / Pedido anulado" activado. **Campo de explicación de incidencia obligatorio** en este caso (no opcional) — debe describirse por qué no se sirvió

**Campos al crear:** vale, CN (Código Nacional — único uso permitido del CN en toda la app), estupefaciente (Código V + nombre), fecha de pedido, unidades pedidas, proveedor (COFARTE, COFARES, KERN PHARMA, BRAUN, FERRER FARMA, LAPHYSAN, MUNDIPHARMA, REIG JOFRE, Otro), incidencias previas

**Campos al recepcionar:** fecha de entrada, unidades recibidas, farmacéutico que recepciona, toggle "No lo sirven", incidencias (obligatorio si "No lo sirven" está activo)

**Notificación al farmacéutico supervisor (nuevo):** en el momento en que se marca la recepción de un pedido (independientemente del estado resultante), se genera una alerta visible dirigida al supervisor con: medicamento, unidades recibidas vs. pedidas, estado resultante, farmacéutico que recepcionó, fecha y hora.

---

### F5 — Registro de Medicamentos Caducados

**Propósito:** registro continuo de medicamentos caducados. Es la fuente de datos para la Declaración Semestral de Caducados (funcionalidad futura).

**Tabla** ordenada por fecha de caducidad (más reciente primero):

| Columna | Descripción |
|---|---|
| CN | Código Nacional |
| Nombre | Nombre del medicamento |
| Lote | Número de lote |
| Fecha de caducidad | Fecha en que caducó |
| Unidades caducadas | Cantidad retirada |

**Filtros:** buscador por nombre o CN, filtro por rango de fechas (para acotar semestre de declaración).

**Formulario:** panel deslizante con los cinco campos anteriores. Registro manual — no se cruza automáticamente con el Detector de Alertas (E12 solo señala, no confirma).

---

### F6 — Registro de Incidencias

**Propósito:** registro estructurado de movimientos anómalos con su documentación y resolución.

**Vista:** tarjetas de resumen (activas, pendientes de resolver, resueltas este mes, total historial) + lista de incidencias agrupada por estado.

**Estados:** `Pendiente` → `En revisión` → `Resuelta`

**Campos del formulario:**

| Campo | Tipo |
|---|---|
| Tipo de incidencia | Desplegable: Carga manual SADE / Descarga manual SADE / Entrada mal registrada / Movimiento por rotura incorrecto / Movimiento por caducidad incorrecto / Vale duplicado / Cantidad incorrecta / Otro |
| Medicamento comprometido | Código V + nombre |
| Fecha y hora | Datetime |
| Movimiento registrado | Texto libre — lo que apareció en el sistema |
| Cantidad afectada | Número |
| Sistema involucrado | ATHOS SADE / DRAGO Farma / Libro físico |
| Descripción del problema | Texto largo |
| Medida correctiva adoptada | Texto largo (puede rellenarse después) |
| Estado | Pendiente / En revisión / Resuelta |
| Farmacéutico que registra | Texto libre |

**Integración con F3 (nuevo):** desde el checklist de alertas críticas en Inicio, se puede convertir una alerta directamente en una incidencia, precargando el formulario con los datos ya conocidos del movimiento (código de error, medicamento, fecha/hora, cantidad).

---

## 10. Funcionalidades futuras (planificadas)

| Funcionalidad | Descripción | Dependencias |
|---|---|---|
| Configuración | Gestión del catálogo de medicamentos: Código V, nombre, grupo, mínimos y máximos de stock (ya definidos en sección 5) | — |
| Declaración de Caducados (semestral) | Genera el informe semestral a partir de los datos de F5 | F5 |
| Declaración Anual AEMPS | Notificación anual de movimientos a la Agencia Española de Medicamentos | F1, F4, F5 |

---

## 11. Pantalla de Inicio

**Tarjetas de estadísticas:**
- Días transcurridos desde el último inventario semanal (con fecha del último)
- Descuadres activos (desglosado por orales/IV)
- Medicamentos sin descuadre (de un total)
- Pedidos pendientes de recepcionar

**Ranking de medicamentos más dispensados** esta semana, con barras de progreso, separados por Oral/IV.

**Alertas del último inventario realizado** — descuadres más recientes con nivel (amarillo/rojo) y botón directo para lanzar nuevo inventario semanal.

**Checklist de alertas críticas pendientes (nuevo):**
- Se importa automáticamente al ejecutar el Detector de Alertas (F3) — solo alertas 🔴 críticas (E03, E05, E06, E07, E08, E10, E11)
- Cada ítem muestra: código de error, medicamento (Código V), fecha/hora, breve descripción
- Checkbox para marcar como revisada
- Opciones por ítem: "Convertir en Incidencia" (enlace a F6 con formulario precargado) o "Descartar" (si no era un error real)
- Contador visible: "X alertas críticas pendientes de revisar"
- Las alertas 🟡 de vigilar no entran en este checklist — quedan solo en la vista de resultados de F3

**Notificaciones de recepción de pedidos (nuevo):**
- Bloque "Pedidos llegados pendientes de recepción formal", visible especialmente para el rol de farmacéutico supervisor
- Cada notificación muestra: medicamento, vale, quién avisó de la llegada (farmacéutico de guardia) y a qué hora
- Botón directo "Recepcionar" que lleva al formulario de F4

**Avisos de reposición de stock (nuevo, derivado de F1 + sección 5.3):**
- Medicamentos que, tras el último inventario, cayeron en rango "pedir a laboratorio" o por debajo de mínimo — con la acción recomendada (laboratorio / cooperativa urgente)

---

## 12. Diseño y stack técnico

| Elemento | Decisión |
|---|---|
| Framework | React (JSX) |
| Iconos | lucide-react |
| Sidebar | Fondo índigo oscuro #1E1B4B con patrón de puntos radial |
| Formularios | Panel deslizante desde la derecha (drawer) |
| Alertas | Amarillo: descuadre 1–10 uds, movimiento de vigilar, o rango "pedir a laboratorio" / Rojo: descuadre >10 uds, error crítico, o stock bajo mínimo |
| Almacenamiento | Base de datos — inventarios y registros persisten entre sesiones |
| Datos de pacientes | Prohibidos en toda la interfaz, sin excepción |
| Identificador de medicamento | Código V únicamente (excepto en F4, donde también se usa CN) |

**Principio de desarrollo:** el prototipo solo se actualiza cuando el usuario lo solicita explícitamente. Definir o discutir una funcionalidad no implica tocar el código.

---

## 13. Glosario

| Término | Significado |
|---|---|
| ATHOS SADE | Sistema informático del armario automatizado de almacenamiento y dispensación |
| DRAGO Farma / FARMATOOLS | El mismo sistema de gestión hospitalaria de farmacia, referenciado con ambos nombres. No son dos aplicaciones distintas |
| Módulo Maestro | Módulo de DRAGO Farma con el catálogo de medicamentos y el stock del sistema |
| Módulo Gestión | Módulo de DRAGO Farma para corregir descuadres de stock, supervisado por farmacéutico |
| Código V | Identificador único de medicamento en la aplicación (ej: V07610) |
| CN | Código Nacional — uso exclusivo en Registro de Pedidos (F4) |
| Vale | Identificador de un movimiento en el libro |
| Repo / Reposición | Movimiento de medicamentos desde el almacén central a los Athos de planta |
| Unidad de enfermería | Servicio hospitalario receptor (EAP02, HEMO, EN03, UVI...) |
| Rotura | Medicamento inutilizado por rotura física durante su manipulación |
| Carga | Entrada manual de stock en el SADE — siempre requiere justificación |
| Descarga | Salida manual de stock del SADE — siempre sospechosa |
| Paciente ficticio | Código de sistema usado para salidas especiales que no van a un paciente real |
| Serial Excel | Formato interno de fecha en Excel: número de días desde el 30/12/1899 |
| MAX / MIN | Umbrales de stock por medicamento (Código V) que determinan si hay que pedir a laboratorio o a cooperativa urgente |
| AEMPS | Agencia Española de Medicamentos y Productos Sanitarios |
| HUNSC | Hospital Universitario Nuestra Señora de Candelaria |

# Pendientes — escalabilidad de emisión y descarga

> **Borrador.** Notas de trabajo, no un plan cerrado. Las prioridades pueden cambiar
> según lo que revele la siguiente medición.

Contexto: la emisión síncrona mantenía la conexión HTTP abierta hasta que la
transacción confirmaba en Celo. Bajo un pico de solicitudes eso agotaba el tiempo
del proxy, el cliente lo interpretaba como fallo y el usuario volvía a pedir su
certificado — generando duplicados. Ya está resuelto (ver commits de emisión
asíncrona). Este documento recoge lo que falta para sostener eventos de miles de
asistentes descargando a la vez.

---

## Estado actual (medido en producción)

| Fase | Antes | Ahora |
|------|-------|-------|
| Registro on-chain por credencial | 4.400 ms | **110 ms** |
| Emisión sostenida | 0,23/s | **9–11/s** |
| Generación de PDF (en frío) | 4,6/s | 10,2/s |
| Descarga de PDF (pre-generado) | 4,6/s | **114/s** |
| `GET /verify/:id` | 5,3 s | sin cambios |

El cuello ya no es el PDF sino el registro on-chain: cada credencial es una
transacción detrás de una única wallet emisora.

---

## Prioridad 1 — `registerBatch` en el contrato

**Problema.** `CredentialRegistry.register()` escribe una credencial por
transacción. Con una sola wallet, el envío se serializa y el techo queda en
~9–11 credenciales/s. Una cola de mil tarda ~100 s en drenarse; diez mil, más de
quince minutos.

**Idea.** Añadir `registerBatch(ids[], cids[], issuedAt[], validUntil[])` para
registrar N credenciales en una transacción. Con lotes de 100, el throughput sube
en dos órdenes de magnitud y el coste base de gas (~21k) se amortiza entre todas.

**Complicación.** El contrato desplegado no es actualizable. Implica desplegar un
V2 y que el pipeline de verificación consulte ambos, porque las credenciales
históricas siguen en el V1. Hay que decidir si el V2 mantiene también
`register()` individual para el camino síncrono.

**Antes de empezar:** medir Pinata (ver Prioridad 2). No tiene sentido subir el
techo de la cadena si el siguiente cuello aparece a los pocos segundos.

## Prioridad 2 — Medir IPFS bajo carga

Cada emisión sube el JSON de la credencial a Pinata, y esa llamada sigue en el
camino crítico del worker. No hemos medido su comportamiento con cientos de
subidas concurrentes ni conocemos los límites del plan contratado.

Es el candidato más probable a convertirse en el próximo cuello en cuanto se
resuelva el de la cadena. Medirlo es barato y evita invertir en el contrato V2
para toparse con otro muro.

Alternativas si resulta ser un límite: subir en lote, hacerlo asíncrono respecto
al sellado on-chain, o evaluar otro pinning service.

## Prioridad 3 — Cachear `GET /verify/:id`

La verificación consulta el contrato y IPFS en vivo en **cada** visita, y tarda
~5,3 s. Es la página que abre quien recibe un certificado, así que es la primera
impresión del producto.

**Idea.** Materializar el estado de verificación y revalidarlo en segundo plano,
sirviendo la respuesta cacheada. La prueba on-chain no cambia salvo revocación,
así que no hay motivo para recalcularla en cada carga.

## Prioridad 4 — Escalado horizontal

Generar miles de PDFs distintos es trabajo de CPU y se paraleliza bien entre
instancias. El worker ya está preparado: `claim_issuance_jobs` usa
`FOR UPDATE SKIP LOCKED`, así que varias instancias pueden drenar la cola sin
repartirse dos veces el mismo trabajo.

Falta dimensionarlo con datos reales de la infraestructura en lugar de estimar.

## Prioridad 5 — Prueba de carga a escala completa

Simular un pico realista contra el sistema completo, ya con emisión asíncrona,
midiendo las tres fases (encolar → sellar → descargar).

Las dos pruebas de carga anteriores destaparon fallos que nadie había previsto
—confirmaciones perdidas y un fallo de idempotencia por condición de carrera—,
así que conviene repetirlas tras cada cambio estructural.

---

## Deuda técnica

### Condición de carrera en `prepare_credential`

`database/functions/issue_credential.sql` resuelve `holders` y `contexts` con un
patrón *SELECT y si no existe INSERT*, sin restricción de unicidad. Bajo emisión
concurrente, varias transacciones no se ven entre sí e insertan filas duplicadas:
el mismo titular acaba fragmentado en varios registros, y un mismo evento puede
partirse en dos contextos, rompiendo la agrupación.

**Arreglo.** Índices únicos + `ON CONFLICT DO NOTHING`, siguiendo el mismo patrón
que ya usa `create_issuance_job`. Requiere consolidar antes los registros
fragmentados existentes.

### Credenciales huérfanas

Existen credenciales registradas on-chain sin fila correspondiente en la base de
datos, originadas en pruebas de carga previas al arreglo de confirmación. El
contrato es inmutable, así que no se pueden eliminar; haría falta un proceso de
reconciliación que las detecte y decida (reconstruir la fila o marcarlas como
descartadas).

Comprobación rápida: comparar `totalIssued()` del contrato con el número de filas
en `credentials`.

### Credenciales de prueba

Las pruebas de carga dejaron credenciales en producción. No se borran a propósito:
están registradas on-chain, y eliminar la fila las convertiría en huérfanas.
Conviene marcarlas de alguna forma para excluirlas de estadísticas.

---

## Notas de medición

Datos útiles para no repetir el trabajo de diagnóstico:

- **El proxy corta alrededor de los 25 s**, no en los 100 s del CDN. Se dedujo de
  un pico de 250 peticiones: todas las exitosas por debajo de 24,1 s y todas las
  fallidas en 25,4 s. `MAX_ISSUANCE_QUEUE` está calibrado contra ese límite.
- **`register()` consume ~131k de gas**, constante. De ahí el `gasLimit` explícito,
  que evita una estimación por transacción.
- **Celo produce bloques de ~1 s**, así que el intervalo de sondeo por defecto de
  ethers (4.000 ms) dominaba el tiempo de confirmación.
- **El poller de bloques de ethers pierde confirmaciones ocasionalmente** bajo
  concurrencia alta: la transacción se mina pero el evento nunca llega. Se
  recupera consultando el recibo directamente al agotarse el tiempo de espera.
- **Los fondos de plantilla pesan cientos de KB** y se descargaban en cada PDF.
  Ahora se cachean en memoria, con deduplicación de descargas en vuelo para que
  un pico con caché fría no dispare descargas simultáneas del mismo archivo.

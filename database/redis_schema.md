# Esquema Redis - Krono

## Propósito

Redis 7 cumple dos funciones críticas dentro de Krono:

1. Actuar como motor de concurrencia distribuida para el módulo **Flash-Fill**, evitando la doble asignación de un mismo cupo mediante bloqueos atómicos con `SETNX`.
2. Actuar como backend de colas para **BullMQ**, permitiendo el procesamiento asíncrono de notificaciones de WhatsApp hacia los cinco mejores candidatos seleccionados por Smart-Queue.

Este documento define las claves, estructuras, TTL, propósito operativo y configuración de colas Redis utilizadas por el sistema.

---

## Convenciones generales

### Prefijos

Todas las claves del sistema deben utilizar prefijos consistentes para facilitar la depuración, el monitoreo y la separación lógica:

- `subasta:` → estado operativo de una subasta activa
- `bloqueo:` → bloqueo distribuido de Flash-Fill
- `bull:` → claves internas administradas por BullMQ
- `token:` → referencias efímeras de apoyo a confirmaciones
- `metricas:` → contadores temporales opcionales de observabilidad

### Convención de identificadores

Se usará `id_subasta` como identificador principal de la subasta dentro de Redis, representado como UUID v4.

Ejemplo:

```txt
subasta:estado:9c0b7a33-4f8e-4b65-b1d2-f6a12b2f18aa
```

---

## 1. Claves de bloqueo distribuido de Flash-Fill

### 1.1. Bloqueo de adjudicación por subasta

**Clave:**
```txt
bloqueo:subasta:{id_subasta}
```

**Tipo:** string

**Comando principal:**
```txt
SET bloqueo:subasta:{id_subasta} {id_paciente} NX EX 120
```

**TTL:** 120 segundos

**Propósito:**
Garantizar que solo el primer candidato que confirme una subasta obtenga el cupo.  
Si Redis responde `OK`, el candidato adquiere el bloqueo y se transforma en ganador transaccional.  
Si Redis responde `null`, el cupo ya fue tomado por otro candidato.

**Valor almacenado:**
```txt
{id_paciente}
```

**Ejemplo:**
```txt
Clave: bloqueo:subasta:9c0b7a33-4f8e-4b65-b1d2-f6a12b2f18aa
Valor: PAT-0311
TTL: 120s
```

**Regla funcional:**
- Solo se crea una vez por subasta.
- No debe sobrescribirse.
- Su expiración natural evita bloqueos eternos ante fallos del proceso.

---

## 2. Estado de subasta activa

### 2.1. Estado general de la subasta

**Clave:**
```txt
subasta:estado:{id_subasta}
```

**Tipo:** hash

**TTL:** 180 segundos

**Propósito:**
Mantener en Redis el estado efímero de una subasta en curso para consultas rápidas por parte de Flash-Fill y Ghost-Messenger, sin depender exclusivamente de PostgreSQL.

**Campos del hash:**

| Campo | Tipo | Descripción |
|---|---|---|
| `id_subasta` | string | UUID de la subasta |
| `id_cita` | string | ID de la cita cancelada |
| `id_correlacion` | string | UUID de trazabilidad end-to-end |
| `id_transaccion` | string | UUID de transacción final |
| `estado` | string | `pendiente`, `activa`, `ganada`, `expirada`, `fallida` |
| `id_paciente_ganador` | string/null | Paciente ganador si existe |
| `id_participante_ganador` | string/null | Participante ganador si existe |
| `iniciada_en` | ISO8601 | Inicio de subasta |
| `expira_en` | ISO8601 | Expiración operativa |
| `cantidad_top_candidatos` | integer | Cantidad de candidatos notificados |
| `id_sistema_origen` | string | Identificador del sistema cliente |

**Ejemplo:**
```txt
HSET subasta:estado:9c0b7a33-4f8e-4b65-b1d2-f6a12b2f18aa \
id_subasta 9c0b7a33-4f8e-4b65-b1d2-f6a12b2f18aa \
id_cita 44444444-4444-4444-4444-444444444444 \
id_correlacion 2ab19d22-1d3f-4504-96a7-ccf6547da111 \
id_transaccion 4d31f6f8-6e6d-42f4-9d38-84319b8ab222 \
estado activa \
id_paciente_ganador "" \
id_participante_ganador "" \
iniciada_en 2026-05-18T01:00:00Z \
expira_en 2026-05-18T01:02:00Z \
cantidad_top_candidatos 5 \
id_sistema_origen CLINICA-PROVIDENCIA-01
EXPIRE subasta:estado:9c0b7a33-4f8e-4b65-b1d2-f6a12b2f18aa 180
```

---

### 2.2. Ranking efímero de candidatos notificados

**Clave:**
```txt
subasta:ranking:{id_subasta}
```

**Tipo:** sorted set

**TTL:** 180 segundos

**Propósito:**
Mantener un ranking efímero de los candidatos participantes según el `puntaje_prioridad`, útil para depuración, observabilidad y eventuales consultas rápidas.

**Score del sorted set:**
```txt
puntaje_prioridad
```

**Miembro:**
```txt
{id_paciente}
```

**Ejemplo:**
```txt
ZADD subasta:ranking:9c0b7a33-4f8e-4b65-b1d2-f6a12b2f18aa \
0.91250 PAT-0204 \
0.90500 PAT-0311 \
0.88125 PAT-0187 \
0.84250 PAT-0275 \
0.80100 PAT-0333
EXPIRE subasta:ranking:9c0b7a33-4f8e-4b65-b1d2-f6a12b2f18aa 180
```

---

### 2.3. Confirmaciones recibidas por subasta

**Clave:**
```txt
subasta:confirmaciones:{id_subasta}
```

**Tipo:** list

**TTL:** 180 segundos

**Propósito:**
Registrar el orden real de intentos de confirmación recibidos para análisis posterior de concurrencia.

**Valor de cada elemento:**
```json
{
  "id_paciente": "PAT-0311",
  "recibido_en": "2026-05-18T01:00:44.231Z",
  "resultado": "ganada"
}
```

**Operaciones típicas:**
- `LPUSH` para registrar intento
- `LRANGE` para análisis temporal

---

## 3. Claves efímeras relacionadas con tokens

### 3.1. Referencia rápida de token emitido

**Clave:**
```txt
token:confirmacion:{jti}
```

**Tipo:** hash

**TTL:** 120 segundos

**Propósito:**
Asociar de forma efímera un token JWT emitido con su contexto funcional, facilitando la depuración, la auditoría temporal y la expiración natural del mismo.

**Campos del hash:**

| Campo | Tipo | Descripción |
|---|---|---|
| `jti` | string | ID único del token |
| `id_subasta` | string | ID de subasta |
| `id_cita` | string | ID de cita |
| `id_paciente` | string | ID de paciente |
| `emitido_en` | ISO8601 | Fecha de emisión |
| `expira_en` | ISO8601 | Fecha de expiración |

**Nota:**  
El sistema no depende de Redis para validar JWT, porque la validación principal es criptográfica con HS256. Esta clave es complementaria y efímera.

---

## 4. BullMQ sobre Redis

BullMQ utiliza Redis como almacenamiento interno para colas, jobs, estados, locks y reintentos.  
Estas claves son creadas automáticamente por la librería y no deben manipularse manualmente, salvo con fines de monitoreo.

### 4.1. Nombre de la cola principal

**Variable de entorno:**
```env
BULLMQ_QUEUE_NAME=krono-notificaciones
```

**Prefijo real esperado en Redis:**
```txt
bull:krono-notificaciones:*
```

---

### 4.2. Principales claves internas de BullMQ

| Clave | Tipo | Propósito |
|---|---|---|
| `bull:krono-notificaciones:wait` | list | Jobs esperando ejecución |
| `bull:krono-notificaciones:active` | list | Jobs en procesamiento |
| `bull:krono-notificaciones:completed` | zset | Jobs completados |
| `bull:krono-notificaciones:failed` | zset | Jobs fallidos |
| `bull:krono-notificaciones:delayed` | zset | Jobs retrasados por backoff |
| `bull:krono-notificaciones:prioritized` | zset | Jobs con prioridad |
| `bull:krono-notificaciones:events` | stream | Eventos internos de la cola |
| `bull:krono-notificaciones:{jobId}` | hash | Payload y metadatos del job |
| `bull:krono-notificaciones:meta` | hash | Metadatos generales de la cola |
| `bull:krono-notificaciones:id` | string | Secuencia incremental de jobs |
| `bull:krono-notificaciones:stalled` | set | Jobs detectados como interrumpidos |

---

### 4.3. Payload del job de notificación

Cada job publicado por Core hacia Ghost-Messenger debe contener la información mínima necesaria para generar el mensaje y el enlace efímero.

**Ejemplo de payload:**

```json
{
  "id_subasta": "9c0b7a33-4f8e-4b65-b1d2-f6a12b2f18aa",
  "id_cita": "44444444-4444-4444-4444-444444444444",
  "id_correlacion": "2ab19d22-1d3f-4504-96a7-ccf6547da111",
  "id_transaccion": "4d31f6f8-6e6d-42f4-9d38-84319b8ab222",
  "id_paciente": "PAT-0311",
  "nombre_visible": "Jorge Ramírez",
  "telefono": "+56912345679",
  "nombre_doctor": "Dra. Valentina Riquelme",
  "especialidad": "Cardiología",
  "fecha_bloque": "2026-05-19",
  "hora_inicio": "10:00",
  "hora_fin": "10:30",
  "ubicacion": "Sala 3 - Piso 2"
}
```

---

### 4.4. Configuración de cola requerida

La configuración esperada para BullMQ debe seguir los lineamientos funcionales del proyecto: reintentos, backoff exponencial y tolerancia a fallos en notificación paralela. [file:1]

**Configuración recomendada:**

```js
{
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: 1000
  }
}
```

### Comportamiento esperado

- **Intento 1:** inmediato
- **Intento 2:** después de 1 segundo
- **Intento 3:** después de 3 segundos o comportamiento exponencial equivalente según BullMQ
- **Intento final fallido:** el job queda marcado como `failed`

> Nota: BullMQ usa su propia interpretación de backoff exponencial; el patrón exacto del proyecto para el retorno final fallido del webhook cliente es 1s, 3s y 9s, especialmente en Flash-Fill. [file:1]

---

## 5. Interacción entre Redis y Flash-Fill

### Flujo resumido

1. El candidato presiona su enlace efímero.
2. Flash-Fill valida el JWT HS256.
3. Flash-Fill intenta adquirir:
   ```txt
   SET bloqueo:subasta:{id_subasta} {id_paciente} NX EX 120
   ```
4. Si obtiene `OK`:
   - registra al ganador,
   - actualiza `subasta:estado:{id_subasta}`,
   - persiste el resultado en PostgreSQL.
5. Si no obtiene el bloqueo:
   - responde HTTP 409,
   - registra el intento en `subasta:confirmaciones:{id_subasta}`.

---

## 6. TTL definidos

| Clave | TTL | Justificación |
|---|---:|---|
| `bloqueo:subasta:{id_subasta}` | 120 s | Ventana de confirmación y prevención de colisiones |
| `subasta:estado:{id_subasta}` | 180 s | Persistencia efímera para consulta operativa posterior |
| `subasta:ranking:{id_subasta}` | 180 s | Trazabilidad corta durante el ciclo de subasta |
| `subasta:confirmaciones:{id_subasta}` | 180 s | Auditoría temporal de concurrencia |
| `token:confirmacion:{jti}` | 120 s | Vida útil del token JWT |

---

## 7. Reglas operativas

- Redis no reemplaza la persistencia oficial; PostgreSQL sigue siendo la fuente de verdad para auditoría y estado definitivo.
- Todas las claves efímeras deben expirar automáticamente.
- Ninguna clave de bloqueo debe eliminarse manualmente durante una subasta activa.
- Las claves `bull:*` pertenecen a BullMQ y no deben alterarse manualmente desde scripts de negocio.
- Los prefijos deben mantenerse estables para facilitar monitoreo, debugging y pruebas k6.

---

## 8. Riesgos controlados con este diseño

### Doble asignación

Se evita mediante `SET NX EX` sobre `bloqueo:subasta:{id_subasta}`, garantizando exclusión mutua atómica con Redis. [file:1]

### Pérdida de trazabilidad temporal

Se mitiga mediante hashes y listas efímeras de estado, ranking y confirmaciones. [file:1]

### Fallo de envío de notificaciones

BullMQ conserva jobs fallidos y maneja reintentos automáticos con backoff exponencial. [file:1]

### Saturación por concurrencia

Redis soporta operaciones atómicas de muy baja latencia, lo que lo vuelve adecuado para resolver simultaneidad de confirmaciones. [file:1]

---

## 9. Resumen de claves

| Clave | Tipo | Uso |
|---|---|---|
| `bloqueo:subasta:{id_subasta}` | string | Bloqueo distribuido del ganador |
| `subasta:estado:{id_subasta}` | hash | Estado efímero de la subasta |
| `subasta:ranking:{id_subasta}` | zset | Ranking de candidatos |
| `subasta:confirmaciones:{id_subasta}` | list | Registro de intentos |
| `token:confirmacion:{jti}` | hash | Referencia temporal del token |
| `bull:krono-notificaciones:*` | varios | Backend interno de BullMQ |

---
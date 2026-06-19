# Krono

Sistema cloud-native de recuperación automatizada de cupos cancelados en servicios de alta demanda, orientado a clínicas médicas, recintos deportivos y centros estéticos. Krono recibe eventos de cancelación vía webhook, calcula un Priority Score para los candidatos en lista de espera, notifica en paralelo a los cinco mejores candidatos mediante WhatsApp usando BullMQ sobre Redis, y asigna el cupo al primero que confirme utilizando bloqueos distribuidos con Redis SETNX para garantizar cero colisiones transaccionales, tal como está definido en el enfoque del proyecto y sus entregables académicos.

## Descripción general

Krono fue concebido como una solución reactiva orientada a eventos, diseñada para intervenir únicamente cuando ocurre una cancelación en un sistema externo de agendamiento, evitando reemplazar el software principal del cliente y actuando como una capa de inteligencia complementaria. El objetivo del sistema es reducir drásticamente el tiempo de reasignación de cupos, minimizar pérdidas económicas por espacios vacíos y eliminar el riesgo de doble asignación mediante una arquitectura de microservicios desacoplada.

El flujo principal del sistema comienza cuando un sistema externo envía un webhook de cancelación hacia Krono, luego el microservicio Core valida la API Key, parsea el payload, genera un correlation ID y calcula el Priority Score de cada candidato usando la fórmula ponderada definida para historial de asistencia, tiempo de espera y urgencia. Posteriormente, el sistema selecciona a los cinco mejores candidatos, publica el trabajo en BullMQ, Ghost-Messenger genera los enlaces efímeros de confirmación y Flash-Fill resuelve la asignación final con exclusión mutua basada en Redis SETNX.

## Fórmula Smart-Queue

La priorización de candidatos se realiza con la siguiente fórmula, definida como núcleo del sistema Smart-Queue en la documentación del proyecto:

```text
PriorityScore = (W1 × Historial_Asistencia) + (W2 × Tiempo_Espera) + (W3 × Urgencia)
```

Los pesos W1, W2 y W3 deben sumar 1.0, y serán configurables desde el panel de administración del frontend para ajustar el comportamiento del algoritmo según el tipo de servicio o criterio del cliente.

## Stack tecnológico

El stack del proyecto está definido de forma fija para mantener coherencia técnica y cumplir con la arquitectura planteada en la documentación del avance. Las tecnologías principales son las siguientes:

- Backend: Node.js v20 LTS con Express.js
- Cola de trabajos asíncronos: BullMQ sobre Redis
- Base de datos relacional: PostgreSQL 16
- Base de datos en memoria y broker de colas: Redis 7
- Frontend: React.js 18 con TailwindCSS y Vite
- Contenedores: Docker y Docker Compose
- CI/CD: GitHub Actions
- Pruebas de carga: k6 de Grafana
- Control de versiones: GitHub con GitFlow

## Arquitectura del sistema

La solución adopta una arquitectura de microservicios con enfoque event-driven, debido a que el problema requiere desacoplar la recepción del webhook, el cálculo de prioridad, el envío de notificaciones y la resolución concurrente del ganador. Esta decisión también está alineada con los patrones documentados en el avance, como Producer-Consumer, Distributed Lock, Retry Pattern, Dead Letter Queue y JWT Stateless Authentication.

Los principales componentes del sistema son los siguientes:

- **Core**: recibe webhooks, valida autenticación, calcula Priority Score, selecciona top 5 y publica jobs en BullMQ
- **Ghost-Messenger**: consume la cola BullMQ, genera JWT efímeros y envía notificaciones WhatsApp en paralelo
- **Flash-Fill**: procesa la confirmación del candidato, usa Redis SETNX para decidir un único ganador y emite el evento de retorno al sistema cliente
- **Frontend**: permite configurar ponderadores W1, W2, W3, visualizar métricas y ejecutar simulaciones del proceso

## Estructura del monorepo

La estructura base del repositorio Krono está organizada como un monorepo para agrupar microservicios, frontend, scripts, base de datos e infraestructura en un solo proyecto, lo que facilita la trazabilidad de entregables y la coordinación del equipo.

```text
krono/
├── services/
│   ├── core/
│   ├── flash-fill/
│   └── ghost-messenger/
├── frontend/
├── database/
│   ├── migrations/
│   └── seeds/
├── scripts/
│   ├── simulate-cancellation.js
│   └── stress-test.js
├── docker-compose.yml
├── docker-compose.test.yml
├── Makefile
├── infra/
├── tests/
├── docs/
└── .github/
    └── workflows/
```

Actualmente, en el repositorio ya existen las carpetas `.github`, `frontend`, `infra`, `scripts`, `services`, `docs` y `tests`, y dentro de `services` ya están creados los directorios `core`, `flash-fill` y `ghost-messenger`, lo que deja preparada la base para continuar con las siguientes prioridades del proyecto .

## Requisitos previos

Para levantar Krono en ambiente local se requiere tener instaladas las herramientas base del stack, en coherencia con la configuración de entorno de pruebas exigida por la evaluación parcial y con el stack tecnológico definido en el avance:

- Node.js v20 LTS
- Docker Desktop
- Git 
- PostgreSQL 16, si se desea ejecutar fuera de contenedores
- Redis 7, si se desea ejecutar fuera de contenedores
- Make, opcional para simplificar comandos operativos 

## Instalación del proyecto

Clona el repositorio oficial y entra al directorio del proyecto:

```bash
git clone https://github.com/KevinHR2209/Krono.git
cd Krono
```

Si trabajarás con ramas GitFlow, utiliza `develop` como rama base para integración continua, dejando `main` para producción estable y `qa` para validación .

## Modelo GitFlow

El proyecto usa GitFlow como estrategia de versionado y trabajo colaborativo, con ramas separadas para producción, integración, calidad e infraestructura, tal como está definido en el alcance del avance.

- `main`: producción estable 
- `develop`: integración continua 
- `qa`: pruebas y validación 
- `devops`: infraestructura, Docker y CI/CD 
- `feature/*`: desarrollo de funcionalidades específicas
- `hotfix/*`: correcciones urgentes sobre producción

Flujo recomendado:

```text
feature/* → develop → qa → main
```

## Ejecución con Docker Compose

La estrategia del proyecto considera Docker Compose como base para replicar un entorno local cercano al de producción, uno de los puntos exigidos explícitamente por la pauta de evaluación al solicitar ambiente de pruebas replicable y correctamente documentado .

Para levantar la infraestructura base del proyecto:

```bash
docker compose up -d
```

Para revisar el estado de los contenedores:

```bash
docker compose ps
```

Para ver logs en tiempo real:

```bash
docker compose logs -f
```

Cuando estén implementados los servicios y configurados los archivos definitivos, `docker-compose.yml` levantará PostgreSQL, Redis, Core, Flash-Fill y Ghost-Messenger con un solo comando, mientras que `docker-compose.test.yml` extenderá ese entorno para ejecutar migraciones y seeds automáticamente.

## Ejecución por servicios en desarrollo

Si deseas trabajar de forma incremental, puedes levantar primero la infraestructura y luego correr cada microservicio por separado, lo que calza bien con el enfoque iterativo e incremental documentado para Krono.

Primero levanta PostgreSQL y Redis:

```bash
docker compose up postgres redis -d
```

Luego ejecuta cada servicio en terminales separadas.

### Core

```bash
cd services/core
npm install
npm run dev
```

### Flash-Fill

```bash
cd services/flash-fill
npm install
npm run dev
```

### Ghost-Messenger

```bash
cd services/ghost-messenger
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Comandos operativos esperados

El proyecto contempla un `Makefile` con comandos operativos que servirán para levantar, detener, migrar, sembrar datos, simular cancelaciones y ejecutar pruebas de estrés, lo que ayuda directamente a cumplir el criterio de configuración de ambiente de pruebas y validación operativa exigido por la rúbrica.

Los comandos definidos para el proyecto serán:

```bash
make up
make down
make migrate
make seed
make simulate
make test-stress
make logs
```

## Microservicios y responsabilidades

### Core

Este microservicio será el punto de entrada seguro del sistema y aplicará el patrón API Gateway, recibiendo el webhook `POST /api/v1/webhook/cancellation`, validando la API Key, verificando el schema del payload, calculando el Priority Score y encolando el trabajo en BullMQ.

### Flash-Fill

Este microservicio expondrá el endpoint `GET /api/v1/confirm/:token` y será el responsable de validar el JWT efímero, intentar adquirir el bloqueo distribuido con Redis SETNX, registrar el ganador, resolver la subasta y retornar el evento al sistema cliente con política de reintentos y fallback a Dead Letter Queue.

### Ghost-Messenger

Este servicio actuará como worker BullMQ, consumirá jobs de notificación, generará enlaces efímeros por candidato, construirá mensajes personalizados de WhatsApp y gestionará reintentos con backoff exponencial en caso de error.

## Requisitos funcionales clave

Según la definición del proyecto, los requerimientos funcionales prioritarios incluyen la recepción y validación de webhooks, cálculo de Priority Score, encolado de jobs en BullMQ, generación de JWT efímeros, control de concurrencia con Redis SETNX, emisión del evento de retorno y panel de administración con configuración de ponderadores.

Entre los requerimientos no funcionales más importantes se encuentran procesar 500 peticiones simultáneas con 0 colisiones, latencia de encolado bajo 50 ms, autenticación segura mediante API Key y JWT de 120 segundos, y trazabilidad completa mediante Correlation ID.

## Calidad, pruebas y seguridad

La pauta de evaluación exige evidenciar ambiente de pruebas, validación, verificación, documentación técnica y desarrollo funcional con buenas prácticas, por lo que Krono incorpora desde su diseño elementos orientados a calidad y seguridad . Entre ellos destacan el uso de Docker para homogeneidad entre entornos, Redis SETNX para exclusión mutua, BullMQ con retries y backoff exponencial, Dead Letter Queue en PostgreSQL, JWT HS256 de corta duración y Correlation ID UUID v4 para observabilidad end-to-end.

Además, el proyecto contempla una prueba de estrés con k6 de 500 usuarios virtuales concurrentes sobre el mismo enlace efímero, donde el resultado esperado es exactamente 1 respuesta HTTP 200 y 499 respuestas HTTP 409, validando así la ausencia de colisiones transaccionales.

## Integrantes

- Kevin Henríquez — Líder de Proyecto / Especialista BD
- Diego López — Desarrollador Backend
- Christian Pérez — Analista QA / Frontend

## Contexto académico

Este repositorio corresponde al proyecto Krono de la asignatura Taller Aplicado de Programación TPY1101, sección 002D, y su construcción debe apoyar directamente los indicadores IL2.1, IL2.2 e IL2.3 de la Evaluación Parcial N.° 2, especialmente en documentación técnica, configuración de ambiente de pruebas y desarrollo de una solución funcional, de calidad y segura .

Duoc UC — Taller Aplicado de Programación (TPY1101) — Sección 002D — 2024
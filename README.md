# Krono

> Sistema cloud-native de recuperación automatizada de cupos cancelados en servicios de alta demanda.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Node.js v20 LTS + Express.js |
| Cola de jobs | BullMQ (sobre Redis) |
| Base de datos relacional | PostgreSQL 16 |
| Base de datos en memoria | Redis 7 |
| Frontend | React.js 18 + TailwindCSS + Vite |
| Contenedores | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Pruebas de carga | k6 (Grafana) |
| Control de versiones | GitHub (GitFlow) |

## Módulos

- **Core** — Recepción de webhooks, validación de API Key, cálculo de Priority Score, encolado BullMQ
- **Ghost-Messenger** — Workers BullMQ, generación de JWT HS256, despacho de notificaciones WhatsApp
- **Flash-Fill** — Confirmación de candidatos, control de concurrencia SETNX, Dead Letter Queue
- **Frontend** — Panel de administración React.js + WebSockets

## Fórmula Smart-Queue

```
PriorityScore = (W₁ × Historial_Asistencia) + (W₂ × Tiempo_Espera) + (W₃ × Urgencia)
```

Donde W₁ + W₂ + W₃ = 1.0 (configurables desde el panel de administración).

## Modelo GitFlow

| Rama | Propósito |
|---|---|
| `main` | Producción estable |
| `develop` | Integración continua |
| `qa` | Pruebas y validación |
| `devops` | Infraestructura, Docker, CI/CD |
| `feature/*` | Funcionalidades específicas |
| `hotfix/*` | Correcciones urgentes en producción |

## Estructura del monorepo

```
krono/
├── services/
│   ├── core/          # Microservicio Core (webhook + Smart-Queue)
│   ├── ghost-messenger/  # Microservicio Ghost-Messenger (BullMQ workers)
│   └── flash-fill/    # Microservicio Flash-Fill (concurrencia Redis)
├── frontend/          # SPA React.js + TailwindCSS
├── infra/             # Docker Compose, scripts AWS, IaC
├── scripts/           # Simulación de cancelación, utilidades
├── tests/             # Scripts k6 de pruebas de estrés
├── docs/              # Diagramas, OpenAPI spec, documentación
└── .github/           # GitHub Actions workflows, PR templates
```

## Inicio rápido (desarrollo local)

```bash
# 1. Clonar el repositorio
git clone https://github.com/KevinHR2209/Krono.git
cd Krono

# 2. Levantar toda la infraestructura local
cd infra
docker compose up -d

# 3. Verificar servicios
docker compose ps
```

## Integrantes

| Nombre | Rol |
|---|---|
| Kevin Henríquez | Líder de Proyecto / Especialista BD |
| Diego López | Desarrollador Backend |
| Christian Pérez | Analista QA / Frontend |

---

Duoc UC — Taller Aplicado de Programación (TPY1101) — Sección 002D — 2024

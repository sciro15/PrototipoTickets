# Sistema de Gestión de Tickets — Soluciones Andinas S.A.S.

## Descripción

Sistema web para centralizar las solicitudes de soporte técnico de Soluciones Andinas S.A.S. Permite registrar incidentes, asignar responsables, consultar el estado de cada solicitud y mantener un historial de los cambios realizados.

La aplicación está organizada en módulos y separa la interfaz de usuario, la lógica de negocio y la persistencia de datos, facilitando su mantenimiento y evolución.

## Tecnologías

| Componente | Tecnología |
|---|---|
| Frontend | Angular 17 |
| Backend | NestJS 10 |
| Lenguaje | TypeScript |
| Base de datos | MySQL 8 |
| ORM | Prisma 5 |
| Autenticación | JWT y bcryptjs |
| Contenedores | Docker y Docker Compose |
| Servidor web | Nginx |
| Pruebas | Jest, Supertest, Jasmine y Karma |

## Funcionalidades

- Inicio de sesión mediante JWT.
- Control de acceso según el rol del usuario.
- Registro, consulta, edición y filtrado de tickets.
- Asignación de responsables de soporte.
- Gestión de prioridades y estados.
- Historial de cambios de estado.
- Administración de usuarios.
- Dashboard con indicadores y tickets recientes.
- Validación de formularios y manejo de errores.
- Interfaz adaptable a diferentes tamaños de pantalla.

### Roles del sistema

- **ADMIN:** administra usuarios y tiene acceso a la gestión de tickets.
- **SOPORTE:** consulta, asigna y actualiza tickets.
- **SOLICITANTE:** registra solicitudes y consulta sus propios tickets.

## Arquitectura

El sistema utiliza una arquitectura modular con tres componentes principales:

- **Frontend:** aplicación Angular responsable de la interfaz, navegación y comunicación con la API.
- **Backend:** API REST desarrollada en NestJS, encargada de las reglas de negocio, autenticación, autorización y validaciones.
- **Base de datos:** MySQL, administrada mediante Prisma ORM.

Docker Compose permite ejecutar los servicios de forma conjunta, mientras que Nginx sirve la aplicación web y redirige las solicitudes de la API.

## Estructura del proyecto

```text
sistema-gestion-tickets/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── auth/
│   │   ├── tickets/
│   │   ├── users/
│   │   ├── dashboard/
│   │   ├── prisma/
│   │   └── common/
│   └── test/
├── frontend/
│   └── src/app/
│       ├── core/
│       ├── shared/
│       └── features/
├── docs/
│   ├── arquitectura.md
│   ├── gestion-equipo.md
│   └── diagramas/
├── docker-compose.yml
├── .env.example
└── README.md
```

## Requisitos

- Git.
- Docker Desktop en Windows o Docker Engine y Docker Compose v2 en Linux.
- Node.js 20 o superior y npm, únicamente si se desea ejecutar los servicios fuera de Docker.

## Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd sistema-gestion-tickets
```

### 2. Configurar las variables de entorno

En Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

En Linux o macOS:

```bash
cp .env.example .env
```

Revisa el archivo `.env` y configura las contraseñas de MySQL y la clave `JWT_SECRET`. No utilices las credenciales de ejemplo en un entorno real.

### 3. Iniciar los servicios

```bash
docker compose up -d --build
```

Verifica el estado de los contenedores:

```bash
docker compose ps
```

El backend aplica las migraciones y ejecuta los datos iniciales según la configuración del proyecto.

### 4. Acceder a la aplicación

- Aplicación web: http://localhost:8080
- API REST: http://localhost:3000/api/v1
- Estado del backend: http://localhost:3000/api/v1/health

### Comandos útiles

| Acción | Comando |
|---|---|
| Consultar logs | `docker compose logs -f` |
| Ver logs del backend | `docker compose logs -f backend` |
| Reiniciar servicios | `docker compose restart` |
| Reconstruir servicios | `docker compose up -d --build` |
| Detener servicios | `docker compose down` |
| Eliminar también los datos de MySQL | `docker compose down -v` |

**Importante:** `docker compose down -v` elimina el volumen de la base de datos. Utilízalo únicamente cuando quieras borrar los datos almacenados.

## Variables de entorno

Las principales variables se configuran en `.env`:

| Variable | Descripción |
|---|---|
| `MYSQL_ROOT_PASSWORD` | Contraseña administrativa de MySQL. |
| `MYSQL_DATABASE` | Nombre de la base de datos. |
| `MYSQL_USER` | Usuario de conexión de la aplicación. |
| `MYSQL_PASSWORD` | Contraseña de conexión de la aplicación. |
| `FRONTEND_PORT` | Puerto de acceso a la aplicación web. |
| `BACKEND_PORT` | Puerto de acceso directo a la API. |
| `JWT_SECRET` | Clave para firmar los tokens de autenticación. |
| `JWT_EXPIRES_IN` | Tiempo de expiración del token. |
| `CORS_ORIGIN` | Origen permitido para las solicitudes del frontend. |
| `RUN_SEED` | Indica si se ejecutan los datos iniciales al iniciar el backend. |
| `SEED_PASSWORD` | Contraseña de las cuentas de demostración. |

Consulta `.env.example` para conocer los valores y las variables adicionales utilizadas por Docker Compose.

## API REST

La API utiliza el prefijo `/api/v1`. Excepto las rutas públicas, las solicitudes requieren el encabezado `Authorization: Bearer <token>`.

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/auth/login` | Iniciar sesión. |
| GET | `/auth/me` | Consultar el usuario autenticado. |
| GET | `/tickets` | Listar y filtrar tickets. |
| POST | `/tickets` | Crear un ticket. |
| GET | `/tickets/:id` | Consultar el detalle de un ticket. |
| PATCH | `/tickets/:id` | Editar un ticket. |
| PATCH | `/tickets/:id/assign` | Asignar responsable. |
| PATCH | `/tickets/:id/status` | Cambiar el estado. |
| GET | `/tickets/:id/history` | Consultar el historial. |
| GET | `/users` | Consultar usuarios. |
| POST | `/users` | Crear un usuario. |
| GET | `/dashboard/summary` | Consultar indicadores. |
| GET | `/health` | Verificar el estado del servicio. |

Los permisos disponibles dependen del rol autenticado. Los filtros de tickets permiten consultar información por estado, prioridad y texto de búsqueda.

## Modelo de datos

El sistema utiliza tres entidades principales:

- **User:** almacena los datos de los usuarios, sus credenciales cifradas mediante hash y su rol.
- **Ticket:** contiene la solicitud, descripción, prioridad, estado, solicitante y responsable.
- **TicketHistory:** registra los cambios de estado, la fecha y el usuario que realizó la operación.

Las relaciones y restricciones se definen en `backend/prisma/schema.prisma`. Los cambios en la estructura de la base de datos se gestionan mediante migraciones versionadas.

## Reglas de negocio

- Los tickets se crean con estado `ABIERTO`.
- Los cambios de estado deben respetar las transiciones permitidas.
- Cada cambio de estado genera un registro de historial dentro de una transacción.
- Los solicitantes solo pueden consultar sus propios tickets y editarlos mientras estén abiertos.
- Los usuarios de soporte pueden gestionar estados y asignaciones.
- La administración de usuarios está reservada al rol `ADMIN`.

## Pruebas

### Backend

```bash
cd backend
npm install
npx prisma generate
npm test
```

### Frontend

```bash
cd frontend
npm install
npm run test:ci
```

Las pruebas cubren funcionalidades de autenticación, permisos, gestión de tickets, validaciones y componentes principales. Para conocer los resultados, ejecuta los comandos en el entorno local.

## Documentación de arquitectura

En la carpeta `docs/` se encuentra la documentación complementaria:

- `arquitectura.md`: descripción de la arquitectura y sus decisiones principales.
- `gestion-equipo.md`: organización del trabajo y responsabilidades.
- `diagramas/diagramas.md`: diagramas UML de componentes, clases, despliegue, entidades, estados y secuencias.

## Integrantes del equipo

| Integrante | Responsabilidad |
|---|---|
| Sebastian Ciro Franco | Backend, modelo de datos, API y pruebas del servidor. |
| Edwin Arley Gomez Mendez | Frontend, navegación, formularios e integración con la API. |

Ambos integrantes participan en las decisiones de arquitectura, integración, documentación y validación del sistema.

## Mejoras futuras

- Recuperación de contraseña y autenticación multifactor.
- Notificaciones por correo electrónico.
- Archivos adjuntos en los tickets.
- Indicadores de tiempos de atención y resolución.
- Gestión de acuerdos de nivel de servicio (SLA).

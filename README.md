# TicketGo Backend Foundation

Production-ready NestJS backend foundation for TicketGo powered by TypeScript, PostgreSQL, and Prisma ORM.

## Architecture

The backend follows a modular, layered architecture:
```
Controller (HTTP / DTO validation) 
   ↓ 
Service (Business logic / Transactions) 
   ↓ 
Prisma Service (Database queries / PostgreSQL)
```

## Features

- **Environment Configuration**: `@nestjs/config` type-safe configuration.
- **Database & ORM**: PostgreSQL integration via Prisma Client with lifecycle hooks and connection pooling.
- **Global Validation**: `ValidationPipe` with payload whitelisting and transformation.
- **Global Exception Filter**: Standardized JSON error response format.
- **Response Transformation**: Uniform response envelopes with timestamps and status codes.
- **Health Check**: `GET /api/health` testing live database connectivity and system status.
- **CORS Support**: Configured for Next.js frontend (`http://localhost:3000`).
- **Global Prefix**: All API endpoints mounted under `/api`.

## Getting Started

### 1. Environment Setup

Copy `.env.example` to `.env` and configure your database credentials:

```bash
cp .env.example .env
```

Ensure PostgreSQL is running and update `DATABASE_URL` in `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticketgo_db?schema=public"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. Database Migrations

```bash
npx prisma migrate dev --name init
```

### 5. Run Server

```bash
# Development (with hot reload)
npm run start:dev

# Production build & start
npm run build
npm run start:prod
```

### 6. Verify Health Check

```bash
curl http://localhost:5000/api/health
```

Expected Response:
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "ok",
    "timestamp": "2026-09-15T15:00:00.000Z",
    "uptimeSeconds": 12,
    "environment": "development",
    "database": {
      "status": "connected",
      "responseTimeMs": 4
    }
  },
  "timestamp": "2026-09-15T15:00:00.000Z"
}
```

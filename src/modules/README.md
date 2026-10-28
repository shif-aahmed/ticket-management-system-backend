# TicketGo Backend Modules Architecture

This directory is designated for the upcoming TicketGo business modules:

- **auth/**: Authentication, JWT strategies, password hashing, and session management.
- **users/**: User profiles, roles (Admin, Agent, Customer), preferences.
- **tickets/**: Core ticketing, status workflows, priorities, SLA tracking.
- **teams/**: Team assignments, routing rules, member associations.
- **categories/**: Ticket categories and tags hierarchy.
- **notifications/**: Email/in-app notification delivery and queues.
- **knowledge-base/**: FAQs, articles, search, and category taxonomy.
- **reports/**: Analytics, SLA metrics, volume trends, and team performance summaries.

## Architectural Convention

Every business module must follow strict 3-tier separation of concerns:

```
[Module Name]/
├── dto/                    # Request/response validation transfer objects
│   ├── create-[item].dto.ts
│   └── update-[item].dto.ts
├── [module].controller.ts  # Route handling, input validation, HTTP status
├── [module].service.ts     # Business logic, transactions, authorization checks
└── [module].module.ts      # Dependency injection configuration
```

### Layer Responsibility Rules

1. **Controller**:
   - Handles HTTP routing, parameters, queries, and headers.
   - Delegates business logic immediately to the Service layer.
   - Avoids calling `PrismaService` directly.
2. **Service**:
   - Contains all domain rules, calculations, and data transformations.
   - Injects `PrismaService` to execute database queries and transactions.
3. **Database / Prisma**:
   - Access is mediated exclusively through injected `PrismaService`.

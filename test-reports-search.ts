import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';
import { HttpExceptionFilter } from './src/common/filters/http-exception.filter';
import { TransformInterceptor } from './src/common/interceptors/transform.interceptor';
import {
  Role,
  UserStatus,
  CategoryStatus,
  TicketStatus,
  TicketPriority,
  TicketType,
  User,
  Team,
  Category,
  KnowledgeArticle,
  Ticket,
  TicketActivity,
} from '@prisma/client';

async function runReportsAndSearchVerification() {
  console.log('===============================================================');
  console.log('      TICKETGO REPORTS & GLOBAL SEARCH VERIFICATION SUITE      ');
  console.log('===============================================================\n');

  const defaultPassword = 'TicketGo2024!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const mockUsers: Record<string, User> = {
    'alex.morgan@ticketgo.io': {
      id: 'usr-admin-001',
      email: 'alex.morgan@ticketgo.io',
      name: 'Alex Morgan',
      passwordHash,
      role: Role.administrator,
      status: UserStatus.active,
      department: 'IT & Security',
      avatarUrl: null,
      phone: '+1 (555) 234-5678',
      title: 'Head of Infrastructure',
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'liam.chen@ticketgo.io': {
      id: 'usr-agent-002',
      email: 'liam.chen@ticketgo.io',
      name: 'Liam Chen',
      passwordHash,
      role: Role.agent,
      status: UserStatus.active,
      department: 'Customer Support',
      avatarUrl: null,
      phone: '+1 (555) 345-6789',
      title: 'Senior Support Specialist',
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'marcus.vance@ticketgo.io': {
      id: 'usr-employee-003',
      email: 'marcus.vance@ticketgo.io',
      name: 'Marcus Vance',
      passwordHash,
      role: Role.employee,
      status: UserStatus.active,
      department: 'Engineering',
      avatarUrl: null,
      phone: '+1 (555) 456-7890',
      title: 'Full Stack Engineer',
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockCategories: Map<string, Category> = new Map([
    [
      'cat-001',
      {
        id: 'cat-001',
        name: 'Technical Support',
        description: 'Hardware, VPN, and system support',
        status: CategoryStatus.active,
        departmentDefault: 'IT & Security',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    [
      'cat-002',
      {
        id: 'cat-002',
        name: 'Software Development',
        description: 'Backend APIs, React components',
        status: CategoryStatus.active,
        departmentDefault: 'Engineering',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  ]);

  const mockTeams: Map<string, Team> = new Map([
    [
      'team-001',
      {
        id: 'team-001',
        name: 'DevOps & SRE',
        description: 'Cloud infrastructure and Kubernetes',
        department: 'Engineering',
        teamLeadId: 'usr-admin-001',
        colorClass: 'text-[#064747]',
        bgClass: 'bg-[#E6F3EF]',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  ]);

  const mockArticles: Map<string, KnowledgeArticle> = new Map([
    [
      'art-001',
      {
        id: 'art-001',
        title: 'How to Connect to Corporate WireGuard VPN',
        category: 'Network & Security',
        excerpt: 'Quick setup guide for developers.',
        content: 'Step-by-step instructions on importing conf files...',
        keywords: ['wireguard', 'vpn', 'security'],
        readingTime: '3 min',
        viewCount: 42,
        isPublished: true,
        authorId: 'usr-agent-002',
        relatedArticleIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    [
      'art-002',
      {
        id: 'art-002',
        title: 'Draft Internal Security Architecture',
        category: 'Internal',
        excerpt: 'Unpublished draft.',
        content: 'Sensitive draft content...',
        keywords: ['draft', 'security'],
        readingTime: '5 min',
        viewCount: 0,
        isPublished: false,
        authorId: 'usr-admin-001',
        relatedArticleIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  ]);

  const now = new Date();
  const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const overdueDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago (overdue)
  const futureDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // in 3 days

  const mockTickets: Map<string, any> = new Map([
    [
      'tkt-001',
      {
        id: 'tkt-001',
        ticketNumber: 1001,
        code: '#TKT-1001',
        subject: 'VPN Connection drops intermittently',
        description: 'WireGuard tunnel disconnects every 15 minutes',
        type: TicketType.incident,
        status: TicketStatus.open,
        priority: TicketPriority.high,
        department: 'IT & Security',
        project: 'Infra',
        dueDate: overdueDate,
        requesterId: 'usr-employee-003',
        assigneeId: 'usr-agent-002',
        categoryId: 'cat-001',
        createdAt: pastDate,
        updatedAt: now,
      },
    ],
    [
      'tkt-002',
      {
        id: 'tkt-002',
        ticketNumber: 1002,
        code: '#TKT-1002',
        subject: 'Database latency spike on primary replica',
        description: 'PostgreSQL connection pool exhausted',
        type: TicketType.bug,
        status: TicketStatus.in_progress,
        priority: TicketPriority.critical,
        department: 'Engineering',
        project: 'Core',
        dueDate: futureDate,
        requesterId: 'usr-employee-003',
        assigneeId: 'usr-agent-002',
        categoryId: 'cat-002',
        createdAt: pastDate,
        updatedAt: now,
      },
    ],
    [
      'tkt-003',
      {
        id: 'tkt-003',
        ticketNumber: 1003,
        code: '#TKT-1003',
        subject: 'Admin internal audit review',
        description: 'Confidential executive IT security assessment',
        type: TicketType.task,
        status: TicketStatus.resolved,
        priority: TicketPriority.medium,
        department: 'IT & Security',
        project: 'Governance',
        dueDate: pastDate,
        requesterId: 'usr-admin-001',
        assigneeId: 'usr-admin-001',
        categoryId: 'cat-001',
        createdAt: pastDate,
        updatedAt: now,
      },
    ],
  ]);

  const mockActivities: TicketActivity[] = [
    {
      id: 'act-001',
      ticketId: 'tkt-001',
      actorId: 'usr-agent-002',
      type: 'status_updated',
      description: 'Status changed to open',
      comment: null,
      metadata: null,
      createdAt: now,
    },
  ];

  function filterTicketList(where: any): any[] {
    let list = Array.from(mockTickets.values());
    if (!where) return list;

    if (where.OR) {
      list = list.filter((t) =>
        where.OR.some((cond: any) => {
          if (cond.requesterId && t.requesterId === cond.requesterId) return true;
          if (cond.assigneeId && t.assigneeId === cond.assigneeId) return true;
          if (cond.code?.contains && t.code.toLowerCase().includes(cond.code.contains.toLowerCase())) return true;
          if (cond.subject?.contains && t.subject.toLowerCase().includes(cond.subject.contains.toLowerCase())) return true;
          if (cond.description?.contains && t.description?.toLowerCase().includes(cond.description.contains.toLowerCase())) return true;
          if (cond.department?.contains && t.department?.toLowerCase().includes(cond.department.contains.toLowerCase())) return true;
          return false;
        }),
      );
    }

    if (where.AND) {
      for (const andCond of where.AND) {
        if (andCond.OR) {
          list = list.filter((t) =>
            andCond.OR.some((subCond: any) => {
              if (subCond.requesterId && t.requesterId === subCond.requesterId) return true;
              if (subCond.assigneeId && t.assigneeId === subCond.assigneeId) return true;
              if (subCond.code?.contains && t.code.toLowerCase().includes(subCond.code.contains.toLowerCase())) return true;
              if (subCond.subject?.contains && t.subject.toLowerCase().includes(subCond.subject.contains.toLowerCase())) return true;
              if (subCond.description?.contains && t.description?.toLowerCase().includes(subCond.description.contains.toLowerCase())) return true;
              if (subCond.department?.contains && t.department?.toLowerCase().includes(subCond.department.contains.toLowerCase())) return true;
              return false;
            }),
          );
        }
      }
    }

    if (where.status) {
      if (where.status.in) {
        list = list.filter((t) => where.status.in.includes(t.status));
      } else if (where.status.notIn) {
        list = list.filter((t) => !where.status.notIn.includes(t.status));
      } else {
        list = list.filter((t) => t.status === where.status);
      }
    }

    if (where.priority) {
      list = list.filter((t) => t.priority === where.priority);
    }

    if (where.type) {
      list = list.filter((t) => t.type === where.type);
    }

    if (where.department?.equals) {
      list = list.filter((t) => t.department?.toLowerCase() === where.department.equals.toLowerCase());
    }

    if (where.assigneeId) {
      list = list.filter((t) => t.assigneeId === where.assigneeId);
    }

    if (where.dueDate?.lt) {
      list = list.filter((t) => t.dueDate && t.dueDate < where.dueDate.lt);
    }

    if (where.createdAt?.gte) {
      list = list.filter((t) => t.createdAt >= where.createdAt.gte);
    }

    return list;
  }

  const mockPrismaService = {
    user: {
      findUnique: async (args: any) => {
        if (args.where?.id) return Object.values(mockUsers).find((u) => u.id === args.where.id) || null;
        if (args.where?.email) return mockUsers[args.where.email.toLowerCase().trim()] || null;
        return null;
      },
      findMany: async (args: any) => {
        let list = Object.values(mockUsers);
        if (args?.where?.role?.in) {
          list = list.filter((u) => args.where.role.in.includes(u.role));
        }
        if (args?.where?.OR) {
          list = list.filter((u) =>
            args.where.OR.some((cond: any) => {
              if (cond.name?.contains && u.name.toLowerCase().includes(cond.name.contains.toLowerCase())) return true;
              if (cond.email?.contains && u.email.toLowerCase().includes(cond.email.contains.toLowerCase())) return true;
              if (cond.department?.contains && u.department?.toLowerCase().includes(cond.department.contains.toLowerCase())) return true;
              return false;
            }),
          );
        }
        const take = args?.take !== undefined ? args.take : list.length;
        return list.slice(0, take);
      },
      count: async () => Object.keys(mockUsers).length,
    },
    ticket: {
      count: async (args: any) => {
        const filtered = filterTicketList(args?.where);
        return filtered.length;
      },
      groupBy: async (args: any) => {
        const filtered = filterTicketList(args?.where);
        const key = args.by[0];
        const counts: Record<string, number> = {};
        for (const t of filtered) {
          const val = t[key];
          if (val !== undefined && val !== null) {
            counts[val] = (counts[val] || 0) + 1;
          }
        }
        return Object.entries(counts).map(([k, count]) => ({
          [key]: k,
          _count: { _all: count },
        }));
      },
      findMany: async (args: any) => {
        const filtered = filterTicketList(args?.where);
        const take = args?.take !== undefined ? args.take : filtered.length;
        return filtered.slice(0, take).map((t) => ({
          ...t,
          requester: Object.values(mockUsers).find((u) => u.id === t.requesterId) || null,
          assignee: Object.values(mockUsers).find((u) => u.id === t.assigneeId) || null,
          category: mockCategories.get(t.categoryId) || null,
        }));
      },
    },
    category: {
      findMany: async (args: any) => {
        let list = Array.from(mockCategories.values());
        if (args?.where?.OR) {
          list = list.filter((c) =>
            args.where.OR.some((cond: any) => {
              if (cond.name?.contains && c.name.toLowerCase().includes(cond.name.contains.toLowerCase())) return true;
              if (cond.description?.contains && c.description?.toLowerCase().includes(cond.description.contains.toLowerCase())) return true;
              return false;
            }),
          );
        }
        const take = args?.take !== undefined ? args.take : list.length;
        return list.slice(0, take);
      },
    },
    team: {
      findMany: async (args: any) => {
        let list = Array.from(mockTeams.values());
        if (args?.where?.OR) {
          list = list.filter((tm) =>
            args.where.OR.some((cond: any) => {
              if (cond.name?.contains && tm.name.toLowerCase().includes(cond.name.contains.toLowerCase())) return true;
              if (cond.description?.contains && tm.description?.toLowerCase().includes(cond.description.contains.toLowerCase())) return true;
              return false;
            }),
          );
        }
        const take = args?.take !== undefined ? args.take : list.length;
        return list.slice(0, take).map((tm) => ({
          ...tm,
          teamLead: Object.values(mockUsers).find((u) => u.id === tm.teamLeadId) || null,
          _count: { members: 3 },
        }));
      },
    },
    knowledgeArticle: {
      findMany: async (args: any) => {
        let list = Array.from(mockArticles.values());
        if (args?.where?.isPublished !== undefined) {
          list = list.filter((a) => a.isPublished === args.where.isPublished);
        }
        if (args?.where?.OR) {
          list = list.filter((a) =>
            args.where.OR.some((cond: any) => {
              if (cond.title?.contains && a.title.toLowerCase().includes(cond.title.contains.toLowerCase())) return true;
              if (cond.excerpt?.contains && a.excerpt.toLowerCase().includes(cond.excerpt.contains.toLowerCase())) return true;
              if (cond.keywords?.has && a.keywords.includes(cond.keywords.has.toLowerCase())) return true;
              return false;
            }),
          );
        }
        const take = args?.take !== undefined ? args.take : list.length;
        return list.slice(0, take);
      },
    },
    ticketActivity: {
      findMany: async (args: any) => {
        return mockActivities.map((a) => ({
          ...a,
          actor: Object.values(mockUsers).find((u) => u.id === a.actorId) || null,
          ticket: mockTickets.get(a.ticketId) || null,
        }));
      },
    },
    $transaction: async (cb: any) => cb(mockPrismaService),
    $queryRaw: async () => [{ 1: 1 }],
    pingDatabase: async () => true,
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(mockPrismaService)
    .compile();

  const app: INestApplication = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();
  const server = app.getHttpServer();

  let adminToken = '';
  let agentToken = '';
  let employeeToken = '';

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      process.exitCode = 1;
    }
  }

  // Auth tokens
  {
    const resAdmin = await request(server)
      .post('/api/auth/login')
      .send({ email: 'alex.morgan@ticketgo.io', password: defaultPassword });
    adminToken = resAdmin.body.data.accessToken;

    const resAgent = await request(server)
      .post('/api/auth/login')
      .send({ email: 'liam.chen@ticketgo.io', password: defaultPassword });
    agentToken = resAgent.body.data.accessToken;

    const resEmployee = await request(server)
      .post('/api/auth/login')
      .send({ email: 'marcus.vance@ticketgo.io', password: defaultPassword });
    employeeToken = resEmployee.body.data.accessToken;
  }

  // ==========================================
  // 1. REPORTS & ANALYTICS TESTS
  // ==========================================
  console.log('--- SECTION 1: REPORTS & ANALYTICS ---');

  // 1.1 GET /api/reports returns full calculated report
  {
    const res = await request(server)
      .get('/api/reports?dateRange=all')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.status === 200, '1.1 GET /api/reports returns 200 OK');
    assert(typeof res.body.data.totalCount === 'number', 'totalCount returned');
    assert(res.body.data.totalCount === 3, 'Total tickets count matches 3');
    assert(Array.isArray(res.body.data.summaryMetrics), 'Summary metrics array present');
    assert(Array.isArray(res.body.data.statusDistribution), 'Status distribution present');
    assert(Array.isArray(res.body.data.priorityDistribution), 'Priority distribution present');
    assert(Array.isArray(res.body.data.typeDistribution), 'Type distribution present');
    assert(Array.isArray(res.body.data.departmentDistribution), 'Department distribution present');
    assert(Array.isArray(res.body.data.categoryDistribution), 'Category distribution present');
    assert(Array.isArray(res.body.data.assigneeWorkload), 'Assignee workload present');
    assert(Array.isArray(res.body.data.trendPoints), 'Trend points present');
  }

  // 1.2 Reports Overdue & Critical Counts
  {
    const res = await request(server)
      .get('/api/reports')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.body.data.overdueCount === 1, 'Overdue tickets identified (1)');
    assert(res.body.data.criticalCount === 1, 'Critical active tickets identified (1)');
  }

  // 1.3 Reports Filtering by Department
  {
    const res = await request(server)
      .get('/api/reports?department=Engineering')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.status === 200, '1.3 Department filter returns 200 OK');
    assert(res.body.data.totalCount === 1, 'Filtered count for Engineering is 1');
  }

  // 1.4 Reports Scoping for Employee Role
  {
    const res = await request(server)
      .get('/api/reports')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '1.4 Employee reports request returns 200 OK');
    assert(res.body.data.totalCount === 2, 'Employee reports strictly scoped to 2 tickets (excludes admin ticket)');
  }

  // 1.5 GET /api/reports/dashboard returns dashboard data
  {
    const res = await request(server)
      .get('/api/reports/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.status === 200, '1.5 GET /api/reports/dashboard returns 200 OK');
    assert(Array.isArray(res.body.data.stats), 'Dashboard stats array present (6 cards)');
    assert(res.body.data.stats.length === 6, 'Exactly 6 dashboard stat cards returned');
    assert(Array.isArray(res.body.data.recentTickets), 'Recent tickets present');
    assert(Array.isArray(res.body.data.recentActivities), 'Recent activities present');
  }

  // ==========================================
  // 2. GLOBAL SEARCH TESTS
  // ==========================================
  console.log('\n--- SECTION 2: GLOBAL SEARCH ---');

  // 2.1 Search across multiple entities
  {
    const res = await request(server)
      .get('/api/search?q=VPN')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.status === 200, '2.1 GET /api/search?q=VPN returns 200 OK');
    assert(res.body.data.tickets.length >= 1, 'VPN found in tickets');
    assert(res.body.data.articles.length >= 1, 'VPN found in knowledge articles');
    assert(res.body.data.totalResults >= 2, 'totalResults counts across entities');
  }

  // 2.2 Search Users
  {
    const res = await request(server)
      .get('/api/search?q=Liam')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.status === 200, '2.2 Search finding users returns 200 OK');
    assert(res.body.data.users.length === 1, 'Liam user found');
    assert(res.body.data.users[0].passwordHash === undefined, 'passwordHash strictly omitted');
  }

  // 2.3 Search Teams
  {
    const res = await request(server)
      .get('/api/search?q=DevOps')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.status === 200, '2.3 Search finding teams returns 200 OK');
    assert(res.body.data.teams.length === 1, 'DevOps team found');
  }

  // 2.4 Search Categories
  {
    const res = await request(server)
      .get('/api/search?q=Support')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.status === 200, '2.4 Search finding categories returns 200 OK');
    assert(res.body.data.categories.length >= 1, 'Technical Support category found');
  }

  // 2.5 Entity Type Filter
  {
    const res = await request(server)
      .get('/api/search?q=VPN&type=ticket')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.status === 200, '2.5 Type filter type=ticket returns 200 OK');
    assert(res.body.data.tickets.length >= 1, 'Tickets returned');
    assert(res.body.data.articles.length === 0, 'Articles excluded when type=ticket');
  }

  // 2.6 Employee RBAC: Employee cannot find admin-only tickets in search
  {
    const res = await request(server)
      .get('/api/search?q=internal audit')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '2.6 Employee search returns 200 OK');
    assert(res.body.data.tickets.length === 0, 'Employee cannot find admin private ticket');
  }

  // 2.7 Unpublished knowledge base articles excluded
  {
    const res = await request(server)
      .get('/api/search?q=Unpublished draft')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '2.7 Search for draft article returns 200 OK');
    assert(res.body.data.articles.length === 0, 'Draft/unpublished article strictly excluded');
  }

  console.log('\n===============================================================');
  console.log(`Results: ${passed}/${total} verification tests passed!`);
  console.log('===============================================================');

  if (passed !== total) {
    process.exit(1);
  }

  await app.close();
}

runReportsAndSearchVerification().catch((err) => {
  console.error('Reports & Search verification failed:', err);
  process.exit(1);
});

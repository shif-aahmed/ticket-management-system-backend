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
  Category,
  KnowledgeArticle,
  Ticket,
} from '@prisma/client';

async function runPrompt6AuditVerification() {
  console.log('\n===============================================================');
  console.log('   TICKETGO PROMPT 6: FULL SYSTEM AUDIT & SECURITY SUITE      ');
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
      title: 'Senior Frontend Engineer',
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'inactive.user@ticketgo.io': {
      id: 'usr-inactive-004',
      email: 'inactive.user@ticketgo.io',
      name: 'Former Staff Member',
      passwordHash,
      role: Role.employee,
      status: UserStatus.inactive,
      department: 'Operations',
      avatarUrl: null,
      phone: null,
      title: 'Former Associate',
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
        description: 'Hardware, software, and general IT issues',
        departmentDefault: 'Engineering',
        status: CategoryStatus.active,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  ]);

  const mockArticles: Map<string, KnowledgeArticle> = new Map([
    [
      'art-published-001',
      {
        id: 'art-published-001',
        title: 'Published Corporate Security Guidelines',
        category: 'Security',
        excerpt: 'Standard security guidelines for all employees.',
        content: 'Clear public corporate security procedures.',
        keywords: ['security', 'guidelines'],
        readingTime: '3 min',
        viewCount: 15,
        isPublished: true,
        authorId: 'usr-admin-001',
        relatedArticleIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    [
      'art-draft-002',
      {
        id: 'art-draft-002',
        title: 'Draft Vulnerability Disclosure Protocol',
        category: 'Security',
        excerpt: 'Internal draft not yet approved for release.',
        content: 'Confidential vulnerability remediation workflow.',
        keywords: ['vulnerability', 'confidential', 'draft'],
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
  const mockTickets: Map<string, any> = new Map([
    [
      'tkt-001',
      {
        id: 'tkt-001',
        code: '#TKT-1001',
        subject: 'Active Support Ticket',
        description: 'Assigned to support agent',
        type: TicketType.task,
        priority: TicketPriority.medium,
        status: TicketStatus.open,
        department: 'Customer Support',
        project: 'Support Queue',
        dueDate: new Date(now.getTime() + 24 * 3600 * 1000),
        requesterId: 'usr-employee-003',
        assigneeId: 'usr-agent-002',
        categoryId: 'cat-001',
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
        closedAt: null,
      },
    ],
  ]);

  function filterTicketList(where: any = {}) {
    let list = Array.from(mockTickets.values());

    if (where.requesterId && !where.assigneeId) {
      list = list.filter((t) => t.requesterId === where.requesterId);
    } else if (where.OR) {
      list = list.filter((t) =>
        where.OR.some((cond: any) => {
          if (cond.requesterId && t.requesterId === cond.requesterId) return true;
          if (cond.assigneeId && t.assigneeId === cond.assigneeId) return true;
          return false;
        }),
      );
    }

    if (where.status?.notIn) {
      list = list.filter((t) => !where.status.notIn.includes(t.status));
    }

    if (where.status && typeof where.status === 'string') {
      list = list.filter((t) => t.status === where.status);
    }

    if (where.assigneeId?.in) {
      list = list.filter((t) => where.assigneeId.in.includes(t.assigneeId));
    } else if (where.assigneeId) {
      list = list.filter((t) => t.assigneeId === where.assigneeId);
    }

    if (where.dueDate?.lt) {
      list = list.filter((t) => t.dueDate && t.dueDate < where.dueDate.lt);
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
        if (args?.where?.status) {
          list = list.filter((u) => u.status === args.where.status);
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
      findMany: async (args: any) => {
        let list = Array.from(mockTickets.values());
        if (args?.orderBy?.createdAt === 'desc') {
          list = list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        const take = args?.take !== undefined ? args.take : list.length;
        return list.slice(0, take);
      },
      findUnique: async (args: any) => {
        if (args.where?.code) {
          return Array.from(mockTickets.values()).find((t) => t.code === args.where.code) || null;
        }
        if (args.where?.id) {
          return mockTickets.get(args.where.id) || null;
        }
        return null;
      },
      count: async (args: any) => {
        const filtered = filterTicketList(args?.where);
        return filtered.length;
      },
      groupBy: async (args: any) => {
        const filtered = filterTicketList(args?.where);
        const key = args.by[0];
        const secondKey = args.by[1];

        if (secondKey) {
          const map = new Map<string, number>();
          for (const t of filtered) {
            const composite = `${t[key]}:::${t[secondKey]}`;
            map.set(composite, (map.get(composite) || 0) + 1);
          }
          return Array.from(map.entries()).map(([k, count]) => {
            const [val1, val2] = k.split(':::');
            return {
              [key]: val1,
              [secondKey]: val2,
              _count: { _all: count },
            };
          });
        }

        const counts: Record<string, number> = {};
        for (const t of filtered) {
          const val = t[key];
          if (val !== undefined && val !== null) {
            counts[val] = (counts[val] || 0) + 1;
          }
        }
        return Object.entries(counts).map(([val, count]) => ({
          [key]: val,
          _count: { _all: count },
        }));
      },
      create: async (args: any) => {
        const id = `tkt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const record = {
          id,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockTickets.set(id, record);
        return record;
      },
    },
    knowledgeArticle: {
      findUnique: async (args: any) => {
        const art = mockArticles.get(args.where.id);
        if (!art) return null;
        return {
          ...art,
          author: mockUsers['alex.morgan@ticketgo.io'],
        };
      },
      findMany: async (args: any) => {
        let list = Array.from(mockArticles.values());
        if (args?.where?.isPublished !== undefined) {
          list = list.filter((a) => a.isPublished === args.where.isPublished);
        }
        if (args?.where?.OR) {
          list = list.filter((a) =>
            args.where.OR.some((cond: any) => {
              if (cond.title?.contains && a.title.toLowerCase().includes(cond.title.contains.toLowerCase())) return true;
              if (cond.content?.contains && a.content.toLowerCase().includes(cond.content.contains.toLowerCase())) return true;
              if (cond.keywords?.has && a.keywords.includes(cond.keywords.has)) return true;
              return false;
            }),
          );
        }
        return list.map((a) => ({
          ...a,
          author: mockUsers['alex.morgan@ticketgo.io'],
        }));
      },
      create: async (args: any) => {
        const id = `art-${Date.now()}`;
        const record: KnowledgeArticle = {
          id,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
          viewCount: 0,
        };
        mockArticles.set(id, record);
        return {
          ...record,
          author: mockUsers['alex.morgan@ticketgo.io'],
        };
      },
      update: async (args: any) => {
        const existing = mockArticles.get(args.where.id);
        if (!existing) throw new Error('Not found');
        const updated = { ...existing, ...args.data, updatedAt: new Date() };
        mockArticles.set(args.where.id, updated);
        return updated;
      },
    },
    team: {
      findMany: async () => [],
    },
    category: {
      findMany: async () => Array.from(mockCategories.values()),
      findUnique: async (args: any) => mockCategories.get(args.where.id) || null,
    },
    ticketActivity: {
      create: async () => ({}),
      findMany: async () => [],
    },
    notification: {
      create: async () => ({}),
    },
    $transaction: async (fn: any) => fn(mockPrismaService),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(mockPrismaService)
    .compile();

  const app: INestApplication = moduleRef.createNestApplication();
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
  app.setGlobalPrefix('api');
  await app.init();

  let passedCount = 0;
  let totalCount = 0;

  function assert(desc: string, condition: boolean, detail?: string) {
    totalCount++;
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${desc}${detail ? ` - ${detail}` : ''}`);
    }
  }

  // Tokens
  const adminLogin = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: 'alex.morgan@ticketgo.io', password: defaultPassword });
  const adminToken = adminLogin.body.data.accessToken;

  const empLogin = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: 'marcus.vance@ticketgo.io', password: defaultPassword });
  const empToken = empLogin.body.data.accessToken;

  console.log('--- SECTION 1: REPORTS N+1 & EMPLOYEE ISOLATION ---');

  const adminReportsRes = await request(app.getHttpServer())
    .get('/api/reports')
    .set('Authorization', `Bearer ${adminToken}`);
  assert('1.1 Admin reports returns 200 OK', adminReportsRes.status === 200);
  assert(
    '1.2 Admin sees agent workload calculated in bulk',
    Array.isArray(adminReportsRes.body.data.assigneeWorkload) &&
      adminReportsRes.body.data.assigneeWorkload.length > 0,
  );

  const empReportsRes = await request(app.getHttpServer())
    .get('/api/reports')
    .set('Authorization', `Bearer ${empToken}`);
  assert('1.3 Employee reports returns 200 OK', empReportsRes.status === 200);
  assert(
    '1.4 Employee assigneeWorkload is empty (internal agent queue hidden)',
    Array.isArray(empReportsRes.body.data.assigneeWorkload) &&
      empReportsRes.body.data.assigneeWorkload.length === 0,
  );

  console.log('\n--- SECTION 2: KNOWLEDGE BASE DRAFT CONTENT ISOLATION ---');

  const adminDraftRes = await request(app.getHttpServer())
    .get('/api/knowledge-base/art-draft-002')
    .set('Authorization', `Bearer ${adminToken}`);
  assert('2.1 Admin can read draft article by direct ID', adminDraftRes.status === 200);

  const empDraftDirectRes = await request(app.getHttpServer())
    .get('/api/knowledge-base/art-draft-002')
    .set('Authorization', `Bearer ${empToken}`);
  assert('2.2 Employee receives 404 for draft article by ID', empDraftDirectRes.status === 404);

  const empKbListRes = await request(app.getHttpServer())
    .get('/api/knowledge-base')
    .set('Authorization', `Bearer ${empToken}`);
  assert('2.3 Employee lists published articles only', empKbListRes.status === 200);
  const leakedDraftInList = empKbListRes.body.data.find(
    (a: any) => a.id === 'art-draft-002',
  );
  assert('2.4 Draft article excluded from employee list', leakedDraftInList === undefined);

  const empSearchDraftRes = await request(app.getHttpServer())
    .get('/api/search?q=Vulnerability&type=article')
    .set('Authorization', `Bearer ${empToken}`);
  assert('2.5 Search returns 200 OK', empSearchDraftRes.status === 200);
  const foundDraftInSearch = empSearchDraftRes.body.data.articles.find(
    (a: any) => a.id === 'art-draft-002',
  );
  assert('2.6 Draft article excluded from global search', foundDraftInSearch === undefined);

  console.log('\n--- SECTION 3: INACTIVE USER ACCESS ISOLATION ---');

  const adminUserView = await request(app.getHttpServer())
    .get('/api/users/usr-inactive-004')
    .set('Authorization', `Bearer ${adminToken}`);
  assert('3.1 Admin can view inactive user profile', adminUserView.status === 200);

  const empUserView = await request(app.getHttpServer())
    .get('/api/users/usr-inactive-004')
    .set('Authorization', `Bearer ${empToken}`);
  assert('3.2 Employee receives 404 for inactive user by ID', empUserView.status === 404);

  const empUsersList = await request(app.getHttpServer())
    .get('/api/users')
    .set('Authorization', `Bearer ${empToken}`);
  assert('3.3 Employee gets users list', empUsersList.status === 200);
  const userItems = empUsersList.body.data.items || empUsersList.body.data.users || empUsersList.body.data;
  const leakedInactiveUser = Array.isArray(userItems)
    ? userItems.find((u: any) => u.id === 'usr-inactive-004')
    : undefined;
  assert('3.4 Inactive user excluded from employee users list', leakedInactiveUser === undefined);

  const empSearchInactiveUser = await request(app.getHttpServer())
    .get('/api/search?q=Former&type=user')
    .set('Authorization', `Bearer ${empToken}`);
  assert('3.5 Search returns 200 OK', empSearchInactiveUser.status === 200);
  const foundInactiveInSearch = empSearchInactiveUser.body.data.users.find(
    (u: any) => u.id === 'usr-inactive-004',
  );
  assert('3.6 Inactive user excluded from employee search results', foundInactiveInSearch === undefined);

  console.log('\n--- SECTION 4: TICKET CODE COLLISION-FREE ALLOCATION ---');

  const createTicketRes1 = await request(app.getHttpServer())
    .post('/api/tickets')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      subject: 'Monotonic Code Ticket 1',
      description: 'Testing monotonic ticket code generation',
      priority: 'low',
      type: 'task',
      department: 'Engineering',
    });
  assert('4.1 Create Ticket 1 returns 201 Created', createTicketRes1.status === 201);
  const code1 = createTicketRes1.body.data.code;

  const createTicketRes2 = await request(app.getHttpServer())
    .post('/api/tickets')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      subject: 'Monotonic Code Ticket 2',
      description: 'Testing monotonic ticket code generation next in sequence',
      priority: 'medium',
      type: 'task',
      department: 'Engineering',
    });
  assert('4.2 Create Ticket 2 returns 201 Created', createTicketRes2.status === 201);
  const code2 = createTicketRes2.body.data.code;

  const num1 = parseInt(code1.replace(/[^0-9]/g, ''), 10);
  const num2 = parseInt(code2.replace(/[^0-9]/g, ''), 10);
  assert(
    `4.3 Sequential ticket codes are monotonic and distinct (${code1} -> ${code2})`,
    num2 > num1 && code1 !== code2,
  );

  await app.close();

  console.log('\n===============================================================');
  console.log(`Results: ${passedCount}/${totalCount} verification tests passed!`);
  console.log('===============================================================\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runPrompt6AuditVerification();

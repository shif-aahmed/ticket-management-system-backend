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
  NotificationType,
  TicketStatus,
  TicketPriority,
  TicketType,
  User,
  Team,
  TeamMember,
  Category,
  Notification,
  KnowledgeArticle,
} from '@prisma/client';

async function runOrgModulesVerification() {
  console.log('===============================================================');
  console.log('   TICKETGO ORGANIZATION & SUPPORTING MODULES VERIFICATION     ');
  console.log('===============================================================\n');

  const defaultPassword = 'TicketGo2024!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // In-memory data store for testing
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
      bio: 'Leading IT operations and security.',
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
      bio: 'Resolving complex customer technical queries.',
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
      bio: 'Building backend and frontend features.',
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
        name: 'Billing & Invoicing',
        description: 'Payment queries and billing adjustments',
        status: CategoryStatus.active,
        departmentDefault: 'Finance',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  ]);

  const mockTeams: Map<string, Team> = new Map();
  const mockTeamMembers: TeamMember[] = [];
  const mockNotifications: Map<string, Notification> = new Map();
  const mockArticles: Map<string, KnowledgeArticle> = new Map();
  const mockTickets: Map<string, any> = new Map();

  const mockPrismaService = {
    user: {
      findUnique: async (args: any) => {
        if (args.where?.id) {
          return Object.values(mockUsers).find((u) => u.id === args.where.id) || null;
        }
        if (args.where?.email) {
          return mockUsers[args.where.email.toLowerCase().trim()] || null;
        }
        return null;
      },
      findMany: async (args: any) => {
        let list = Object.values(mockUsers);
        if (args?.where) {
          if (args.where.role) list = list.filter((u) => u.role === args.where.role);
          if (args.where.status) list = list.filter((u) => u.status === args.where.status);
          if (args.where.department?.equals) {
            list = list.filter((u) => u.department?.toLowerCase() === args.where.department.equals.toLowerCase());
          }
          if (args.where.OR) {
            list = list.filter((u) => {
              return args.where.OR.some((cond: any) => {
                if (cond.name?.contains) {
                  return u.name.toLowerCase().includes(cond.name.contains.toLowerCase());
                }
                if (cond.email?.contains) {
                  return u.email.toLowerCase().includes(cond.email.contains.toLowerCase());
                }
                return false;
              });
            });
          }
        }
        const skip = args?.skip || 0;
        const take = args?.take !== undefined ? args.take : list.length;
        return list.slice(skip, skip + take);
      },
      count: async (args?: any) => {
        let list = Object.values(mockUsers);
        if (args?.where) {
          if (args.where.role) list = list.filter((u) => u.role === args.where.role);
          if (args.where.status) list = list.filter((u) => u.status === args.where.status);
        }
        return list.length;
      },
      create: async (args: any) => {
        const id = `usr-created-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const user: User = {
          id,
          email: args.data.email.toLowerCase().trim(),
          name: args.data.name,
          passwordHash: args.data.passwordHash,
          role: args.data.role,
          status: args.data.status || UserStatus.active,
          department: args.data.department || null,
          title: args.data.title || null,
          bio: args.data.bio || null,
          avatarUrl: args.data.avatarUrl || null,
          phone: args.data.phone || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockUsers[user.email] = user;
        return user;
      },
      update: async (args: any) => {
        const existing = Object.values(mockUsers).find((u) => u.id === args.where.id);
        if (!existing) throw new Error('User not found');
        const updated = {
          ...existing,
          ...args.data,
          updatedAt: new Date(),
        };
        mockUsers[existing.email] = updated;
        return updated;
      },
    },
    team: {
      findUnique: async (args: any) => {
        let team: Team | null = null;
        if (args.where?.id) team = mockTeams.get(args.where.id) || null;
        if (args.where?.name) {
          team = (
            Array.from(mockTeams.values()).find(
              (t) => t.name.toLowerCase() === args.where.name.toLowerCase(),
            ) || null
          );
        }
        if (!team) return null;
        return {
          ...team,
          teamLead: Object.values(mockUsers).find((u) => u.id === team!.teamLeadId) || null,
          members: mockTeamMembers
            .filter((m) => m.teamId === team!.id)
            .map((m) => ({
              ...m,
              user: Object.values(mockUsers).find((u) => u.id === m.userId) || null,
            })),
          _count: {
            members: mockTeamMembers.filter((m) => m.teamId === team!.id).length,
          },
        };
      },
      findFirst: async (args: any) => {
        if (args.where?.name) {
          return (
            Array.from(mockTeams.values()).find(
              (t) => t.name.toLowerCase() === args.where.name.toLowerCase(),
            ) || null
          );
        }
        return null;
      },
      findMany: async (args: any) => {
        let list = Array.from(mockTeams.values());
        if (args?.where?.isActive !== undefined) {
          list = list.filter((t) => t.isActive === args.where.isActive);
        }
        if (args?.where?.department) {
          list = list.filter(
            (t) =>
              t.department?.toLowerCase() ===
              args.where.department.equals?.toLowerCase(),
          );
        }
        return list.map((t) => ({
          ...t,
          teamLead: Object.values(mockUsers).find((u) => u.id === t.teamLeadId) || null,
          _count: {
            members: mockTeamMembers.filter((m) => m.teamId === t.id).length,
          },
        }));
      },
      count: async () => mockTeams.size,
      create: async (args: any) => {
        const id = `team-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const team: Team = {
          id,
          name: args.data.name,
          description: args.data.description || null,
          department: args.data.department || null,
          teamLeadId: args.data.teamLeadId || null,
          colorClass: args.data.colorClass || 'text-[#064747]',
          bgClass: args.data.bgClass || 'bg-[#E6F3EF]',
          isActive: args.data.isActive !== undefined ? args.data.isActive : true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockTeams.set(id, team);
        return {
          ...team,
          teamLead: Object.values(mockUsers).find((u) => u.id === team.teamLeadId) || null,
          _count: { members: 0 },
        };
      },
      update: async (args: any) => {
        const team = mockTeams.get(args.where.id);
        if (!team) throw new Error('Team not found');
        const updated = {
          ...team,
          ...args.data,
          updatedAt: new Date(),
        };
        mockTeams.set(args.where.id, updated);
        return {
          ...updated,
          teamLead: Object.values(mockUsers).find((u) => u.id === updated.teamLeadId) || null,
          _count: {
            members: mockTeamMembers.filter((m) => m.teamId === updated.id).length,
          },
        };
      },
    },
    teamMember: {
      findUnique: async (args: any) => {
        if (args.where?.teamId_userId) {
          const { teamId, userId } = args.where.teamId_userId;
          return (
            mockTeamMembers.find(
              (m) => m.teamId === teamId && m.userId === userId,
            ) || null
          );
        }
        return null;
      },
      findMany: async (args: any) => {
        return mockTeamMembers
          .filter((m) => m.teamId === args.where.teamId)
          .map((m) => ({
            ...m,
            user: Object.values(mockUsers).find((u) => u.id === m.userId) || null,
          }));
      },
      create: async (args: any) => {
        const member: TeamMember = {
          id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          teamId: args.data.teamId,
          userId: args.data.userId,
          role: args.data.role || 'Member',
          joinedAt: new Date(),
        };
        mockTeamMembers.push(member);
        return {
          ...member,
          user: Object.values(mockUsers).find((u) => u.id === member.userId) || null,
        };
      },
      delete: async (args: any) => {
        const { teamId, userId } = args.where.teamId_userId;
        const index = mockTeamMembers.findIndex(
          (m) => m.teamId === teamId && m.userId === userId,
        );
        if (index === -1) throw new Error('Member not found');
        const removed = mockTeamMembers.splice(index, 1)[0];
        return removed;
      },
    },
    category: {
      findUnique: async (args: any) => {
        if (args.where?.id) return mockCategories.get(args.where.id) || null;
        if (args.where?.name) {
          return (
            Array.from(mockCategories.values()).find(
              (c) => c.name.toLowerCase() === args.where.name.toLowerCase(),
            ) || null
          );
        }
        return null;
      },
      findFirst: async (args: any) => {
        if (args.where?.name) {
          return (
            Array.from(mockCategories.values()).find(
              (c) => c.name.toLowerCase() === args.where.name.toLowerCase(),
            ) || null
          );
        }
        return null;
      },
      findMany: async (args: any) => {
        let list = Array.from(mockCategories.values());
        if (args?.where?.status) {
          list = list.filter((c) => c.status === args.where.status);
        }
        if (args?.where?.departmentDefault) {
          list = list.filter(
            (c) =>
              c.departmentDefault?.toLowerCase() ===
              args.where.departmentDefault.equals?.toLowerCase(),
          );
        }
        return list.map((c) => ({
          ...c,
          _count: {
            tickets: Array.from(mockTickets.values()).filter(
              (t) => t.categoryId === c.id,
            ).length,
          },
        }));
      },
      count: async () => mockCategories.size,
      create: async (args: any) => {
        const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const cat: Category = {
          id,
          name: args.data.name,
          description: args.data.description || null,
          status: args.data.status || CategoryStatus.active,
          departmentDefault: args.data.departmentDefault || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockCategories.set(id, cat);
        return { ...cat, _count: { tickets: 0 } };
      },
      update: async (args: any) => {
        const cat = mockCategories.get(args.where.id);
        if (!cat) throw new Error('Category not found');
        const updated = {
          ...cat,
          ...args.data,
          updatedAt: new Date(),
        };
        mockCategories.set(args.where.id, updated);
        return {
          ...updated,
          _count: {
            tickets: Array.from(mockTickets.values()).filter(
              (t) => t.categoryId === updated.id,
            ).length,
          },
        };
      },
    },
    notification: {
      findUnique: async (args: any) => {
        return mockNotifications.get(args.where.id) || null;
      },
      findFirst: async (args: any) => {
        let list = Array.from(mockNotifications.values());
        if (args?.where?.id) {
          list = list.filter((n) => n.id === args.where.id);
        }
        if (args?.where?.userId) {
          list = list.filter((n) => n.userId === args.where.userId);
        }
        return list[0] || null;
      },
      findMany: async (args: any) => {
        let list = Array.from(mockNotifications.values());
        if (args?.where?.userId) {
          list = list.filter((n) => n.userId === args.where.userId);
        }
        if (args?.where?.isRead !== undefined) {
          list = list.filter((n) => n.isRead === args.where.isRead);
        }
        return list
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((n) => ({
            ...n,
            actor: Object.values(mockUsers).find((u) => u.id === n.actorId) || null,
            ticket: mockTickets.get(n.ticketId || '') || null,
          }));
      },
      count: async (args: any) => {
        let list = Array.from(mockNotifications.values());
        if (args?.where?.userId) {
          list = list.filter((n) => n.userId === args.where.userId);
        }
        if (args?.where?.isRead !== undefined) {
          list = list.filter((n) => n.isRead === args.where.isRead);
        }
        return list.length;
      },
      create: async (args: any) => {
        const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const notif: Notification = {
          id,
          userId: args.data.userId,
          actorId: args.data.actorId || null,
          ticketId: args.data.ticketId || null,
          type: args.data.type,
          title: args.data.title,
          message: args.data.message,
          isRead: false,
          createdAt: new Date(),
          readAt: null,
        };
        mockNotifications.set(id, notif);
        return notif;
      },
      update: async (args: any) => {
        const notif = mockNotifications.get(args.where.id);
        if (!notif) throw new Error('Notification not found');
        const updated = {
          ...notif,
          ...args.data,
        };
        mockNotifications.set(args.where.id, updated);
        return updated;
      },
      updateMany: async (args: any) => {
        let count = 0;
        for (const [id, notif] of mockNotifications.entries()) {
          if (notif.userId === args.where.userId) {
            if (args.where.isRead !== undefined && notif.isRead !== args.where.isRead) {
              continue;
            }
            mockNotifications.set(id, {
              ...notif,
              ...args.data,
            });
            count++;
          }
        }
        return { count };
      },
    },
    knowledgeArticle: {
      findUnique: async (args: any) => {
        const article = mockArticles.get(args.where.id);
        if (!article) return null;
        return {
          ...article,
          author: Object.values(mockUsers).find((u) => u.id === article.authorId) || null,
        };
      },
      findMany: async (args: any) => {
        let list = Array.from(mockArticles.values());
        if (args?.where?.id?.in) {
          list = list.filter((a) => args.where.id.in.includes(a.id));
        }
        if (args?.where?.category) {
          list = list.filter(
            (a) => a.category.toLowerCase() === args.where.category.toLowerCase(),
          );
        }
        if (args?.where?.isPublished !== undefined) {
          list = list.filter((a) => a.isPublished === args.where.isPublished);
        }
        if (args?.where?.OR) {
          list = list.filter((a) => {
            return args.where.OR.some((cond: any) => {
              if (cond.title?.contains) {
                return a.title.toLowerCase().includes(cond.title.contains.toLowerCase());
              }
              if (cond.content?.contains) {
                return a.content.toLowerCase().includes(cond.content.contains.toLowerCase());
              }
              if (cond.excerpt?.contains) {
                return a.excerpt.toLowerCase().includes(cond.excerpt.contains.toLowerCase());
              }
              return false;
            });
          });
        }
        const skip = args?.skip || 0;
        const take = args?.take !== undefined ? args.take : list.length;
        return list.slice(skip, skip + take).map((a) => ({
          ...a,
          author: Object.values(mockUsers).find((u) => u.id === a.authorId) || null,
        }));
      },
      groupBy: async (args: any) => {
        const groups: Record<string, number> = {};
        for (const a of mockArticles.values()) {
          if (args?.where?.isPublished !== undefined && a.isPublished !== args.where.isPublished) {
            continue;
          }
          groups[a.category] = (groups[a.category] || 0) + 1;
        }
        return Object.entries(groups).map(([category, count]) => ({
          category,
          _count: { _all: count },
        }));
      },
      count: async (args?: any) => {
        let list = Array.from(mockArticles.values());
        if (args?.where?.category) {
          list = list.filter(
            (a) => a.category.toLowerCase() === args.where.category.toLowerCase(),
          );
        }
        return list.length;
      },
      create: async (args: any) => {
        const id = `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const article: KnowledgeArticle = {
          id,
          title: args.data.title,
          category: args.data.category,
          excerpt: args.data.excerpt,
          content: args.data.content,
          keywords: args.data.keywords || [],
          readingTime: args.data.readingTime || '3 min',
          viewCount: 0,
          isPublished:
            args.data.isPublished !== undefined ? args.data.isPublished : true,
          authorId: args.data.authorId || null,
          relatedArticleIds: args.data.relatedArticleIds || [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockArticles.set(id, article);
        return {
          ...article,
          author: Object.values(mockUsers).find((u) => u.id === article.authorId) || null,
        };
      },
      update: async (args: any) => {
        const article = mockArticles.get(args.where.id);
        if (!article) throw new Error('Article not found');
        const updated = {
          ...article,
          ...args.data,
          viewCount:
            args.data.viewCount?.increment !== undefined
              ? article.viewCount + args.data.viewCount.increment
              : args.data.viewCount !== undefined
                ? args.data.viewCount
                : article.viewCount,
          updatedAt: new Date(),
        };
        mockArticles.set(args.where.id, updated);
        return {
          ...updated,
          author: Object.values(mockUsers).find((u) => u.id === updated.authorId) || null,
        };
      },
      delete: async (args: any) => {
        const article = mockArticles.get(args.where.id);
        if (!article) throw new Error('Article not found');
        mockArticles.delete(args.where.id);
        return article;
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
  // 1. USERS MODULE TESTS
  // ==========================================
  console.log('--- SECTION 1: USERS MODULE ---');
  let newUserId = '';

  // 1.1 List Users with search and pagination
  {
    const res = await request(server)
      .get('/api/users?search=Liam&page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.status === 200, '1.1 GET /api/users returns 200 OK');
    assert(res.body.data.items.length === 1, 'Search filters user correctly');
    assert(res.body.data.items[0].email === 'liam.chen@ticketgo.io', 'Liam Chen found');
    assert(res.body.data.items[0].passwordHash === undefined, 'No passwordHash exposed in list');
  }

  // 1.2 Create User (Admin only)
  {
    const res = await request(server)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'sarah.connor@ticketgo.io',
        name: 'Sarah Connor',
        password: 'Password123!',
        role: Role.agent,
        department: 'Customer Support',
        title: 'Support Engineer',
        bio: 'Focused on high priority incident resolution.',
        phone: '+1 555 999 8888',
      });

    assert(res.status === 201, '1.2 POST /api/users creates user (201 Created)');
    assert(res.body.data.email === 'sarah.connor@ticketgo.io', 'User email matches');
    assert(res.body.data.title === 'Support Engineer', 'User title saved');
    assert(res.body.data.passwordHash === undefined, 'passwordHash NOT returned');
    newUserId = res.body.data.id;
  }

  // 1.3 Employee blocked from creating user
  {
    const res = await request(server)
      .post('/api/users')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        email: 'intruder@ticketgo.io',
        name: 'Intruder',
        password: 'Password123!',
        role: Role.employee,
      });

    assert(res.status === 403, '1.3 Non-admin creating user returns 403 Forbidden');
  }

  // 1.4 Get User Profile Safe
  {
    const res = await request(server)
      .get(`/api/users/${newUserId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '1.4 GET /api/users/:id returns user safe profile');
    assert(res.body.data.id === newUserId, 'Correct user profile returned');
    assert(res.body.data.passwordHash === undefined, 'passwordHash strictly omitted');
  }

  // 1.5 Update User Profile
  {
    const res = await request(server)
      .patch(`/api/users/${newUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Lead Support Specialist',
        phone: '+1 555 777 6666',
      });

    assert(res.status === 200, '1.5 PATCH /api/users/:id updates profile');
    assert(res.body.data.title === 'Lead Support Specialist', 'Title updated');
  }

  // 1.6 Update User Status (Admin only)
  {
    const res = await request(server)
      .patch(`/api/users/${newUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: UserStatus.inactive });

    assert(res.status === 200, '1.6 PATCH /api/users/:id/status updates status to inactive');
    assert(res.body.data.status === UserStatus.inactive, 'Status confirmed inactive');

    const resForbidden = await request(server)
      .patch(`/api/users/${newUserId}/status`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: UserStatus.active });

    assert(resForbidden.status === 403, 'Non-admin updating status blocked with 403');
  }

  // ==========================================
  // 2. TEAMS MODULE TESTS
  // ==========================================
  console.log('\n--- SECTION 2: TEAMS MODULE ---');
  let createdTeamId = '';

  // 2.1 Admin creates team
  {
    const res = await request(server)
      .post('/api/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'DevOps & Cloud Infrastructure',
        description: 'Managing AWS clusters, Kubernetes, and CI/CD pipelines',
        department: 'Engineering',
        teamLeadId: 'usr-admin-001',
        colorClass: 'text-[#064747]',
        bgClass: 'bg-[#E6F3EF]',
      });

    assert(res.status === 201, '2.1 POST /api/teams creates team (201 Created)');
    assert(res.body.data.name === 'DevOps & Cloud Infrastructure', 'Team name matches');
    assert(res.body.data.teamLead?.id === 'usr-admin-001', 'Team lead hydrated');
    createdTeamId = res.body.data.id;
  }

  // 2.2 Non-admin blocked from creating team
  {
    const res = await request(server)
      .post('/api/teams')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ name: 'Unauthorized Team' });

    assert(res.status === 403, '2.2 Non-admin creating team returns 403 Forbidden');
  }

  // 2.3 Duplicate team name rejected
  {
    const res = await request(server)
      .post('/api/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'DevOps & Cloud Infrastructure' });

    assert(res.status === 409, '2.3 Duplicate team name rejected with 409 Conflict');
  }

  // 2.4 List Teams
  {
    const res = await request(server)
      .get('/api/teams')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '2.4 GET /api/teams returns teams list');
    assert(res.body.data.some((t: any) => t.id === createdTeamId), 'Created team present in list');
  }

  // 2.5 Add Member to Team
  {
    const res = await request(server)
      .post(`/api/teams/${createdTeamId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: 'usr-employee-003',
        role: 'Senior SRE',
      });

    assert(res.status === 201, '2.5 POST /api/teams/:id/members adds member');
    assert(res.body.data.user.id === 'usr-employee-003', 'Member user profile hydrated');
    assert(res.body.data.role === 'Senior SRE', 'Member role saved');
  }

  // 2.6 Duplicate Member rejected
  {
    const res = await request(server)
      .post(`/api/teams/${createdTeamId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: 'usr-employee-003',
        role: 'Senior SRE',
      });

    assert(res.status === 409, '2.6 Adding duplicate team member rejected with 409 Conflict');
  }

  // 2.7 Get Team Details with Members
  {
    const res = await request(server)
      .get(`/api/teams/${createdTeamId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '2.7 GET /api/teams/:id returns detail');
    assert(
      res.body.data?.members?.some((m: any) => m.userId === 'usr-employee-003'),
      'Members array contains added member',
    );
  }

  // 2.8 Remove Member from Team
  {
    const res = await request(server)
      .delete(`/api/teams/${createdTeamId}/members/usr-employee-003`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.status === 200, '2.8 DELETE /api/teams/:id/members/:userId removes member');
  }

  // ==========================================
  // 3. CATEGORIES MODULE TESTS
  // ==========================================
  console.log('\n--- SECTION 3: CATEGORIES MODULE ---');
  let newCatId = '';

  // 3.1 List Categories
  {
    const res = await request(server)
      .get('/api/categories')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '3.1 GET /api/categories returns categories');
    assert(res.body.data.length >= 2, 'Default categories present');
  }

  // 3.2 Create Category (Admin only)
  {
    const res = await request(server)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Database & Storage',
        description: 'PostgreSQL clusters and S3 bucket provisioning',
        departmentDefault: 'Engineering',
      });

    assert(res.status === 201, '3.2 POST /api/categories creates category');
    assert(res.body.data.name === 'Database & Storage', 'Category name matches');
    newCatId = res.body.data.id;
  }

  // 3.3 Duplicate Category name rejected
  {
    const res = await request(server)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Database & Storage',
      });

    assert(res.status === 409, '3.3 Duplicate category name rejected with 409 Conflict');
  }

  // 3.4 Non-admin blocked from creating category
  {
    const res = await request(server)
      .post('/api/categories')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ name: 'Agent Category' });

    assert(res.status === 403, '3.4 Non-admin creating category returns 403 Forbidden');
  }

  // 3.5 Deactivate Category (Non-destructive)
  {
    const res = await request(server)
      .patch(`/api/categories/${newCatId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: CategoryStatus.inactive });

    assert(res.status === 200, '3.5 PATCH /api/categories/:id/status deactivates category');
    assert(res.body.data.status === CategoryStatus.inactive, 'Status is inactive');
  }

  // ==========================================
  // 4. NOTIFICATIONS MODULE TESTS
  // ==========================================
  console.log('\n--- SECTION 4: NOTIFICATIONS MODULE ---');
  let userNotificationId = '';

  // Seed sample in-app notifications
  {
    await mockPrismaService.notification.create({
      data: {
        userId: 'usr-employee-003',
        actorId: 'usr-admin-001',
        type: NotificationType.ticket_assigned,
        title: 'New Ticket Assigned',
        message: 'You have been assigned to #TKT-1042: Database latency spike',
      },
    });

    const notif2 = await mockPrismaService.notification.create({
      data: {
        userId: 'usr-employee-003',
        actorId: 'usr-agent-002',
        type: NotificationType.comment_added,
        title: 'New Comment Added',
        message: 'Liam Chen commented on #TKT-1042',
      },
    });
    userNotificationId = notif2.id;

    // Another user's notification
    await mockPrismaService.notification.create({
      data: {
        userId: 'usr-admin-001',
        actorId: 'usr-agent-002',
        type: NotificationType.status_changed,
        title: 'Status Updated',
        message: 'Ticket closed',
      },
    });
  }

  // 4.1 User lists notifications (strictly scoped to self)
  {
    const res = await request(server)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '4.1 GET /api/notifications returns 200 OK');
    assert(Array.isArray(res.body.data.items), 'Notifications items returned');
    assert(
      res.body.data.items.every((n: any) => n.userId === 'usr-employee-003'),
      'Notifications strictly scoped to authenticated user',
    );
    assert(res.body.data.unreadCount >= 2, 'Unread count reflects unread items');
  }

  // 4.2 Unread Count Endpoint
  {
    const res = await request(server)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '4.2 GET /api/notifications/unread-count returns 200 OK');
    assert(typeof res.body.data.unreadCount === 'number', 'unreadCount is number');
  }

  // 4.3 Mark Single Notification Read
  {
    const res = await request(server)
      .patch(`/api/notifications/${userNotificationId}/read`)
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '4.3 PATCH /api/notifications/:id/read marks as read');
    assert(res.body.data.isRead === true, 'isRead is true');
    assert(!!res.body.data.readAt, 'readAt timestamp set');
  }

  // 4.4 Non-owner cannot mark another user's notification as read
  {
    const res = await request(server)
      .patch(`/api/notifications/${userNotificationId}/read`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      res.status === 404,
      '4.4 Marking notification of another user returns 404 Not Found',
    );
  }

  // 4.5 Mark All Read
  {
    const res = await request(server)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '4.5 PATCH /api/notifications/read-all succeeds');

    const resUnread = await request(server)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(resUnread.body.data.unreadCount === 0, 'Unread count is 0 after read-all');
  }

  // ==========================================
  // 5. KNOWLEDGE BASE MODULE TESTS
  // ==========================================
  console.log('\n--- SECTION 5: KNOWLEDGE BASE MODULE ---');
  let articleId = '';

  // 5.1 Create Article (Agent or Admin)
  {
    const res = await request(server)
      .post('/api/knowledge-base')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        title: 'How to Configure WireGuard VPN Gateway',
        category: 'Network & Security',
        excerpt: 'Step-by-step guide to setting up secure corporate WireGuard tunnels.',
        content: 'Detailed instructions on generating private keys, configuring endpoint peers, and verifying routing tables...',
        keywords: ['wireguard', 'vpn', 'network', 'gateway'],
        readingTime: '4 min',
      });

    assert(res.status === 201, '5.1 POST /api/knowledge-base creates article (201 Created)');
    assert(res.body.data.title === 'How to Configure WireGuard VPN Gateway', 'Article title matches');
    assert(res.body.data.author.id === 'usr-agent-002', 'Author profile hydrated');
    assert(res.body.data.viewCount === 0, 'Initial viewCount is 0');
    articleId = res.body.data.id;
  }

  // 5.2 Employee blocked from creating article
  {
    const res = await request(server)
      .post('/api/knowledge-base')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Unauthorized Article',
        category: 'General',
        excerpt: 'Test',
        content: 'Test content',
      });

    assert(res.status === 403, '5.2 Employee creating article returns 403 Forbidden');
  }

  // 5.3 List and Search Articles
  {
    const res = await request(server)
      .get('/api/knowledge-base?search=wireguard')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '5.3 GET /api/knowledge-base search returns 200 OK');
    assert(res.body.data.length === 1, 'Search finds matching article');
    assert(res.body.data[0].id === articleId, 'Found article ID matches');
  }

  // 5.4 Categories Aggregation
  {
    const res = await request(server)
      .get('/api/knowledge-base/categories')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, '5.4 GET /api/knowledge-base/categories returns 200 OK');
    assert(Array.isArray(res.body.data), 'Categories returns array');
    assert(
      res.body.data.some((c: any) => c.category === 'Network & Security' && c.articleCount >= 1),
      'Category count includes created article',
    );
  }

  // 5.5 View Article & View Count Increment
  {
    const res1 = await request(server)
      .get(`/api/knowledge-base/${articleId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res1.status === 200, '5.5a GET /api/knowledge-base/:id retrieves article');
    assert(res1.body.data.viewCount === 1, 'viewCount incremented to 1');

    const res2 = await request(server)
      .get(`/api/knowledge-base/${articleId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res2.body.data.viewCount === 2, '5.5b Second retrieval increments viewCount to 2');
  }

  // 5.6 Update Article
  {
    const res = await request(server)
      .patch(`/api/knowledge-base/${articleId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        excerpt: 'Updated concise guide for corporate VPN tunnels.',
      });

    assert(res.status === 200, '5.6 PATCH /api/knowledge-base/:id updates article');
    assert(
      res.body.data.excerpt === 'Updated concise guide for corporate VPN tunnels.',
      'Excerpt updated',
    );
  }

  // 5.7 Toggle Publish State
  {
    const res = await request(server)
      .patch(`/api/knowledge-base/${articleId}/publish`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ isPublished: false });

    assert(res.status === 200, '5.7 PATCH /api/knowledge-base/:id/publish toggles published status');
    assert(res.body.data.isPublished === false, 'isPublished is false');
  }

  // 5.8 Delete Article (Admin only)
  {
    const resForbidden = await request(server)
      .delete(`/api/knowledge-base/${articleId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(resForbidden.status === 403, '5.8a Non-admin deleting article returns 403 Forbidden');

    const resAdmin = await request(server)
      .delete(`/api/knowledge-base/${articleId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(resAdmin.status === 200, '5.8b Admin deleting article succeeds (200 OK)');
  }

  console.log('\n===============================================================');
  console.log(`Results: ${passed}/${total} verification tests passed!`);
  console.log('===============================================================');

  if (passed !== total) {
    process.exit(1);
  }

  await app.close();
}

runOrgModulesVerification().catch((err) => {
  console.error('Org modules verification failed:', err);
  process.exit(1);
});

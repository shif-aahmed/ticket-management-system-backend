import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './src/app.module';
import { UsersService } from './src/users/users.service';
import { HttpExceptionFilter } from './src/common/filters/http-exception.filter';
import { TransformInterceptor } from './src/common/interceptors/transform.interceptor';
import { Role, UserStatus, User } from '@prisma/client';

async function runTestSuite() {
  console.log('\n========================================');
  console.log('   TICKETGO AUTH & RBAC VERIFICATION   ');
  console.log('========================================\n');

  const defaultPassword = 'TicketGo2024!';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

  // In-memory mock users representing the 3 TicketGo roles
  const mockUsers: Record<string, User> = {
    'alex.morgan@ticketgo.io': {
      id: 'usr-admin-001',
      email: 'alex.morgan@ticketgo.io',
      name: 'Alex Morgan',
      passwordHash,
      role: Role.administrator,
      status: UserStatus.active,
      department: 'IT & Security',
      title: 'IT Director',
      bio: null,
      avatarUrl: null,
      phone: '+1 (555) 234-5678',
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
      title: 'Senior Support Agent',
      bio: null,
      avatarUrl: null,
      phone: '+1 (555) 345-6789',
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
      title: 'Frontend Engineer',
      bio: null,
      avatarUrl: null,
      phone: '+1 (555) 456-7890',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(UsersService)
    .useValue({
      sanitizeUser: (user: User) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash: _, ...safe } = user;
        return safe;
      },
      findByEmailWithPassword: async (email: string) => {
        return mockUsers[email.toLowerCase().trim()] || null;
      },
      findByIdSafe: async (id: string) => {
        const found = Object.values(mockUsers).find((u) => u.id === id);
        if (!found) return null;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash: _, ...safe } = found;
        return safe;
      },
    })
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

  // 1. Admin Login
  {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'alex.morgan@ticketgo.io', password: defaultPassword });

    assert(res.status === 200, 'POST /api/auth/login returns 200 for Administrator');
    assert(!!res.body.data?.accessToken, 'Login response contains accessToken');
    assert(res.body.data?.user?.role === 'administrator', 'User role is administrator');
    assert(res.body.data?.user?.passwordHash === undefined, 'No passwordHash in response body');
    adminToken = res.body.data?.accessToken || '';
  }

  // 2. Agent Login
  {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'liam.chen@ticketgo.io', password: defaultPassword });

    assert(res.status === 200, 'POST /api/auth/login returns 200 for Agent');
    assert(res.body.data?.user?.role === 'agent', 'User role is agent');
    agentToken = res.body.data?.accessToken || '';
  }

  // 3. Employee Login
  {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'marcus.vance@ticketgo.io', password: defaultPassword });

    assert(res.status === 200, 'POST /api/auth/login returns 200 for Employee');
    assert(res.body.data?.user?.role === 'employee', 'User role is employee');
    employeeToken = res.body.data?.accessToken || '';
  }

  // 4. Invalid Password
  {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'alex.morgan@ticketgo.io', password: 'WrongPassword123!' });

    assert(res.status === 401, 'POST /api/auth/login rejects incorrect password with 401');
    assert(res.body.success === false, 'Error response has success: false');
  }

  // 5. Nonexistent Email
  {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'unknown@ticketgo.io', password: defaultPassword });

    assert(res.status === 401, 'POST /api/auth/login rejects nonexistent user with 401');
  }

  // 6. Validation Error (malformed payload)
  {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'short' });

    assert(res.status === 400, 'POST /api/auth/login returns 400 for malformed input');
  }

  // 7. GET /api/auth/me without token -> 401
  {
    const res = await request(server).get('/api/auth/me');
    assert(res.status === 401, 'GET /api/auth/me rejects unauthenticated request with 401');
  }

  // 8. GET /api/auth/me with invalid/tampered token -> 401
  {
    const res = await request(server)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer fake.invalid.token');

    assert(res.status === 401, 'GET /api/auth/me rejects invalid token with 401');
  }

  // 9. GET /api/auth/me with valid Admin token -> 200
  {
    const res = await request(server)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.status === 200, 'GET /api/auth/me returns 200 with valid JWT');
    assert(res.body.data?.email === 'alex.morgan@ticketgo.io', 'Profile email matches authenticated user');
    assert(res.body.data?.passwordHash === undefined, 'Profile does NOT expose passwordHash');
  }

  // 10. RBAC: Administrator accessing @Roles(Role.administrator) -> 200
  {
    const res = await request(server)
      .get('/api/auth/admin-check')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(res.status === 200, 'Admin can access @Roles(Role.administrator) endpoint');
    assert(res.body.data?.role === 'administrator', 'Admin role verified');
  }

  // 11. RBAC: Agent accessing @Roles(Role.administrator) -> 403 Forbidden
  {
    const res = await request(server)
      .get('/api/auth/admin-check')
      .set('Authorization', `Bearer ${agentToken}`);

    assert(res.status === 403, 'Agent receives 403 Forbidden on @Roles(Role.administrator) endpoint');
  }

  // 12. RBAC: Employee accessing @Roles(Role.administrator) -> 403 Forbidden
  {
    const res = await request(server)
      .get('/api/auth/admin-check')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 403, 'Employee receives 403 Forbidden on @Roles(Role.administrator) endpoint');
  }

  // 13. POST /api/auth/logout -> 200
  {
    const res = await request(server)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(res.status === 200, 'POST /api/auth/logout returns 200 OK');
  }

  // 14. Public health endpoint remains accessible without token
  {
    const res = await request(server).get('/api/health');
    assert(res.status === 200, 'GET /api/health remains publicly accessible (@Public)');
  }

  console.log(`\nResults: ${passed}/${total} checks passed.\n`);

  await app.close();
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

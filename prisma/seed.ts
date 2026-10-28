import { PrismaClient, Role, UserStatus, CategoryStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedUsersAndCategories() {
  console.log('Seeding demo users and categories for TicketGo...');
  const saltRounds = 10;
  const defaultPassword = 'TicketGo2024!';
  const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

  const demoUsers = [
    {
      email: 'alex.morgan@ticketgo.io',
      name: 'Alex Morgan',
      role: Role.administrator,
      status: UserStatus.active,
      department: 'IT & Security',
      phone: '+1 (555) 234-5678',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
    {
      email: 'liam.chen@ticketgo.io',
      name: 'Liam Chen',
      role: Role.agent,
      status: UserStatus.active,
      department: 'Customer Support',
      phone: '+1 (555) 345-6789',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    {
      email: 'marcus.vance@ticketgo.io',
      name: 'Marcus Vance',
      role: Role.employee,
      status: UserStatus.active,
      department: 'Engineering',
      phone: '+1 (555) 456-7890',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
  ];

  for (const user of demoUsers) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          ...user,
          passwordHash,
        },
      });
      console.log(`Created user: ${user.email} (${user.role})`);
    } else {
      console.log(`User already exists: ${user.email}`);
    }
  }

  const defaultCategories = [
    {
      name: 'Technical Support',
      description: 'Hardware diagnostics, OS troubleshooting, peripheral connection errors',
      departmentDefault: 'IT & Support',
    },
    {
      name: 'Software Development',
      description: 'Backend API implementation, service refactoring, database migrations',
      departmentDefault: 'Engineering',
    },
    {
      name: 'UI/UX Design',
      description: 'Design system components, screen flows, accessibility reviews',
      departmentDefault: 'Design',
    },
    {
      name: 'Account & Access',
      description: 'Okta SSO provisioning, role permission elevation, GitHub access',
      departmentDefault: 'IT & Support',
    },
    {
      name: 'Billing',
      description: 'Invoicing inquiries and vendor purchase requests',
      departmentDefault: 'Finance & Operations',
    },
    {
      name: 'General',
      description: 'General organizational and workspace inquiries',
      departmentDefault: 'Operations',
    },
  ];

  for (const cat of defaultCategories) {
    const existing = await prisma.category.findUnique({
      where: { name: cat.name },
    });

    if (!existing) {
      await prisma.category.create({
        data: {
          ...cat,
          status: CategoryStatus.active,
        },
      });
      console.log(`Created category: ${cat.name}`);
    }
  }

  console.log('Seed completed successfully.');
}

async function main() {
  try {
    await seedUsersAndCategories();
  } catch (e) {
    console.error('Error during seed execution:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

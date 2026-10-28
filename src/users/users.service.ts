import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Role, UserStatus, Prisma } from '@prisma/client';
import { UserSafeProfile } from '../auth/dto/auth-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Strips passwordHash and returns sanitized user profile
   */
  sanitizeUser(user: User): UserSafeProfile {
     
    const { passwordHash, ...safeUser } = user;
    return safeUser as UserSafeProfile;
  }

  /**
   * Finds user by email, returning complete record (including passwordHash for auth validation)
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  /**
   * Finds user by ID without returning passwordHash
   */
  async findByIdSafe(
    id: string,
    currentUser?: UserSafeProfile,
  ): Promise<UserSafeProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        teamMemberships: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                department: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (currentUser?.role === Role.employee && user.status !== 'active') {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.sanitizeUser(user);
  }

  /**
   * Scalable user listing with search, filtering, and pagination
   */
  async findUsers(query: QueryUsersDto, currentUser?: UserSafeProfile) {
    const {
      search,
      role,
      status,
      department,
      page = 1,
      limit = 10,
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role;
    }

    if (currentUser?.role === Role.employee) {
      // Employees may only view active users
      where.status = 'active';
    } else if (status) {
      where.status = status;
    }

    if (department && department !== 'all') {
      where.department = { equals: department, mode: 'insensitive' };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { department: { contains: term, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [rawUsers, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          teamMemberships: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  department: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = rawUsers.map((u) => this.sanitizeUser(u));
    const totalPages = Math.ceil(totalCount / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Administrative creation of a new user
   */
  async createUser(createDto: CreateUserDto): Promise<UserSafeProfile> {
    const existing = await this.findByEmailWithPassword(createDto.email);
    if (existing) {
      throw new ConflictException(
        `User with email '${createDto.email}' already exists`,
      );
    }

    const rawPassword = createDto.password || 'TicketGo2024!';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email: createDto.email.toLowerCase().trim(),
        passwordHash,
        name: createDto.name.trim(),
        role: createDto.role || Role.employee,
        status: createDto.status || UserStatus.active,
        department: createDto.department?.trim(),
        title: createDto.title?.trim(),
        phone: createDto.phone?.trim(),
        bio: createDto.bio?.trim(),
      },
    });

    this.logger.log(`Created user ${user.email} with role ${user.role}`);
    return this.sanitizeUser(user);
  }

  /**
   * Updates user profile with server-side authorization
   */
  async updateUser(
    id: string,
    updateDto: UpdateUserDto,
    currentUser: UserSafeProfile,
  ): Promise<UserSafeProfile> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    // Role & status changes require Administrator privileges
    if (
      (updateDto.role !== undefined || updateDto.status !== undefined) &&
      currentUser.role !== Role.administrator
    ) {
      throw new ForbiddenException(
        'Only administrators can modify user roles or account status',
      );
    }

    // Non-admin can only update their own profile
    if (currentUser.role !== Role.administrator && currentUser.id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: updateDto.name?.trim(),
        department: updateDto.department?.trim(),
        title: updateDto.title?.trim(),
        phone: updateDto.phone?.trim(),
        bio: updateDto.bio?.trim(),
        role: updateDto.role,
        status: updateDto.status,
      },
    });

    return this.sanitizeUser(updated);
  }

  /**
   * Administrative activation / deactivation of a user
   */
  async toggleStatus(
    id: string,
    status: UserStatus,
    currentUser: UserSafeProfile,
  ): Promise<UserSafeProfile> {
    if (currentUser.role !== Role.administrator) {
      throw new ForbiddenException('Only administrators can alter user status');
    }

    if (currentUser.id === id && status === UserStatus.inactive) {
      throw new ForbiddenException('Administrators cannot deactivate their own account');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    return this.sanitizeUser(updated);
  }

  /**
   * Count total users in database
   */
  async count(): Promise<number> {
    return this.prisma.user.count();
  }
}

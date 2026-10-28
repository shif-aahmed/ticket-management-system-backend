import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Team, Prisma } from '@prisma/client';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddTeamMemberDto } from './dto/add-member.dto';
import { QueryTeamsDto } from './dto/query-teams.dto';

const TEAM_INCLUDE_RELATIONS = {
  teamLead: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      role: true,
    },
  },
  members: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
          department: true,
          title: true,
        },
      },
    },
    orderBy: { joinedAt: 'asc' as const },
  },
  _count: {
    select: {
      members: true,
    },
  },
};

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new team with unique name
   */
  async createTeam(createDto: CreateTeamDto): Promise<Team> {
    const existing = await this.prisma.team.findUnique({
      where: { name: createDto.name.trim() },
    });

    if (existing) {
      throw new ConflictException(
        `Team with name '${createDto.name}' already exists`,
      );
    }

    if (createDto.teamLeadId) {
      const lead = await this.prisma.user.findUnique({
        where: { id: createDto.teamLeadId },
      });
      if (!lead) {
        throw new BadRequestException(
          `Team lead user with ID '${createDto.teamLeadId}' not found`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: createDto.name.trim(),
          description: createDto.description?.trim(),
          department: createDto.department?.trim(),
          teamLeadId: createDto.teamLeadId || null,
          colorClass: createDto.colorClass,
          bgClass: createDto.bgClass,
        },
        include: TEAM_INCLUDE_RELATIONS,
      });

      // Automatically add team lead as first member if specified
      if (createDto.teamLeadId) {
        await tx.teamMember.create({
          data: {
            teamId: team.id,
            userId: createDto.teamLeadId,
            role: 'lead',
          },
        });
      }

      this.logger.log(`Created team '${team.name}' (${team.id})`);
      return team;
    });
  }

  /**
   * Lists teams with search and department filtering
   */
  async findTeams(query: QueryTeamsDto) {
    const where: Prisma.TeamWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.department && query.department !== 'all') {
      where.department = { equals: query.department, mode: 'insensitive' };
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { department: { contains: term, mode: 'insensitive' } },
      ];
    }

    return this.prisma.team.findMany({
      where,
      orderBy: { name: 'asc' },
      include: TEAM_INCLUDE_RELATIONS,
    });
  }

  /**
   * Retrieves single team details by ID
   */
  async findById(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: TEAM_INCLUDE_RELATIONS,
    });

    if (!team) {
      throw new NotFoundException(`Team with ID '${id}' not found`);
    }

    return team;
  }

  /**
   * Updates team metadata
   */
  async updateTeam(id: string, updateDto: UpdateTeamDto): Promise<Team> {
    const team = await this.findById(id);

    if (updateDto.name && updateDto.name.trim()) {
      const existing = await this.prisma.team.findUnique({
        where: { name: updateDto.name.trim() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Team with name '${updateDto.name}' already exists`,
        );
      }
    }

    if (updateDto.teamLeadId) {
      const lead = await this.prisma.user.findUnique({
        where: { id: updateDto.teamLeadId },
      });
      if (!lead) {
        throw new BadRequestException(
          `Team lead user with ID '${updateDto.teamLeadId}' not found`,
        );
      }
    }

    return this.prisma.team.update({
      where: { id: team.id },
      data: {
        name: updateDto.name?.trim(),
        description: updateDto.description?.trim(),
        department: updateDto.department?.trim(),
        teamLeadId: updateDto.teamLeadId,
        colorClass: updateDto.colorClass,
        bgClass: updateDto.bgClass,
        isActive: updateDto.isActive,
      },
      include: TEAM_INCLUDE_RELATIONS,
    });
  }

  /**
   * Adds member to a team, enforcing duplicate membership prevention
   */
  async addMember(teamId: string, memberDto: AddTeamMemberDto) {
    await this.findById(teamId);

    const user = await this.prisma.user.findUnique({
      where: { id: memberDto.userId },
    });
    if (!user) {
      throw new BadRequestException(
        `User with ID '${memberDto.userId}' does not exist`,
      );
    }

    const existingMembership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: memberDto.userId,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this team');
    }

    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId: memberDto.userId,
        role: memberDto.role || 'member',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
            department: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Removes member from a team
   */
  async removeMember(teamId: string, userId: string) {
    await this.findById(teamId);

    const existingMembership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (!existingMembership) {
      throw new NotFoundException('User is not a member of this team');
    }

    await this.prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    return { message: 'Member successfully removed from team' };
  }

  /**
   * Toggles team active state
   */
  async toggleStatus(id: string, isActive: boolean): Promise<Team> {
    await this.findById(id);

    return this.prisma.team.update({
      where: { id },
      data: { isActive },
      include: TEAM_INCLUDE_RELATIONS,
    });
  }
}

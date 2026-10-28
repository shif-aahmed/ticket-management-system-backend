import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Role,
  Ticket,
  TicketActivityType,
  TicketPriority,
  TicketStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { UserSafeProfile } from '../auth/dto/auth-response.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { validateStatusTransition } from './ticket-lifecycle';

const TICKET_INCLUDE_RELATIONS = {
  requester: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      department: true,
      role: true,
    },
  },
  assignee: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      department: true,
      role: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      departmentDefault: true,
    },
  },
  _count: {
    select: {
      comments: true,
      attachments: true,
    },
  },
};

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves canonical categoryId from category model
   */
  private async resolveCategoryId(
    categoryId?: string,
  ): Promise<string | undefined> {
    if (!categoryId) return undefined;

    const existing = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!existing) {
      throw new BadRequestException(
        `Category with ID '${categoryId}' does not exist`,
      );
    }
    return existing.id;
  }

  /**
   * Generates sequential ticket code strictly monotonically without collision
   */
  private async generateTicketCode(): Promise<string> {
    const recentTickets = await this.prisma.ticket.findMany({
      select: { code: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let maxNum = 1000;
    for (const t of recentTickets) {
      const match = t.code.match(/#?TKT-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    let candidateNum = maxNum + 1;
    while (true) {
      const candidateCode = `#TKT-${candidateNum}`;
      const exists = await this.prisma.ticket.findUnique({
        where: { code: candidateCode },
        select: { id: true },
      });
      if (!exists) {
        return candidateCode;
      }
      candidateNum++;
    }
  }

  /**
   * Verifies user has access permissions to the ticket
   */
  private verifyAccess(ticket: Ticket, user: UserSafeProfile): void {
    if (user.role === Role.administrator || user.role === Role.agent) {
      return;
    }

    // Employees can only access their own tickets
    if (ticket.requesterId !== user.id && ticket.assigneeId !== user.id) {
      throw new ForbiddenException('You do not have permission to access this ticket');
    }
  }

  /**
   * Creates a new ticket atomically with initial activity and attachments
   */
  async createTicket(
    createDto: CreateTicketDto,
    currentUser: UserSafeProfile,
  ): Promise<Ticket> {
    const categoryId = await this.resolveCategoryId(createDto.categoryId);

    // Validate assignee if provided
    let assigneeId: string | null = null;
    if (createDto.assigneeId && createDto.assigneeId !== 'unassigned') {
      const assignee = await this.prisma.user.findUnique({
        where: { id: createDto.assigneeId },
      });
      if (!assignee) {
        throw new BadRequestException(
          `Assignee user with ID '${createDto.assigneeId}' not found`,
        );
      }
      assigneeId = assignee.id;
    }

    // Employees cannot assign tickets directly upon creation
    if (currentUser.role === Role.employee && assigneeId) {
      assigneeId = null;
    }

    const code = await this.generateTicketCode();

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          code,
          subject: createDto.subject.trim(),
          description: createDto.description?.trim(),
          type: createDto.type,
          priority: createDto.priority,
          status: TicketStatus.submitted,
          department: createDto.department,
          project: createDto.project,
          dueDate: createDto.dueDate ? new Date(createDto.dueDate) : null,
          requesterId: currentUser.id,
          assigneeId,
          categoryId,
          attachments:
            createDto.attachments && createDto.attachments.length > 0
              ? {
                  create: createDto.attachments.map((att) => ({
                    filename: att.filename,
                    mimeType: att.mimeType,
                    size: att.size,
                    storageKey: att.storageKey,
                    uploaderId: currentUser.id,
                  })),
                }
              : undefined,
        },
        include: TICKET_INCLUDE_RELATIONS,
      });

      // Create initial activity record
      await tx.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          actorId: currentUser.id,
          type: TicketActivityType.created,
          description: `Ticket created by ${currentUser.name} (${currentUser.role})`,
        },
      });

      // If assigned at creation, log assignment activity and dispatch notification
      if (assigneeId) {
        await tx.ticketActivity.create({
          data: {
            ticketId: ticket.id,
            actorId: currentUser.id,
            type: TicketActivityType.assigned,
            description: `Assigned upon creation`,
          },
        });

        if (assigneeId !== currentUser.id) {
          await tx.notification.create({
            data: {
              userId: assigneeId,
              actorId: currentUser.id,
              ticketId: ticket.id,
              type: NotificationType.ticket_assigned,
              title: 'Ticket Assigned',
              message: `You were assigned to ticket ${ticket.code}: ${ticket.subject}`,
            },
          });
        }
      }

      this.logger.log(
        `Ticket ${ticket.code} created successfully by ${currentUser.email}`,
      );
      return ticket;
    });
  }

  /**
   * Scalable list tickets with database filtering, search, pagination, and sorting
   */
  async findTickets(
    queryDto: QueryTicketsDto,
    currentUser: UserSafeProfile,
  ) {
    const {
      search,
      status,
      priority,
      type,
      department,
      category,
      assigneeId,
      requesterId,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;

    const where: Prisma.TicketWhereInput = {};

    // RBAC: Employees can ONLY view tickets they requested or are assigned to
    if (currentUser.role === Role.employee) {
      where.OR = [
        { requesterId: currentUser.id },
        { assigneeId: currentUser.id },
      ];
    }

    // Search in subject, description, and code
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: [
            { subject: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { code: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (type) {
      where.type = type;
    }

    if (department && department !== 'all') {
      where.department = { equals: department, mode: 'insensitive' };
    }

    if (category && category !== 'all') {
      where.category = {
        name: { equals: category, mode: 'insensitive' },
      };
    }

    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        where.assigneeId = null;
      } else {
        where.assigneeId = assigneeId;
      }
    }

    if (requesterId) {
      where.requesterId = requesterId;
    }

    const skip = (page - 1) * limit;

    const [items, totalCount] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: TICKET_INCLUDE_RELATIONS,
      }),
      this.prisma.ticket.count({ where }),
    ]);

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
   * Finds ticket by UUID or Ticket Code (e.g. '#TKT-1001' or 'TKT-1001')
   */
  async findByIdOrCode(
    identifier: string,
    currentUser: UserSafeProfile,
  ) {
    const decoded = decodeURIComponent(identifier).trim();
    const cleanCode = decoded.startsWith('#') ? decoded : `#${decoded}`;

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: [
          { id: decoded },
          { code: decoded },
          { code: cleanCode },
        ],
      },
      include: {
        ...TICKET_INCLUDE_RELATIONS,
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        attachments: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket '${identifier}' not found`);
    }

    this.verifyAccess(ticket, currentUser);
    return ticket;
  }

  /**
   * Updates ticket fields atomically with activity logging and notifications
   */
  async updateTicket(
    identifier: string,
    updateDto: UpdateTicketDto,
    currentUser: UserSafeProfile,
  ) {
    const ticket = await this.findByIdOrCode(identifier, currentUser);

    // Employees cannot update operational tickets unless they are the requester
    if (currentUser.role === Role.employee) {
      if (ticket.requesterId !== currentUser.id) {
        throw new ForbiddenException('Employees can only modify tickets they requested');
      }
      if (updateDto.status || updateDto.assigneeId !== undefined) {
        throw new ForbiddenException(
          'Employees cannot reassign tickets or arbitrarily change operational status',
        );
      }
    }

    let categoryId: string | undefined;
    if (updateDto.categoryId) {
      categoryId = await this.resolveCategoryId(updateDto.categoryId);
    }

    if (updateDto.status) {
      validateStatusTransition(ticket.status, updateDto.status);
    }

    let nextAssigneeId: string | null | undefined = undefined;
    if (updateDto.assigneeId !== undefined) {
      if (updateDto.assigneeId === null || updateDto.assigneeId === 'unassigned') {
        nextAssigneeId = null;
      } else {
        const assignee = await this.prisma.user.findUnique({
          where: { id: updateDto.assigneeId },
        });
        if (!assignee) {
          throw new BadRequestException(
            `Assignee user with ID '${updateDto.assigneeId}' not found`,
          );
        }
        nextAssigneeId = assignee.id;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          subject: updateDto.subject?.trim(),
          description: updateDto.description?.trim(),
          type: updateDto.type,
          priority: updateDto.priority,
          status: updateDto.status,
          department: updateDto.department,
          project: updateDto.project,
          dueDate: updateDto.dueDate ? new Date(updateDto.dueDate) : undefined,
          categoryId,
          assigneeId: nextAssigneeId,
        },
        include: TICKET_INCLUDE_RELATIONS,
      });

      // Log status change if applicable
      if (updateDto.status && updateDto.status !== ticket.status) {
        await tx.ticketActivity.create({
          data: {
            ticketId: ticket.id,
            actorId: currentUser.id,
            type: TicketActivityType.status_updated,
            description: `Status changed from ${ticket.status} to ${updateDto.status}`,
          },
        });

        // Notify relevant parties
        const recipients = new Set([ticket.requesterId, ticket.assigneeId].filter(Boolean) as string[]);
        recipients.delete(currentUser.id);
        for (const recipientId of recipients) {
          await tx.notification.create({
            data: {
              userId: recipientId,
              actorId: currentUser.id,
              ticketId: ticket.id,
              type: NotificationType.status_changed,
              title: 'Ticket Status Updated',
              message: `Ticket ${ticket.code} status changed to ${updateDto.status}`,
            },
          });
        }
      }

      // Log priority change if applicable
      if (updateDto.priority && updateDto.priority !== ticket.priority) {
        await tx.ticketActivity.create({
          data: {
            ticketId: ticket.id,
            actorId: currentUser.id,
            type: TicketActivityType.priority_changed,
            description: `Priority updated from ${ticket.priority} to ${updateDto.priority}`,
          },
        });

        if (ticket.assigneeId && ticket.assigneeId !== currentUser.id) {
          await tx.notification.create({
            data: {
              userId: ticket.assigneeId,
              actorId: currentUser.id,
              ticketId: ticket.id,
              type: NotificationType.priority_changed,
              title: 'Ticket Priority Changed',
              message: `Priority for ticket ${ticket.code} was changed to ${updateDto.priority}`,
            },
          });
        }
      }

      // Log due date change if applicable
      if (
        updateDto.dueDate !== undefined &&
        (updateDto.dueDate === null
          ? ticket.dueDate !== null
          : !ticket.dueDate || new Date(updateDto.dueDate).getTime() !== new Date(ticket.dueDate).getTime())
      ) {
        await tx.ticketActivity.create({
          data: {
            ticketId: ticket.id,
            actorId: currentUser.id,
            type: TicketActivityType.due_date_changed,
            description: updateDto.dueDate
              ? `Due date changed to ${updateDto.dueDate}`
              : 'Due date removed',
          },
        });
      }

      // Log assignment change if applicable
      if (nextAssigneeId !== undefined && nextAssigneeId !== ticket.assigneeId) {
        await tx.ticketActivity.create({
          data: {
            ticketId: ticket.id,
            actorId: currentUser.id,
            type: TicketActivityType.assigned,
            description: nextAssigneeId
              ? `Reassigned to ${updated.assignee?.name || nextAssigneeId}`
              : 'Unassigned ticket',
          },
        });

        if (nextAssigneeId && nextAssigneeId !== currentUser.id) {
          await tx.notification.create({
            data: {
              userId: nextAssigneeId,
              actorId: currentUser.id,
              ticketId: ticket.id,
              type: NotificationType.ticket_assigned,
              title: 'Ticket Assigned',
              message: `You were assigned to ticket ${ticket.code}: ${ticket.subject}`,
            },
          });
        }
      }

      // General update activity
      await tx.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          actorId: currentUser.id,
          type: TicketActivityType.updated,
          description: `Ticket details updated by ${currentUser.name}`,
        },
      });

      return updated;
    });
  }

  /**
   * Changes ticket status with lifecycle validation and notifications
   */
  async changeStatus(
    identifier: string,
    statusDto: ChangeStatusDto,
    currentUser: UserSafeProfile,
  ) {
    const ticket = await this.findByIdOrCode(identifier, currentUser);

    // Employees cannot change status unless closing their own ticket
    if (currentUser.role === Role.employee) {
      if (
        statusDto.status !== TicketStatus.closed ||
        ticket.requesterId !== currentUser.id
      ) {
        throw new ForbiddenException(
          'Employees may only close their own submitted tickets',
        );
      }
    }

    validateStatusTransition(ticket.status, statusDto.status);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: statusDto.status },
        include: TICKET_INCLUDE_RELATIONS,
      });

      await tx.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          actorId: currentUser.id,
          type: TicketActivityType.status_updated,
          description: `Status changed from ${ticket.status} to ${statusDto.status}`,
          comment: statusDto.comment,
        },
      });

      // Dispatch notifications
      const recipients = new Set([ticket.requesterId, ticket.assigneeId].filter(Boolean) as string[]);
      recipients.delete(currentUser.id);
      for (const recipientId of recipients) {
        await tx.notification.create({
          data: {
            userId: recipientId,
            actorId: currentUser.id,
            ticketId: ticket.id,
            type: NotificationType.status_changed,
            title: 'Ticket Status Updated',
            message: `Ticket ${ticket.code} moved to ${statusDto.status}`,
          },
        });
      }

      return updated;
    });
  }

  /**
   * Assigns or reassigns a ticket
   */
  async assignTicket(
    identifier: string,
    assignDto: AssignTicketDto,
    currentUser: UserSafeProfile,
  ) {
    if (currentUser.role === Role.employee) {
      throw new ForbiddenException('Employees are not authorized to assign tickets');
    }

    const ticket = await this.findByIdOrCode(identifier, currentUser);

    let nextAssigneeId: string | null = null;
    let assigneeName = 'Unassigned';

    if (assignDto.assigneeId && assignDto.assigneeId !== 'unassigned') {
      const assignee = await this.prisma.user.findUnique({
        where: { id: assignDto.assigneeId },
      });
      if (!assignee) {
        throw new BadRequestException(
          `Assignee user with ID '${assignDto.assigneeId}' not found`,
        );
      }
      nextAssigneeId = assignee.id;
      assigneeName = assignee.name;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: { assigneeId: nextAssigneeId },
        include: TICKET_INCLUDE_RELATIONS,
      });

      await tx.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          actorId: currentUser.id,
          type: TicketActivityType.assigned,
          description: nextAssigneeId
            ? `Assigned to ${assigneeName}`
            : 'Ticket unassigned',
        },
      });

      if (nextAssigneeId && nextAssigneeId !== currentUser.id) {
        await tx.notification.create({
          data: {
            userId: nextAssigneeId,
            actorId: currentUser.id,
            ticketId: ticket.id,
            type: NotificationType.ticket_assigned,
            title: 'Ticket Assigned',
            message: `You were assigned to ticket ${ticket.code}: ${ticket.subject}`,
          },
        });
      }

      return updated;
    });
  }

  /**
   * Adds a comment to the ticket with activity and notifications
   */
  async addComment(
    identifier: string,
    commentDto: CreateCommentDto,
    currentUser: UserSafeProfile,
  ) {
    const ticket = await this.findByIdOrCode(identifier, currentUser);

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.ticketComment.create({
        data: {
          ticketId: ticket.id,
          authorId: currentUser.id,
          content: commentDto.content.trim(),
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      });

      await tx.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          actorId: currentUser.id,
          type: TicketActivityType.comment_added,
          description: `Comment added by ${currentUser.name}`,
          comment: commentDto.content.trim().slice(0, 100),
        },
      });

      // Dispatch notifications to requester and assignee
      const recipients = new Set([ticket.requesterId, ticket.assigneeId].filter(Boolean) as string[]);
      recipients.delete(currentUser.id);
      for (const recipientId of recipients) {
        await tx.notification.create({
          data: {
            userId: recipientId,
            actorId: currentUser.id,
            ticketId: ticket.id,
            type: NotificationType.comment_added,
            title: 'New Comment on Ticket',
            message: `${currentUser.name} commented on ticket ${ticket.code}`,
          },
        });
      }

      return comment;
    });
  }

  /**
   * Retrieves activity history for a ticket
   */
  async getActivityHistory(
    identifier: string,
    currentUser: UserSafeProfile,
  ) {
    const ticket = await this.findByIdOrCode(identifier, currentUser);

    return this.prisma.ticketActivity.findMany({
      where: { ticketId: ticket.id },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

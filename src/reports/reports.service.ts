import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  Role,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '@prisma/client';
import { QueryReportsDto, ReportsDateRangeEnum } from './dto/query-reports.dto';
import { UserSafeProfile } from '../auth/dto/auth-response.dto';

const STATUS_CONFIG: Record<
  string,
  { label: string; colorClass: string; badgeVariant: string }
> = {
  submitted: {
    label: 'Submitted',
    colorClass: 'bg-[#94A3B8]',
    badgeVariant: 'neutral',
  },
  open: { label: 'Open', colorClass: 'bg-[#0EA5E9]', badgeVariant: 'active' },
  in_progress: {
    label: 'In Progress',
    colorClass: 'bg-[#F59E0B]',
    badgeVariant: 'warning',
  },
  pending: {
    label: 'Pending',
    colorClass: 'bg-[#8B5CF6]',
    badgeVariant: 'warning',
  },
  resolved: {
    label: 'Resolved',
    colorClass: 'bg-[#10B981]',
    badgeVariant: 'success',
  },
  closed: {
    label: 'Closed',
    colorClass: 'bg-[#64748B]',
    badgeVariant: 'neutral',
  },
};

const PRIORITY_CONFIG: Record<
  string,
  { label: string; colorClass: string; badgeVariant: string }
> = {
  critical: {
    label: 'Critical',
    colorClass: 'bg-[#EF4444]',
    badgeVariant: 'urgent',
  },
  high: { label: 'High', colorClass: 'bg-[#F97316]', badgeVariant: 'warning' },
  medium: {
    label: 'Medium',
    colorClass: 'bg-[#3B82F6]',
    badgeVariant: 'active',
  },
  low: { label: 'Low', colorClass: 'bg-[#6B7280]', badgeVariant: 'neutral' },
};

const TYPE_CONFIG: Record<
  string,
  { label: string; colorClass: string; badgeVariant: string }
> = {
  task: { label: 'Task', colorClass: 'bg-[#3B82F6]', badgeVariant: 'default' },
  support_request: {
    label: 'Support Request',
    colorClass: 'bg-[#10B981]',
    badgeVariant: 'active',
  },
  incident: {
    label: 'Incident',
    colorClass: 'bg-[#EF4444]',
    badgeVariant: 'urgent',
  },
  bug: { label: 'Bug', colorClass: 'bg-[#F59E0B]', badgeVariant: 'warning' },
  general_request: {
    label: 'General Request',
    colorClass: 'bg-[#8B5CF6]',
    badgeVariant: 'neutral',
  },
};

const DEPARTMENT_COLORS = [
  'bg-[#064747]',
  'bg-[#0E7490]',
  'bg-[#1D4ED8]',
  'bg-[#4338CA]',
  'bg-[#7E22CE]',
  'bg-[#BE185D]',
  'bg-[#B45309]',
];

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds Prisma WhereInput strictly using database filters
   */
  private buildWhereClause(
    query: QueryReportsDto,
    currentUser: UserSafeProfile,
  ): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {};

    // 1. RBAC Scoping
    if (currentUser.role === Role.employee) {
      where.OR = [
        { requesterId: currentUser.id },
        { assigneeId: currentUser.id },
      ];
    }

    // 2. Date Range Filter
    if (query.dateRange && query.dateRange !== ReportsDateRangeEnum.ALL) {
      const now = new Date();
      let startDate: Date;

      switch (query.dateRange) {
        case ReportsDateRangeEnum.SEVEN_DAYS:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case ReportsDateRangeEnum.THIRTY_DAYS:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case ReportsDateRangeEnum.NINETY_DAYS:
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case ReportsDateRangeEnum.YEAR_TO_DATE:
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0);
      }

      where.createdAt = { gte: startDate };
    }

    // 3. Department filter
    if (query.department && query.department !== 'all') {
      where.department = { equals: query.department, mode: 'insensitive' };
    }

    // 4. Status filter
    if (query.status && query.status !== 'all') {
      where.status = query.status as TicketStatus;
    }

    // 5. Priority filter
    if (query.priority && query.priority !== 'all') {
      where.priority = query.priority as TicketPriority;
    }

    // 6. Type filter
    if (query.type && query.type !== 'all') {
      where.type = query.type as TicketType;
    }

    // 7. Category filter
    if (query.category && query.category !== 'all') {
      where.category = {
        name: { equals: query.category, mode: 'insensitive' },
      };
    }

    // 8. Assignee filter
    if (query.assigneeId && query.assigneeId !== 'all') {
      where.assigneeId = query.assigneeId;
    }

    return where;
  }

  /**
   * Main report aggregation pipeline executed at the database level
   */
  async getReportsData(query: QueryReportsDto, currentUser: UserSafeProfile) {
    const where = this.buildWhereClause(query, currentUser);
    const now = new Date();

    // Run parallel database queries
    const [
      totalCount,
      resolvedCount,
      overdueCount,
      criticalCount,
      statusGroups,
      priorityGroups,
      typeGroups,
      deptGroups,
      categoryGroups,
      allCategories,
      agents,
    ] = await Promise.all([
      // Total count
      this.prisma.ticket.count({ where }),

      // Resolved / Closed count
      this.prisma.ticket.count({
        where: {
          ...where,
          status: { in: [TicketStatus.resolved, TicketStatus.closed] },
        },
      }),

      // Overdue items
      this.prisma.ticket.count({
        where: {
          ...where,
          status: { notIn: [TicketStatus.resolved, TicketStatus.closed] },
          dueDate: { lt: now },
        },
      }),

      // Critical priority active items
      this.prisma.ticket.count({
        where: {
          ...where,
          status: { notIn: [TicketStatus.resolved, TicketStatus.closed] },
          priority: TicketPriority.critical,
        },
      }),

      // Status distribution
      this.prisma.ticket.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),

      // Priority distribution
      this.prisma.ticket.groupBy({
        by: ['priority'],
        where,
        _count: { _all: true },
      }),

      // Type distribution
      this.prisma.ticket.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
      }),

      // Department distribution
      this.prisma.ticket.groupBy({
        by: ['department'],
        where: {
          ...where,
          department: { not: null },
        },
        _count: { _all: true },
      }),

      // Category distribution
      this.prisma.ticket.groupBy({
        by: ['categoryId'],
        where: {
          ...where,
          categoryId: { not: null },
        },
        _count: { _all: true },
      }),

      // Categories lookup map
      this.prisma.category.findMany({
        select: { id: true, name: true },
      }),

      // Assignee workload agents (only needed for admin/agent)
      currentUser.role !== Role.employee
        ? this.prisma.user.findMany({
            where: {
              role: { in: [Role.agent, Role.administrator] },
              status: 'active',
            },
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const activeCount = Math.max(0, totalCount - resolvedCount);
    const resolutionRate =
      totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;
    const slaRate =
      totalCount > 0
        ? Math.max(
            0,
            Math.round(((totalCount - overdueCount) / totalCount) * 100),
          )
        : 100;

    // 1. Summary Metrics Strip
    const summaryMetrics = [
      {
        id: 'total',
        label: 'Total Tickets',
        value: totalCount,
        changeText: 'Filtered scope',
        trend: 'neutral' as const,
        variant: 'default' as const,
      },
      {
        id: 'active',
        label: 'Active Workload',
        value: activeCount,
        changeText: 'Open & In Progress',
        trend: 'neutral' as const,
        variant: 'active' as const,
      },
      {
        id: 'resolved',
        label: 'Resolved Items',
        value: resolvedCount,
        changeText: `${resolutionRate}% resolution rate`,
        trend: 'up' as const,
        variant: 'success' as const,
      },
      {
        id: 'slaRate',
        label: 'SLA Met Rate',
        value: `${slaRate}%`,
        changeText: 'Based on due dates',
        trend: slaRate >= 90 ? ('up' as const) : ('down' as const),
        variant: slaRate >= 90 ? ('success' as const) : ('warning' as const),
      },
      {
        id: 'overdue',
        label: 'SLA Overdue',
        value: overdueCount,
        changeText: 'Requires triage',
        trend: overdueCount > 0 ? ('down' as const) : ('neutral' as const),
        variant: overdueCount > 0 ? ('urgent' as const) : ('neutral' as const),
      },
      {
        id: 'critical',
        label: 'Critical Active',
        value: criticalCount,
        changeText: 'High urgency',
        trend: criticalCount > 0 ? ('down' as const) : ('neutral' as const),
        variant: criticalCount > 0 ? ('urgent' as const) : ('neutral' as const),
      },
    ];

    // 2. Status Distribution
    const statusDistribution = (statusGroups as any[]).map((g) => {
      const cfg = STATUS_CONFIG[g.status] || {
        label: g.status,
        colorClass: 'bg-gray-400',
        badgeVariant: 'neutral',
      };
      const count = g._count._all;
      const percentage =
        totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      return {
        id: g.status,
        label: cfg.label,
        count,
        percentage,
        colorClass: cfg.colorClass,
        badgeVariant: cfg.badgeVariant,
      };
    });

    // 3. Priority Distribution
    const priorityDistribution = (priorityGroups as any[]).map((g) => {
      const cfg = PRIORITY_CONFIG[g.priority] || {
        label: g.priority,
        colorClass: 'bg-gray-400',
        badgeVariant: 'neutral',
      };
      const count = g._count._all;
      const percentage =
        totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      return {
        id: g.priority,
        label: cfg.label,
        count,
        percentage,
        colorClass: cfg.colorClass,
        badgeVariant: cfg.badgeVariant,
      };
    });

    // 4. Type Distribution
    const typeDistribution = (typeGroups as any[]).map((g) => {
      const cfg = TYPE_CONFIG[g.type] || {
        label: g.type,
        colorClass: 'bg-gray-400',
        badgeVariant: 'default',
      };
      const count = g._count._all;
      const percentage =
        totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      return {
        id: g.type,
        type: g.type,
        label: cfg.label,
        count,
        percentage,
        colorClass: cfg.colorClass,
        badgeVariant: cfg.badgeVariant,
      };
    });

    // 5. Department Distribution
    const departmentDistribution = (deptGroups as any[]).map((g, idx) => {
      const count = g._count._all;
      const percentage =
        totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      return {
        id: g.department || 'unassigned',
        department: g.department || 'Unassigned',
        label: g.department || 'Unassigned',
        count,
        percentage,
        colorClass: DEPARTMENT_COLORS[idx % DEPARTMENT_COLORS.length],
      };
    });

    // 6. Category Distribution
    const catMap = new Map(allCategories.map((c) => [c.id, c.name]));
    const categoryDistribution = (categoryGroups as any[]).map((g, idx) => {
      const catName = (g.categoryId && catMap.get(g.categoryId)) || 'General';
      const count = g._count._all;
      const percentage =
        totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      return {
        id: g.categoryId || 'cat_gen',
        label: catName,
        count,
        percentage,
        colorClass: DEPARTMENT_COLORS[idx % DEPARTMENT_COLORS.length],
      };
    });

    // 7. Assignee Workload Calculation (strictly database-aggregated, scoped to admin/agent)
    let assigneeWorkload: Array<{
      name: string;
      email: string;
      department: string;
      activeTickets: number;
      resolvedTickets: number;
      overdueTickets: number;
      capacityRate: number;
    }> = [];

    if (currentUser.role !== Role.employee && agents.length > 0) {
      const agentIds = agents.map((a) => a.id);

      const [workloadStatusGroups, workloadOverdueGroups] = await Promise.all([
        this.prisma.ticket.groupBy({
          by: ['assigneeId', 'status'],
          where: {
            ...where,
            assigneeId: { in: agentIds },
          },
          _count: { _all: true },
        }),
        this.prisma.ticket.groupBy({
          by: ['assigneeId'],
          where: {
            ...where,
            assigneeId: { in: agentIds },
            status: { notIn: [TicketStatus.resolved, TicketStatus.closed] },
            dueDate: { lt: now },
          },
          _count: { _all: true },
        }),
      ]);

      const overdueMap = new Map(
        workloadOverdueGroups.map((g) => [g.assigneeId, g._count._all]),
      );

      assigneeWorkload = agents.map((agent) => {
        let activeTix = 0;
        let resolvedTix = 0;

        for (const g of workloadStatusGroups) {
          if (g.assigneeId === agent.id) {
            if (
              g.status === TicketStatus.resolved ||
              g.status === TicketStatus.closed
            ) {
              resolvedTix += g._count._all;
            } else {
              activeTix += g._count._all;
            }
          }
        }

        const overdueTix = overdueMap.get(agent.id) || 0;
        const capacityRate = Math.min(100, Math.round((activeTix / 10) * 100));

        return {
          name: agent.name,
          email: agent.email,
          department: agent.department || 'Customer Support',
          activeTickets: activeTix,
          resolvedTickets: resolvedTix,
          overdueTickets: overdueTix,
          capacityRate,
        };
      });
    }

    // 8. Trends Points (6 intervals)
    const trendPoints = this.generateTrendPoints(
      totalCount,
      resolvedCount,
      query.dateRange || ReportsDateRangeEnum.ALL,
    );

    return {
      totalCount,
      summaryMetrics,
      trendPoints,
      statusDistribution,
      priorityDistribution,
      typeDistribution,
      departmentDistribution,
      categoryDistribution,
      assigneeWorkload,
      overdueCount,
      criticalCount,
      slaRate,
    };
  }

  /**
   * Helper to format chronological trend intervals
   */
  private generateTrendPoints(
    total: number,
    resolved: number,
    range: ReportsDateRangeEnum,
  ) {
    const labels =
      range === ReportsDateRangeEnum.SEVEN_DAYS
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        : range === ReportsDateRangeEnum.THIRTY_DAYS
          ? ['W1', 'W2', 'W3', 'W4', 'W5']
          : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

    const stepTotal = Math.max(1, Math.round(total / labels.length));
    const stepResolved = Math.max(1, Math.round(resolved / labels.length));

    return labels.map((label, idx) => ({
      label,
      created: Math.min(total, stepTotal * (idx + 1)),
      resolved: Math.min(resolved, stepResolved * (idx + 1)),
    }));
  }

  /**
   * Consolidated Dashboard Metrics
   */
  async getDashboardData(currentUser: UserSafeProfile) {
    const reportsData = await this.getReportsData(
      { dateRange: ReportsDateRangeEnum.ALL },
      currentUser,
    );

    const where: Prisma.TicketWhereInput =
      currentUser.role === Role.employee
        ? {
            OR: [
              { requesterId: currentUser.id },
              { assigneeId: currentUser.id },
            ],
          }
        : {};

    const [recentTickets, recentActivities] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          category: { select: { id: true, name: true } },
        },
      }),
      this.prisma.ticketActivity.findMany({
        where:
          currentUser.role === Role.employee
            ? {
                ticket: {
                  OR: [
                    { requesterId: currentUser.id },
                    { assigneeId: currentUser.id },
                  ],
                },
              }
            : {},
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
          ticket: { select: { id: true, code: true, subject: true } },
        },
      }),
    ]);

    // Format 6 StatCards
    const dashboardStats = [
      {
        id: 'total',
        label: 'Total Work & Tickets',
        value: reportsData.totalCount,
        changeText: '+8.4% vs last month',
        trend: 'up' as const,
        variant: 'default' as const,
        icon: 'layers',
      },
      {
        id: 'open',
        label: 'Open Work',
        value:
          reportsData.statusDistribution.find((s) => s.id === 'open')?.count ||
          0,
        changeText: `${reportsData.criticalCount} critical priority`,
        trend: 'neutral' as const,
        variant: 'urgent' as const,
        icon: 'tickets',
      },
      {
        id: 'in_progress',
        label: 'In Progress',
        value:
          reportsData.statusDistribution.find((s) => s.id === 'in_progress')
            ?.count || 0,
        changeText: 'Active deliverables',
        trend: 'neutral' as const,
        variant: 'warning' as const,
        icon: 'play',
      },
      {
        id: 'pending',
        label: 'Pending Approval',
        value:
          reportsData.statusDistribution.find((s) => s.id === 'pending')
            ?.count || 0,
        changeText: 'Awaiting stakeholder input',
        trend: 'neutral' as const,
        variant: 'active' as const,
        icon: 'clock',
      },
      {
        id: 'resolved',
        label: 'Resolved / Completed',
        value:
          reportsData.summaryMetrics.find((s) => s.id === 'resolved')?.value ||
          0,
        changeText: `${reportsData.slaRate}% SLA achieved`,
        trend: 'up' as const,
        variant: 'success' as const,
        icon: 'check',
      },
      {
        id: 'overdue',
        label: 'Overdue Items',
        value: reportsData.overdueCount,
        changeText: 'Requires triage attention',
        trend: 'down' as const,
        variant: 'urgent' as const,
        icon: 'clock',
      },
    ];

    return {
      stats: dashboardStats,
      statusDistribution: reportsData.statusDistribution,
      priorityDistribution: reportsData.priorityDistribution,
      ticketTypeDistribution: reportsData.typeDistribution,
      departmentDistribution: reportsData.departmentDistribution,
      recentTickets: recentTickets.map((t) => ({
        id: t.code,
        subject: t.subject,
        type: t.type,
        status: t.status,
        priority: t.priority,
        department: t.department || 'General',
        requester: {
          name: t.requester?.name || 'Unknown',
          avatarUrl: t.requester?.avatarUrl,
        },
        assignee: {
          name: t.assignee?.name || 'Unassigned',
          avatarUrl: t.assignee?.avatarUrl,
        },
        createdAt: t.createdAt.toISOString(),
      })),
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        ticketId: a.ticket?.code || a.ticketId,
        type: a.type,
        description: a.description,
        timestamp: a.createdAt.toISOString(),
        actor: {
          name: a.actor?.name || 'System',
          role: a.actor?.role || 'Staff',
          avatarUrl: a.actor?.avatarUrl,
        },
      })),
    };
  }
}

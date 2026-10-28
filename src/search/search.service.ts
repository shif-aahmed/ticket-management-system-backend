import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuerySearchDto, SearchTypeEnum } from './dto/query-search.dto';
import { UserSafeProfile } from '../auth/dto/auth-response.dto';
import { Role } from '@prisma/client';

export interface SearchResultItem {
  id: string;
  type: 'ticket' | 'user' | 'team' | 'category' | 'article';
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  badgeVariant?: 'default' | 'urgent' | 'warning' | 'active' | 'neutral' | 'success';
  metadata?: string;
}

export interface GroupedSearchResults {
  tickets: SearchResultItem[];
  users: SearchResultItem[];
  teams: SearchResultItem[];
  categories: SearchResultItem[];
  articles: SearchResultItem[];
  totalResults: number;
}

const PRIORITY_BADGE_MAP: Record<string, 'urgent' | 'warning' | 'active' | 'neutral'> = {
  critical: 'urgent',
  high: 'warning',
  medium: 'active',
  low: 'neutral',
};

const ROLE_BADGE_MAP: Record<string, 'default' | 'active' | 'neutral'> = {
  administrator: 'default',
  agent: 'active',
  employee: 'neutral',
};

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Multi-entity global search executed at database level with RBAC enforcement
   */
  async globalSearch(
    queryDto: QuerySearchDto,
    currentUser: UserSafeProfile,
  ): Promise<GroupedSearchResults> {
    const q = queryDto.q.trim();
    const limit = queryDto.limit || 5;
    const type = queryDto.type || SearchTypeEnum.ALL;

    const results: GroupedSearchResults = {
      tickets: [],
      users: [],
      teams: [],
      categories: [],
      articles: [],
      totalResults: 0,
    };

    if (!q) {
      return results;
    }

    const searchTickets = type === SearchTypeEnum.ALL || type === SearchTypeEnum.TICKET;
    const searchUsers = type === SearchTypeEnum.ALL || type === SearchTypeEnum.USER;
    const searchTeams = type === SearchTypeEnum.ALL || type === SearchTypeEnum.TEAM;
    const searchCategories = type === SearchTypeEnum.ALL || type === SearchTypeEnum.CATEGORY;
    const searchArticles = type === SearchTypeEnum.ALL || type === SearchTypeEnum.ARTICLE;

    const [tickets, users, teams, categories, articles] = await Promise.all([
      // 1. Tickets (RBAC scoped)
      searchTickets
        ? this.prisma.ticket.findMany({
            where: {
              AND: [
                currentUser.role === Role.employee
                  ? {
                      OR: [
                        { requesterId: currentUser.id },
                        { assigneeId: currentUser.id },
                      ],
                    }
                  : {},
                {
                  OR: [
                    { code: { contains: q, mode: 'insensitive' } },
                    { subject: { contains: q, mode: 'insensitive' } },
                    { description: { contains: q, mode: 'insensitive' } },
                    { department: { contains: q, mode: 'insensitive' } },
                  ],
                },
              ],
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
              assignee: { select: { name: true } },
            },
          })
        : Promise.resolve([]),

      // 2. Users (admins/agents see all users, employees only see active users)
      searchUsers
        ? this.prisma.user.findMany({
            where: {
              ...(currentUser.role === Role.employee ? { status: 'active' } : {}),
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { department: { contains: q, mode: 'insensitive' } },
                { title: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
              department: true,
            },
          })
        : Promise.resolve([]),

      // 3. Teams
      searchTeams
        ? this.prisma.team.findMany({
            where: {
              isActive: true,
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { department: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: limit,
            include: {
              teamLead: { select: { name: true } },
              _count: { select: { members: true } },
            },
          })
        : Promise.resolve([]),

      // 4. Categories
      searchCategories
        ? this.prisma.category.findMany({
            where: {
              status: 'active',
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { departmentDefault: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: limit,
          })
        : Promise.resolve([]),

      // 5. Knowledge Base Articles (published only)
      searchArticles
        ? this.prisma.knowledgeArticle.findMany({
            where: {
              isPublished: true,
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { excerpt: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
                { category: { contains: q, mode: 'insensitive' } },
                { keywords: { has: q } },
              ],
            },
            take: limit,
          })
        : Promise.resolve([]),
    ]);

    // Map Tickets to SearchResultItem
    results.tickets = tickets.map((t) => ({
      id: t.code,
      type: 'ticket' as const,
      title: `${t.code}: ${t.subject}`,
      subtitle: `${t.department || 'General'} • Assignee: ${t.assignee?.name || 'Unassigned'}`,
      href: `/tickets/${encodeURIComponent(t.code)}`,
      badge: t.priority.toUpperCase(),
      badgeVariant: PRIORITY_BADGE_MAP[t.priority] || 'neutral',
      metadata: t.status.replace('_', ' '),
    }));

    // Map Users to SearchResultItem
    results.users = users.map((u) => ({
      id: u.id,
      type: 'user' as const,
      title: u.name,
      subtitle: `${u.email} • ${u.department || 'General'}`,
      href: `/users?search=${encodeURIComponent(u.name)}`,
      badge: u.role,
      badgeVariant: ROLE_BADGE_MAP[u.role] || 'neutral',
      metadata: u.status,
    }));

    // Map Teams to SearchResultItem
    results.teams = teams.map((tm) => ({
      id: tm.id,
      type: 'team' as const,
      title: `${tm.name} Team`,
      subtitle: `Lead: ${tm.teamLead?.name || 'Unassigned'} • ${tm.department || 'General'}`,
      href: `/teams?search=${encodeURIComponent(tm.name)}`,
      badge: `${tm._count?.members || 0} members`,
      badgeVariant: 'default' as const,
      metadata: tm.department || undefined,
    }));

    // Map Categories to SearchResultItem
    results.categories = categories.map((c) => ({
      id: c.id,
      type: 'category' as const,
      title: c.name,
      subtitle: c.description || `Department: ${c.departmentDefault || 'General'}`,
      href: `/categories?search=${encodeURIComponent(c.name)}`,
      badge: c.status,
      badgeVariant: 'active' as const,
      metadata: c.departmentDefault || undefined,
    }));

    // Map Articles to SearchResultItem
    results.articles = articles.map((a) => ({
      id: a.id,
      type: 'article' as const,
      title: a.title,
      subtitle: `${a.category} • ${a.readingTime}`,
      href: `/knowledge-base?search=${encodeURIComponent(a.title)}`,
      badge: a.category,
      badgeVariant: 'active' as const,
      metadata: `${a.viewCount} views`,
    }));

    results.totalResults =
      results.tickets.length +
      results.users.length +
      results.teams.length +
      results.categories.length +
      results.articles.length;

    return results;
  }
}

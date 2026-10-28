import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeArticle, Prisma, Role } from '@prisma/client';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticlesDto } from './dto/query-articles.dto';
import { UserSafeProfile } from '../auth/dto/auth-response.dto';

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to estimate reading time based on average 200 WPM
   */
  private calculateReadingTime(content: string): string {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min`;
  }

  /**
   * Creates an article
   */
  async createArticle(
    createDto: CreateArticleDto,
    authorId: string,
  ): Promise<KnowledgeArticle> {
    const readingTime =
      createDto.readingTime || this.calculateReadingTime(createDto.content);

    return this.prisma.knowledgeArticle.create({
      data: {
        title: createDto.title.trim(),
        category: createDto.category.trim(),
        excerpt: createDto.excerpt.trim(),
        content: createDto.content.trim(),
        keywords: createDto.keywords || [],
        readingTime,
        isPublished:
          createDto.isPublished !== undefined ? createDto.isPublished : true,
        authorId,
        relatedArticleIds: createDto.relatedArticleIds || [],
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
  }

  /**
   * Lists articles with search, category filtering, and sorting
   */
  async findArticles(query: QueryArticlesDto, currentUser?: UserSafeProfile) {
    const where: Prisma.KnowledgeArticleWhereInput = {};

    // Employees can only ever access published articles
    if (!currentUser || currentUser.role === Role.employee) {
      where.isPublished = true;
    } else if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    }

    if (query.category && query.category !== 'all') {
      where.category = { equals: query.category, mode: 'insensitive' };
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { excerpt: { contains: term, mode: 'insensitive' } },
        { content: { contains: term, mode: 'insensitive' } },
        { keywords: { has: term } },
      ];
    }

    let orderBy: Prisma.KnowledgeArticleOrderByWithRelationInput = {
      createdAt: 'desc',
    };

    if (query.sortBy === 'popular') {
      orderBy = { viewCount: 'desc' };
    } else if (query.sortBy === 'alphabetical') {
      orderBy = { title: 'asc' };
    } else if (query.sortBy === 'newest') {
      orderBy = { createdAt: 'desc' };
    }

    return this.prisma.knowledgeArticle.findMany({
      where,
      orderBy,
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
  }

  /**
   * Retrieves single article and increments view count, resolving related articles
   */
  async findById(id: string, currentUser?: UserSafeProfile) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
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

    if (!article) {
      throw new NotFoundException(`Knowledge base article '${id}' not found`);
    }

    // Employees cannot access draft/unpublished articles
    if (
      !article.isPublished &&
      (!currentUser || currentUser.role === Role.employee)
    ) {
      throw new NotFoundException(`Knowledge base article '${id}' not found`);
    }

    // Increment viewCount asynchronously
    await this.prisma.knowledgeArticle.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    let relatedArticles: any[] = [];
    if (article.relatedArticleIds && article.relatedArticleIds.length > 0) {
      relatedArticles = await this.prisma.knowledgeArticle.findMany({
        where: {
          id: { in: article.relatedArticleIds },
          isPublished: true,
        },
        select: {
          id: true,
          title: true,
          category: true,
          excerpt: true,
          readingTime: true,
        },
      });
    }

    return {
      ...article,
      viewCount: article.viewCount + 1,
      relatedArticles,
    };
  }

  /**
   * Updates article details
   */
  async updateArticle(
    id: string,
    updateDto: UpdateArticleDto,
  ): Promise<KnowledgeArticle> {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException(`Article with ID '${id}' not found`);
    }

    const readingTime = updateDto.content
      ? this.calculateReadingTime(updateDto.content)
      : undefined;

    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: {
        title: updateDto.title?.trim(),
        category: updateDto.category?.trim(),
        excerpt: updateDto.excerpt?.trim(),
        content: updateDto.content?.trim(),
        keywords: updateDto.keywords,
        relatedArticleIds: updateDto.relatedArticleIds,
        isPublished: updateDto.isPublished,
        readingTime,
      },
    });
  }

  /**
   * Toggles published status
   */
  async togglePublish(
    id: string,
    isPublished: boolean,
  ): Promise<KnowledgeArticle> {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException(`Article with ID '${id}' not found`);
    }

    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: { isPublished },
    });
  }

  /**
   * Aggregates published article counts by category
   */
  async getCategories() {
    const groups = await this.prisma.knowledgeArticle.groupBy({
      by: ['category'],
      where: { isPublished: true },
      _count: { _all: true },
    });

    return groups.map((g) => ({
      category: g.category,
      articleCount: g._count._all,
    }));
  }

  /**
   * Deletes an article
   */
  async deleteArticle(id: string) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException(`Knowledge base article '${id}' not found`);
    }

    await this.prisma.knowledgeArticle.delete({
      where: { id },
    });

    return { success: true, message: 'Article deleted successfully' };
  }
}

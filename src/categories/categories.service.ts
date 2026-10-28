import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Category, CategoryStatus, Prisma } from '@prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new category ensuring name uniqueness
   */
  async createCategory(createDto: CreateCategoryDto): Promise<Category> {
    const existing = await this.prisma.category.findUnique({
      where: { name: createDto.name.trim() },
    });

    if (existing) {
      throw new ConflictException(
        `Category with name '${createDto.name}' already exists`,
      );
    }

    const category = await this.prisma.category.create({
      data: {
        name: createDto.name.trim(),
        description: createDto.description?.trim(),
        departmentDefault: createDto.departmentDefault?.trim(),
        status: createDto.status || CategoryStatus.active,
      },
    });

    this.logger.log(`Category '${category.name}' created (${category.id})`);
    return category;
  }

  /**
   * Lists categories with search, status filtering, and ticket counts
   */
  async findCategories(query: QueryCategoriesDto) {
    const where: Prisma.CategoryWhereInput = {};

    if (query.status && query.status !== 'all') {
      where.status = query.status as CategoryStatus;
    }

    if (query.department && query.department !== 'all') {
      where.departmentDefault = {
        equals: query.department,
        mode: 'insensitive',
      };
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    return this.prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            tickets: true,
          },
        },
      },
    });
  }

  /**
   * Retrieves single category by ID
   */
  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tickets: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    return category;
  }

  /**
   * Updates category details
   */
  async updateCategory(
    id: string,
    updateDto: UpdateCategoryDto,
  ): Promise<Category> {
    await this.findById(id);

    if (updateDto.name && updateDto.name.trim()) {
      const existing = await this.prisma.category.findUnique({
        where: { name: updateDto.name.trim() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Category with name '${updateDto.name}' already exists`,
        );
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: updateDto.name?.trim(),
        description: updateDto.description?.trim(),
        departmentDefault: updateDto.departmentDefault?.trim(),
        status: updateDto.status,
      },
    });
  }

  /**
   * Toggles category active status without touching tickets
   */
  async toggleStatus(id: string, status: CategoryStatus): Promise<Category> {
    await this.findById(id);

    return this.prisma.category.update({
      where: { id },
      data: { status },
    });
  }
}

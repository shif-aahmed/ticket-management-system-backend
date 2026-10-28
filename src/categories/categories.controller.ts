import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, CategoryStatus } from '@prisma/client';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async getCategories(@Query() query: QueryCategoriesDto) {
    return this.categoriesService.findCategories(query);
  }

  @Get(':id')
  async getCategory(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @Post()
  @Roles(Role.administrator)
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() createDto: CreateCategoryDto) {
    return this.categoriesService.createCategory(createDto);
  }

  @Patch(':id')
  @Roles(Role.administrator)
  async updateCategory(
    @Param('id') id: string,
    @Body() updateDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.updateCategory(id, updateDto);
  }

  @Patch(':id/status')
  @Roles(Role.administrator)
  async setStatus(
    @Param('id') id: string,
    @Body('status') status: CategoryStatus,
  ) {
    return this.categoriesService.toggleStatus(id, status);
  }
}

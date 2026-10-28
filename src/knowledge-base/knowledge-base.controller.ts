import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticlesDto } from './dto/query-articles.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserSafeProfile } from '../auth/dto/auth-response.dto';
import { Role } from '@prisma/client';

@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(
    private readonly knowledgeBaseService: KnowledgeBaseService,
  ) {}

  @Get()
  async getArticles(
    @Query() query: QueryArticlesDto,
    @CurrentUser() user?: UserSafeProfile,
  ) {
    return this.knowledgeBaseService.findArticles(query, user);
  }

  @Get('categories')
  async getCategories() {
    return this.knowledgeBaseService.getCategories();
  }

  @Get(':id')
  async getArticle(
    @Param('id') id: string,
    @CurrentUser() user?: UserSafeProfile,
  ) {
    return this.knowledgeBaseService.findById(id, user);
  }

  @Post()
  @Roles(Role.administrator, Role.agent)
  @HttpCode(HttpStatus.CREATED)
  async createArticle(
    @Body() createDto: CreateArticleDto,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.knowledgeBaseService.createArticle(createDto, user.id);
  }

  @Patch(':id')
  @Roles(Role.administrator, Role.agent)
  async updateArticle(
    @Param('id') id: string,
    @Body() updateDto: UpdateArticleDto,
  ) {
    return this.knowledgeBaseService.updateArticle(id, updateDto);
  }

  @Patch(':id/publish')
  @Roles(Role.administrator, Role.agent)
  async togglePublish(
    @Param('id') id: string,
    @Body('isPublished') isPublished: boolean,
  ) {
    return this.knowledgeBaseService.togglePublish(id, isPublished);
  }

  @Delete(':id')
  @Roles(Role.administrator)
  async deleteArticle(@Param('id') id: string) {
    return this.knowledgeBaseService.deleteArticle(id);
  }
}

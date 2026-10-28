import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { QuerySearchDto } from './dto/query-search.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserSafeProfile } from '../auth/dto/auth-response.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query() query: QuerySearchDto,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.searchService.globalSearch(query, user);
  }
}

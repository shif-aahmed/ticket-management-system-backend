import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { QueryReportsDto } from './dto/query-reports.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserSafeProfile } from '../auth/dto/auth-response.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async getReports(
    @Query() query: QueryReportsDto,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.reportsService.getReportsData(query, user);
  }

  @Get('dashboard')
  async getDashboard(@CurrentUser() user: UserSafeProfile) {
    return this.reportsService.getDashboardData(user);
  }
}

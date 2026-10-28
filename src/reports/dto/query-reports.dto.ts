import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReportsDateRangeEnum {
  SEVEN_DAYS = '7d',
  THIRTY_DAYS = '30d',
  NINETY_DAYS = '90d',
  YEAR_TO_DATE = 'ytd',
  ALL = 'all',
}

export class QueryReportsDto {
  @IsOptional()
  @IsEnum(ReportsDateRangeEnum)
  dateRange?: ReportsDateRangeEnum = ReportsDateRangeEnum.ALL;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}

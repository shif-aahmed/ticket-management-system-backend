import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { CategoryStatus } from '@prisma/client';

export class QueryCategoriesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['all', 'active', 'inactive'])
  status?: string = 'all';

  @IsOptional()
  @IsString()
  department?: string;
}

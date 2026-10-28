import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CategoryStatus } from '@prisma/client';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Category name cannot exceed 100 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  departmentDefault?: string;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;
}

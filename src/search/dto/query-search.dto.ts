import { IsEnum, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum SearchTypeEnum {
  ALL = 'all',
  TICKET = 'ticket',
  USER = 'user',
  TEAM = 'team',
  CATEGORY = 'category',
  ARTICLE = 'article',
}

export class QuerySearchDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Search query is required and cannot be empty' })
  q: string;

  @IsOptional()
  @IsEnum(SearchTypeEnum)
  type?: SearchTypeEnum = SearchTypeEnum.ALL;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(20)
  limit?: number = 5;
}

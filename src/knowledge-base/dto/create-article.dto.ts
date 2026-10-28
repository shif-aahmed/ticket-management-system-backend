import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty({ message: 'Article title is required' })
  @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  category: string;

  @IsString()
  @IsNotEmpty({ message: 'Excerpt is required' })
  excerpt: string;

  @IsString()
  @IsNotEmpty({ message: 'Content is required' })
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedArticleIds?: string[];

  @IsOptional()
  @IsString()
  readingTime?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean = true;
}

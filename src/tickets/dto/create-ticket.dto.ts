import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TicketPriority, TicketType } from '@prisma/client';
import { CreateAttachmentDto } from './create-attachment.dto';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'Ticket subject is required' })
  @MaxLength(255, { message: 'Subject cannot exceed 255 characters' })
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TicketType, {
    message:
      'Type must be one of: task, support_request, incident, bug, general_request',
  })
  type?: TicketType = TicketType.general_request;

  @IsOptional()
  @IsEnum(TicketPriority, {
    message: 'Priority must be one of: low, medium, high, critical',
  })
  priority?: TicketPriority = TicketPriority.medium;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  project?: string;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'Due date must be a valid ISO8601 date string' },
  )
  dueDate?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAttachmentDto)
  attachments?: CreateAttachmentDto[];
}

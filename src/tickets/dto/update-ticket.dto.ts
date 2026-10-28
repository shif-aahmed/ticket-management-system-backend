import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TicketPriority, TicketStatus, TicketType } from '@prisma/client';

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Subject cannot exceed 255 characters' })
  subject?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TicketType, {
    message:
      'Type must be one of: task, support_request, incident, bug, general_request',
  })
  type?: TicketType;

  @IsOptional()
  @IsEnum(TicketStatus, {
    message:
      'Status must be one of: submitted, open, in_progress, pending, resolved, closed',
  })
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority, {
    message: 'Priority must be one of: low, medium, high, critical',
  })
  priority?: TicketPriority;

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
  assigneeId?: string | null;
}

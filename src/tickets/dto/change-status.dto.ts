import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class ChangeStatusDto {
  @IsEnum(TicketStatus, {
    message:
      'Status must be one of: submitted, open, in_progress, pending, resolved, closed',
  })
  @IsNotEmpty({ message: 'Target status is required' })
  status: TicketStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}

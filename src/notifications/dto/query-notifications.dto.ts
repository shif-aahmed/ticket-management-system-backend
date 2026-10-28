import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class QueryNotificationsDto {
  @IsOptional()
  @IsIn(['all', 'unread'])
  filter?: 'all' | 'unread' = 'all';

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}

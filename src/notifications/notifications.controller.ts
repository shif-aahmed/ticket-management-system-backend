import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserSafeProfile } from '../auth/dto/auth-response.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Query() query: QueryNotificationsDto,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.notificationsService.getUserNotifications(user.id, query);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: UserSafeProfile) {
    const unreadCount = await this.notificationsService.getUnreadCount(user.id);
    return { unreadCount };
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: UserSafeProfile) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }
}

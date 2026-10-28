import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Internal helper to create a notification, used by ticket and workflow events
   */
  async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    ticketId?: string;
    actorId?: string;
  }): Promise<Notification> {
    // Prevent self-notification if actor is recipient
    if (data.actorId && data.actorId === data.userId) {
      // Still allow or return placeholder
    }

    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        ticketId: data.ticketId,
        actorId: data.actorId,
      },
    });
  }

  /**
   * Retrieves notifications scoped strictly to the authenticated user
   */
  async getUserNotifications(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<{ items: any[]; unreadCount: number }> {
    const where: Prisma.NotificationWhereInput = {
      userId,
    };

    if (query.filter === 'unread') {
      where.isRead = false;
    }

    if (query.type) {
      where.type = query.type;
    }

    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
            },
          },
          ticket: {
            select: {
              id: true,
              code: true,
              subject: true,
              status: true,
              priority: true,
            },
          },
        },
      }),
      this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    ]);

    return {
      items,
      unreadCount,
    };
  }

  /**
   * Marks a single notification as read, ensuring it belongs to the user
   */
  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID '${id}' not found`);
    }

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Marks all notifications as read for current user
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const res = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: res.count };
  }

  /**
   * Retrieves current unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }
}

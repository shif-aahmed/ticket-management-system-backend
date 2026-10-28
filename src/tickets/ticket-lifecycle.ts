import { TicketStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

/**
 * Valid ticket status lifecycle transition matrix
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  submitted: [TicketStatus.open, TicketStatus.in_progress, TicketStatus.closed],
  open: [
    TicketStatus.in_progress,
    TicketStatus.pending,
    TicketStatus.resolved,
    TicketStatus.closed,
  ],
  in_progress: [
    TicketStatus.pending,
    TicketStatus.resolved,
    TicketStatus.closed,
  ],
  pending: [
    TicketStatus.in_progress,
    TicketStatus.resolved,
    TicketStatus.closed,
  ],
  resolved: [TicketStatus.closed, TicketStatus.in_progress],
  closed: [TicketStatus.open, TicketStatus.in_progress],
};

/**
 * Validates whether transition from current status to next status is permitted
 */
export function validateStatusTransition(
  currentStatus: TicketStatus,
  nextStatus: TicketStatus,
): void {
  if (currentStatus === nextStatus) {
    return;
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new BadRequestException(
      `Invalid ticket status transition from '${currentStatus}' to '${nextStatus}'. Allowed transitions: [${allowed.join(
        ', ',
      )}]`,
    );
  }
}

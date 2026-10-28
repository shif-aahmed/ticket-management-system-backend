import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserSafeProfile } from '../auth/dto/auth-response.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTicket(
    @Body() createDto: CreateTicketDto,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.ticketsService.createTicket(createDto, user);
  }

  @Get()
  async getTickets(
    @Query() queryDto: QueryTicketsDto,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.ticketsService.findTickets(queryDto, user);
  }

  @Get(':id')
  async getTicket(
    @Param('id') id: string,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.ticketsService.findByIdOrCode(id, user);
  }

  @Patch(':id')
  async updateTicket(
    @Param('id') id: string,
    @Body() updateDto: UpdateTicketDto,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.ticketsService.updateTicket(id, updateDto, user);
  }

  @Patch(':id/status')
  async changeStatus(
    @Param('id') id: string,
    @Body() statusDto: ChangeStatusDto,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.ticketsService.changeStatus(id, statusDto, user);
  }

  @Patch(':id/assign')
  async assignTicket(
    @Param('id') id: string,
    @Body() assignDto: AssignTicketDto,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.ticketsService.assignTicket(id, assignDto, user);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @Param('id') id: string,
    @Body() commentDto: CreateCommentDto,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.ticketsService.addComment(id, commentDto, user);
  }

  @Get(':id/activity')
  async getActivity(
    @Param('id') id: string,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.ticketsService.getActivityHistory(id, user);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddTeamMemberDto } from './dto/add-member.dto';
import { QueryTeamsDto } from './dto/query-teams.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async getTeams(@Query() query: QueryTeamsDto) {
    return this.teamsService.findTeams(query);
  }

  @Get(':id')
  async getTeam(@Param('id') id: string) {
    return this.teamsService.findById(id);
  }

  @Post()
  @Roles(Role.administrator)
  @HttpCode(HttpStatus.CREATED)
  async createTeam(@Body() createDto: CreateTeamDto) {
    return this.teamsService.createTeam(createDto);
  }

  @Patch(':id')
  @Roles(Role.administrator, Role.agent)
  async updateTeam(
    @Param('id') id: string,
    @Body() updateDto: UpdateTeamDto,
  ) {
    return this.teamsService.updateTeam(id, updateDto);
  }

  @Patch(':id/status')
  @Roles(Role.administrator)
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.teamsService.toggleStatus(id, isActive);
  }

  @Post(':id/members')
  @Roles(Role.administrator, Role.agent)
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @Param('id') id: string,
    @Body() memberDto: AddTeamMemberDto,
  ) {
    return this.teamsService.addMember(id, memberDto);
  }

  @Delete(':id/members/:userId')
  @Roles(Role.administrator, Role.agent)
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.teamsService.removeMember(id, userId);
  }
}

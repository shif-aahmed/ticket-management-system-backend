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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserSafeProfile } from '../auth/dto/auth-response.dto';
import { Role, UserStatus } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getUsers(
    @Query() query: QueryUsersDto,
    @CurrentUser() currentUser?: UserSafeProfile,
  ) {
    return this.usersService.findUsers(query, currentUser);
  }

  @Get(':id')
  async getUser(
    @Param('id') id: string,
    @CurrentUser() currentUser?: UserSafeProfile,
  ) {
    return this.usersService.findByIdSafe(id, currentUser);
  }

  @Post()
  @Roles(Role.administrator)
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() createDto: CreateUserDto) {
    return this.usersService.createUser(createDto);
  }

  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateDto: UpdateUserDto,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.usersService.updateUser(id, updateDto, user);
  }

  @Patch(':id/status')
  @Roles(Role.administrator)
  async toggleStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
    @CurrentUser() user: UserSafeProfile,
  ) {
    return this.usersService.toggleStatus(id, status, user);
  }
}

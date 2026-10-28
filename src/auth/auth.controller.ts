import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  LoginResponse,
  LogoutResponse,
  UserSafeProfile,
} from './dto/auth-response.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(loginDto);
  }

  @Get('me')
  async getProfile(
    @CurrentUser('id') userId: string,
  ): Promise<UserSafeProfile> {
    return this.authService.getProfile(userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(): Promise<LogoutResponse> {
    return this.authService.logout();
  }

  /**
   * Sample RBAC-protected endpoint confirming administrative access
   */
  @Get('admin-check')
  @Roles(Role.administrator)
  async adminCheck(
    @CurrentUser() user: UserSafeProfile,
  ): Promise<{ message: string; role: Role; admin: string }> {
    return {
      message: 'Administrative privileges verified',
      role: user.role,
      admin: user.name,
    };
  }
}

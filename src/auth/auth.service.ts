import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import {
  LoginResponse,
  LogoutResponse,
  UserSafeProfile,
} from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Hashes a plaintext password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compares plaintext password against bcrypt hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validates user credentials without leaking whether email or password was incorrect
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<UserSafeProfile | null> {
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user) {
      return null;
    }

    if (user.status !== 'active') {
      this.logger.warn(`Login attempt for inactive user: ${email}`);
      return null;
    }

    const isMatch = await this.comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return null;
    }

    return this.usersService.sanitizeUser(user);
  }

  /**
   * Authenticates user and issues signed JWT access token
   */
  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`User ${user.email} (${user.role}) logged in successfully`);

    return {
      accessToken,
      user,
    };
  }

  /**
   * Retrieves profile of currently authenticated user
   */
  async getProfile(userId: string): Promise<UserSafeProfile> {
    const user = await this.usersService.findByIdSafe(userId);
    if (!user) {
      throw new UnauthorizedException('User profile not found');
    }
    return user;
  }

  /**
   * Handles user logout
   */
  async logout(): Promise<LogoutResponse> {
    return {
      message: 'Successfully logged out of TicketGo workspace',
    };
  }
}

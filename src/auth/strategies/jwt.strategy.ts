import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { UserSafeProfile } from '../dto/auth-response.dto';
import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('app.jwtSecret') ||
        'ticketgo_default_jwt_secret_change_me',
    });
  }

  async validate(payload: JwtPayload): Promise<UserSafeProfile> {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid or malformed authentication token');
    }

    const user = await this.usersService.findByIdSafe(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User account associated with this token no longer exists');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User account is currently inactive');
    }

    return user;
  }
}

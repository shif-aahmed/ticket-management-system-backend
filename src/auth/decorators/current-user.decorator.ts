import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserSafeProfile } from '../dto/auth-response.dto';

export const CurrentUser = createParamDecorator(
  (
    data: keyof UserSafeProfile | undefined,
    ctx: ExecutionContext,
  ): UserSafeProfile | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);

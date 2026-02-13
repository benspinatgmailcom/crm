import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@crm/db';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | unknown => {
    const request = ctx.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);

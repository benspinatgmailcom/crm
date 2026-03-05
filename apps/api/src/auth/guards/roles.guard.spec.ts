import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, ROLE_KEY } from '../constants';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createContext = (user: { role: string } | null): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows access when user has required role', () => {
    const context = createContext({ role: Role.USER });
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === ROLE_KEY) return [Role.ADMIN, Role.USER];
      return undefined;
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('VIEWER gets 403 when endpoint requires ADMIN or USER (e.g. deal-brief)', () => {
    const context = createContext({ role: Role.VIEWER });
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === ROLE_KEY) return [Role.ADMIN, Role.USER];
      return undefined;
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows access when no roles metadata (public)', () => {
    const context = createContext({ role: Role.VIEWER });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });
});

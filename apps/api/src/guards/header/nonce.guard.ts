import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { SKIP_NONCE } from '../../decorator/skip-nonce/skip-nonce.decorator';

const NONCE_TOLERANCE_MS = 30_000;

@Injectable()
export class NonceGuard implements CanActivate {

  constructor(private reflector: Reflector) { }
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_NONCE, [
      context.getHandler(),
      context.getClass(),
    ])

    if (skip) {
      return true
    }

    const request = this.getRequest(context);
    const nonce = request.headers['x-nonce'];

    if (!nonce) {
      throw new UnauthorizedException('Missing nonce header');
    }

    if (isNaN(nonce)) {
      throw new UnauthorizedException("Invalid nonce");
    }

    const diff = Math.abs(Date.now() - Number(nonce))
    if (diff > NONCE_TOLERANCE_MS) {
      throw new UnauthorizedException("Invalid Nonce");
    }

    return true;
  }

  private getRequest(context: ExecutionContext) {
    // handle both GraphQL and REST contexts
    if (context.getType() === 'http') {
      return context.switchToHttp().getRequest();
    }

    return GqlExecutionContext.create(context).getContext().req;
  }
}

// libs/common/src/guards/gql-throttler.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
	getRequestResponse(context: ExecutionContext) {
		const gqlCtx = GqlExecutionContext.create(context);
		const ctx = gqlCtx.getContext();
		return { req: ctx.req, res: ctx.req.res };
	}


	protected async getTracker(req: Record<string, any>): Promise<string> {
		return (
			req?.headers?.['x-forwarded-for']?.split(',')[0] ?? // production (cloudflare)
			req?.headers?.['x-real-ip'] ??                      // nginx
			req?.socket?.remoteAddress ??                        // localhost → ::1
			req?.ip ??                                           // express fallback
			'unknown'
		);
	}
}
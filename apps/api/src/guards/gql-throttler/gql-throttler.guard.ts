// libs/common/src/guards/gql-throttler.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
	getRequestResponse(context: ExecutionContext) {
		if (context.getType() === 'http') {
			const http = context.switchToHttp();
			return { req: http.getRequest(), res: http.getResponse() };
		}

		const gqlCtx = GqlExecutionContext.create(context);
		const ctx = gqlCtx.getContext();
		return { req: ctx.req, res: ctx.req.res };
	}


	protected async getTracker(req: Record<string, any>): Promise<string> {
		return req.ip;
	}
}

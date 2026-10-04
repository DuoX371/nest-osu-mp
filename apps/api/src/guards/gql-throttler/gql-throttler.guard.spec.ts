import { GqlThrottlerGuard } from './gql-throttler.guard';
import { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('GqlThrottlerGuard', () => {
	it('allows subscription operations without an HTTP response', async () => {
		const context = {
			getType: () => 'graphql',
			getClass: () => class {},
			getHandler: () => () => {},
			getArgs: () => [undefined, {}, {}, { operation: { operation: 'subscription' } }],
		} as unknown as ExecutionContext;

		await expect(GqlThrottlerGuard.prototype.canActivate(context)).resolves.toBe(true);
	});

	it('still throttles GraphQL queries', async () => {
		const parent = jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
		const context = {
			getType: () => 'graphql',
			getClass: () => class {},
			getHandler: () => () => {},
			getArgs: () => [undefined, {}, {}, { operation: { operation: 'query' } }],
		} as unknown as ExecutionContext;

		try {
			await expect(GqlThrottlerGuard.prototype.canActivate(context)).resolves.toBe(true);
			expect(parent).toHaveBeenCalledWith(context);
		} finally {
			parent.mockRestore();
		}
	});

	it('uses the HTTP request and response for controller routes', () => {
    const request = { ip: '203.0.113.10' };
    const response = {};
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext;

    expect(GqlThrottlerGuard.prototype.getRequestResponse(context)).toEqual({
      req: request,
      res: response,
	});
	});

	it('uses the GraphQL HTTP response when one is provided', () => {
		const request = { ip: '203.0.113.10' };
		const response = { header: jest.fn() };
		const context = {
			getType: () => 'graphql',
			getClass: () => class {},
			getHandler: () => () => {},
			getArgs: () => [undefined, {}, { req: request, res: response }, {}],
		} as unknown as ExecutionContext;

		expect(GqlThrottlerGuard.prototype.getRequestResponse(context)).toEqual({
			req: request,
			res: response,
		});
	});

  it('uses the proxy-verified Express IP instead of client-supplied headers', async () => {
    const tracker = GqlThrottlerGuard.prototype['getTracker'];
    const request = {
      ip: '203.0.113.10',
      headers: {
        'x-forwarded-for': '198.51.100.20',
        'x-real-ip': '198.51.100.30',
      },
    };

    await expect(tracker.call(null, request)).resolves.toBe('203.0.113.10');
  });
});

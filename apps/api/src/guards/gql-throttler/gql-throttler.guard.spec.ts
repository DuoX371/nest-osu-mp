import { GqlThrottlerGuard } from './gql-throttler.guard';
import { ExecutionContext } from '@nestjs/common';

describe('GqlThrottlerGuard', () => {
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

import { NonceGuard } from './nonce.guard';

describe('HeaderGuard', () => {
  it('should be defined', () => {
    expect(new NonceGuard()).toBeDefined();
  });
});

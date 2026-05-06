import { SetMetadata } from '@nestjs/common';

export const SKIP_NONCE = 'skip_nonce'
export const SkipNonce = () => SetMetadata(SKIP_NONCE, true);

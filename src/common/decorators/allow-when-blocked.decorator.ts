import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_BLOCKED_KEY = 'allowWhenBlocked';
export const AllowWhenBlocked = () => SetMetadata(ALLOW_WHEN_BLOCKED_KEY, true);

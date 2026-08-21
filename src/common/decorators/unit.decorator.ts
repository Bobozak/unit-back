import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Unit = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.unit?.[data] : request.unit;
  },
);

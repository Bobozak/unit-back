import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';

import { Public } from '@/common';

@Controller()
export class AppController {
  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

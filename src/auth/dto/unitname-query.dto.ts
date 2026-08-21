import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

import { taskerUnitnameRegex } from '@/common/regex-patterns';

export class UnitnameQueryDto {
  @ApiProperty({ example: 'Kira' })
  @IsString()
  @Matches(taskerUnitnameRegex, {
    message:
      'Unitname must be at least 3 characters and contain only Latin letters and digits',
  })
  unitname: string;
}

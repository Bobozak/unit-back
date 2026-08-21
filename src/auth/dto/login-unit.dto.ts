import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

import { taskerUnitnameRegex } from '@/common/regex-patterns';
import { MinPassphraseLength } from '@/common/validators/min-passphrase-length.validator';

export class LoginUnitDto {
  @ApiProperty({ example: 'Kira' })
  @IsString()
  @Matches(taskerUnitnameRegex, {
    message:
      'Unitname must be at least 3 characters and contain only Latin letters and digits',
  })
  unitname: string;

  @ApiProperty({ example: 'my secret phrase here' })
  @IsString()
  @MinPassphraseLength(12)
  passphrase: string;
}

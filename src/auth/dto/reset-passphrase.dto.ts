import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

import { noCyrillicRegex, taskerUnitnameRegex } from '@/common/regex-patterns';
import { MinPassphraseLength } from '@/common/validators';

export class ResetPassphraseDto {
  @ApiProperty({ example: 'Kira' })
  @IsString()
  @Matches(taskerUnitnameRegex, {
    message:
      'Unitname must be at least 3 characters and contain only Latin letters and digits',
  })
  unitname: string;

  @ApiProperty({ example: 'my new passphrase' })
  @IsNotEmpty()
  @IsString()
  @Matches(noCyrillicRegex, {
    message: 'Passphrase must not contain Cyrillic characters',
  })
  @MinPassphraseLength(12)
  newPassphrase: string;
}

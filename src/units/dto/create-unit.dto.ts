import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { noCyrillicRegex, taskerUnitnameRegex } from '@/common/regex-patterns';
import {
  IsDistinctSecurityAnswer,
  MinNormalizedAnswerLength,
  MinPassphraseLength,
} from '@/common/validators';

export class CreateUnitDto {
  @ApiProperty({ example: 'Kira' })
  @IsString()
  @Matches(taskerUnitnameRegex, {
    message:
      'Unitname must be at least 3 characters and contain only Latin letters and digits',
  })
  readonly unitname: string;

  @ApiProperty({ example: 'my secret phrase here' })
  @IsString()
  @Matches(noCyrillicRegex, {
    message: 'Passphrase must not contain Cyrillic characters',
  })
  @MinPassphraseLength(12)
  readonly passphrase: string;

  @ApiProperty({ example: 'what city were you born in' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(8, {
    message: 'Security question must be at least 8 characters',
  })
  @MaxLength(200, {
    message: 'Security question must be at most 200 characters',
  })
  @Matches(/[\p{L}\p{N}]/u, {
    message: 'Security question must contain a letter or digit',
  })
  readonly securityQuestion: string;

  @ApiProperty({ example: 'night city' })
  @IsString()
  @MinNormalizedAnswerLength(3)
  @IsDistinctSecurityAnswer()
  readonly securityAnswer: string;
}

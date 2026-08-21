import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

import { noCyrillicRegex } from '@/common/regex-patterns';
import {
  IsNonIncreasingDigitSequence,
  MinPassphraseLength,
} from '@/common/validators';

export class ChangePassphraseDto {
  @ApiProperty({ example: 'my old passphrase' })
  @IsNotEmpty()
  @IsString()
  @Matches(noCyrillicRegex, {
    message: 'Passphrase must not contain Cyrillic characters',
  })
  @MinPassphraseLength(12)
  currentPassphrase: string;

  @ApiProperty({
    example: '9876543210000000',
    description:
      'All 16 digits from the active change-passphrase challenge (POST /auth/passphrase-challenge), entered in the same order as shown on screen: non-increasing (each digit <= previous, left to right). Request a new challenge if expired.',
  })
  @IsString()
  @Matches(/^\d{16}$/, {
    message: 'Digit sequence must be exactly 16 digits',
  })
  @IsNonIncreasingDigitSequence()
  digitSequence: string;

  @ApiProperty({ example: 'my new passphrase' })
  @IsNotEmpty()
  @IsString()
  @Matches(noCyrillicRegex, {
    message: 'Passphrase must not contain Cyrillic characters',
  })
  @MinPassphraseLength(12)
  newPassphrase: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

import { taskerUnitnameRegex } from '@/common/regex-patterns';

export class VerifyResetRound1Dto {
  @ApiProperty({ example: 'Kira' })
  @IsString()
  @Matches(taskerUnitnameRegex, {
    message:
      'Unitname must be at least 3 characters and contain only Latin letters and digits',
  })
  unitname: string;

  @ApiProperty({
    example: '2468975311000000',
    description:
      'Round 1 digit input (16 chars). From the shown `digits` string, enter in order: (1) all non-zero even digits ascending, (2) all non-zero odd digits descending, (3) all zeros last. Example: for `9817654321000000` → `2468` + `975311` + `000000` = `2468975311000000`.',
  })
  @IsString()
  @Matches(/^\d{16}$/, {
    message: 'Digit sequence must be exactly 16 digits',
  })
  digitSequence: string;
}

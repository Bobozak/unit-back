import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

import { taskerUnitnameRegex } from '@/common/regex-patterns';

export class VerifyProfileDto {
  @ApiProperty({ example: 'Kira' })
  @IsString()
  @Matches(taskerUnitnameRegex, {
    message:
      'Unitname must be at least 3 characters and contain only Latin letters and digits',
  })
  unitname: string;

  @ApiProperty({
    example: '0111123334445566',
    description:
      'All 16 digits from `verificationCode` returned by POST /auth/register, entered in the same order as shown on screen: non-increasing (each digit >= previous, left to right).',
  })
  @IsString()
  @Matches(/^\d{16}$/, {
    message: 'Verification code must be exactly 16 digits',
  })
  code: string;
}

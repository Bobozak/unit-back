import { ApiProperty } from '@nestjs/swagger';

import { UnitResponseDto } from '@/units/dto/response';

export class RegisterResponseDto extends UnitResponseDto {
  @ApiProperty({
    example: '0111123334445566',
    description:
      '16-digit verification code to display after registration. Non-increasing order (each digit >= previous, left to right). User must re-enter this exact string in POST /auth/verify.',
  })
  verificationCode: string;
}

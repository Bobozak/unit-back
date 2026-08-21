import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyProfileResponseDto {
  @ApiProperty({
    enum: ['verified', 'retry', 'destroyed'],
    example: 'verified',
  })
  status: 'verified' | 'retry' | 'destroyed';

  @ApiPropertyOptional({ example: 'Profile verified successfully' })
  message?: string;

  @ApiPropertyOptional({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token issued on successful verification',
  })
  accessToken?: string;

  @ApiPropertyOptional({
    example: '0111123334445566',
    description: 'New verification code after a failed attempt',
  })
  code?: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Attempts remaining after a failed attempt',
  })
  attemptsRemaining?: number;
}

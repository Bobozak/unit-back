import { ApiProperty } from '@nestjs/swagger';

export class ForgotPassphraseChallengeResponseDto {
  @ApiProperty({
    example: '9817654321000000',
    description:
      '16 random digits to display on screen (order has no special rule). For round-1/challenge this is the sequence the user must re-enter with the even-asc / odd-desc / zeros rule. Round-2 reset does not ask for digits.',
  })
  digits: string;

  @ApiProperty({
    example: '2024-06-09T14:26:55.148Z',
    description:
      'UTC expiry of this challenge (10 minutes). Request round-1/challenge again if expired before verify.',
  })
  expiresAt: Date;
}

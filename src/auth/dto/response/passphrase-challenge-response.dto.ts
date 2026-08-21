import { ApiProperty } from '@nestjs/swagger';

export class PassphraseChallengeResponseDto {
  @ApiProperty({
    example: '9876543210000000',
    description:
      '16 digits to display on screen. Each next digit is less than or equal to the previous one (non-increasing / descending order, left to right). The user must re-enter this exact string in POST /auth/change-passphrase before it expires.',
  })
  digits: string;

  @ApiProperty({
    example: '2024-06-09T14:26:55.148Z',
    description:
      'UTC expiry of this challenge (10 minutes). After this time, request a new challenge.',
  })
  expiresAt: Date;
}

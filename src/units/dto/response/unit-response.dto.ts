import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UnitResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Kira' })
  unitname: string;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/example.png' })
  image: string | null;

  @ApiProperty({ example: '2024-06-09T14:16:55.148Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-06-09T14:16:55.148Z' })
  updatedAt: Date;

  @ApiProperty({ example: false })
  isLoggedIn: boolean;

  @ApiProperty({ example: false })
  isBlocked: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  blockedAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  blockingAssessmentId: string | null;

  @ApiProperty({ example: 0 })
  reclassificationCount: number;

  @ApiProperty({ example: 'v3.7.14' })
  baselineVersion: string;

  @ApiProperty({ example: 0 })
  replicantStrikeCount: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  finalInvestigationAt: Date | null;
}

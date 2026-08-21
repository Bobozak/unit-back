import { ApiProperty } from '@nestjs/swagger';

export class NoteResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  id: string;

  @ApiProperty({ example: 'Remember to review the design before deadline' })
  text: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  taskId: string;

  @ApiProperty({ example: '2026-07-24T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-07-24T10:00:00.000Z' })
  updatedAt: Date;
}

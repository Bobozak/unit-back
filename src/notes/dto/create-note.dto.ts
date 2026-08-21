import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

import { noteTextRegex } from '@/common/regex-patterns';

export class CreateNoteDto {
  @ApiProperty({
    example: 'Remember to review the design before deadline',
    maxLength: 1500,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(noteTextRegex, {
    message:
      'Note text must contain only Latin letters, digits, and punctuation',
  })
  @MaxLength(1500)
  readonly text: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { noteTextRegex } from '@/common/regex-patterns';

export class UpdateNoteDto {
  @ApiPropertyOptional({ example: 'Updated note text', maxLength: 1500 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(noteTextRegex, {
    message:
      'Note text must contain only Latin letters, digits, and punctuation',
  })
  @MaxLength(1500)
  readonly text?: string;
}

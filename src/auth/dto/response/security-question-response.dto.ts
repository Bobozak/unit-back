import { ApiProperty } from '@nestjs/swagger';

export class SecurityQuestionResponseDto {
  @ApiProperty({ example: 'what city were you born in' })
  question: string;
}

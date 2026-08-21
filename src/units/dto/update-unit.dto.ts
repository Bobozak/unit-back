import { IsOptional, IsString, Matches } from 'class-validator';

import { taskerUnitnameRegex } from '@/common/regex-patterns';

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  @Matches(taskerUnitnameRegex, {
    message: 'Incorrect format of unit name (Latin letters and digits only)',
  })
  unitname?: string;
}

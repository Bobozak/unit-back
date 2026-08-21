import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

import { description, Priority, TaskCategories } from '@/common';
import { taskTitleRegex } from '@/common/regex-patterns';

function CannotBeChanged(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'cannotBeChanged',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} cannot be changed after create`,
        ...validationOptions,
      },
      validator: {
        validate: () => false,
      },
    });
  };
}

export class UpdateTaskDto {
  @IsNotEmpty()
  @IsOptional()
  @Matches(taskTitleRegex, { message: 'incorrect format of title' })
  @MinLength(2)
  @MaxLength(200)
  readonly title?: string;

  @IsNotEmpty()
  @IsOptional()
  @Matches(taskTitleRegex, { message: 'incorrect format of description' })
  @MinLength(2)
  @MaxLength(2000)
  readonly description?: string;

  @IsNotEmpty()
  @IsEnum(TaskCategories)
  @IsOptional()
  readonly category?: TaskCategories;

  @IsNotEmpty()
  @IsOptional()
  @IsEnum(Priority)
  readonly priority?: Priority;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  readonly complexity?: number;

  @ApiPropertyOptional({
    description: 'Immutable. Sending this field returns 400.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @CannotBeChanged()
  readonly deadline?: string;

  @ApiPropertyOptional({
    description: 'Immutable. Sending this field returns 400.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @CannotBeChanged()
  readonly startDate?: string;
}

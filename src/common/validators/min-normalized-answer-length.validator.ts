import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

import { normalizeSecurityAnswer } from '@/common/helpers/normalize-security-answer';

export function MinNormalizedAnswerLength(
  minLength: number,
  maxLength = 100,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'minNormalizedAnswerLength',
      target: object.constructor,
      propertyName,
      constraints: [minLength, maxLength],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') {
            return false;
          }

          const normalized = normalizeSecurityAnswer(value);
          return (
            normalized.length >= minLength && normalized.length <= maxLength
          );
        },
        defaultMessage(args: ValidationArguments) {
          return `Security answer must contain between ${args.constraints[0]} and ${args.constraints[1]} characters after normalization`;
        },
      },
    });
  };
}

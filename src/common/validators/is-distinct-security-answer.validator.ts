import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

import { normalizeSecurityAnswer } from '@/common/helpers/normalize-security-answer';

export function IsDistinctSecurityAnswer(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDistinctSecurityAnswer',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }

          const obj = args.object as {
            securityQuestion?: string;
            passphrase?: string;
          };
          const answer = normalizeSecurityAnswer(value);
          if (!answer) {
            return true;
          }

          if (
            obj.securityQuestion &&
            answer === normalizeSecurityAnswer(obj.securityQuestion)
          ) {
            return false;
          }

          if (
            obj.passphrase &&
            (answer === obj.passphrase ||
              answer === normalizeSecurityAnswer(obj.passphrase))
          ) {
            return false;
          }

          return true;
        },
        defaultMessage() {
          return 'Security answer must differ from the question and passphrase';
        },
      },
    });
  };
}

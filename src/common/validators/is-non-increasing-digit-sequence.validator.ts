import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function isNonIncreasingDigitSequence(value: string): boolean {
  if (!/^\d{16}$/.test(value)) {
    return false;
  }

  for (let i = 1; i < value.length; i++) {
    if (Number(value[i]) > Number(value[i - 1])) {
      return false;
    }
  }

  return true;
}

export function IsNonIncreasingDigitSequence(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNonIncreasingDigitSequence',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') {
            return false;
          }

          return isNonIncreasingDigitSequence(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be exactly 16 digits in non-increasing order`;
        },
      },
    });
  };
}

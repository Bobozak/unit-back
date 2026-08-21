import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function getPassphraseSignificantLength(value: string): number {
  return value.replace(/\s/g, '').length;
}

export function MinPassphraseLength(
  minLength: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'minPassphraseLength',
      target: object.constructor,
      propertyName,
      constraints: [minLength],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') {
            return false;
          }

          return getPassphraseSignificantLength(value) >= minLength;
        },
        defaultMessage(args: ValidationArguments) {
          return `Passphrase must contain at least ${args.constraints[0]} non-space characters`;
        },
      },
    });
  };
}

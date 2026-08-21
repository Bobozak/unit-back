import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'noSpaces', async: false })
class NoSpacesConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    return typeof value === 'string' && !/\s/.test(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} cannot contain spaces`;
  }
}

export const noSpaces = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoSpacesConstraint,
    });
  };
};

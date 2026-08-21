import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isValidDate', async: false })
class IsValidDateConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'string') return false;

    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    if (!iso8601Regex.test(value)) return false;

    const date = new Date(value);

    return (
      !isNaN(date.getTime()) &&
      date.getTime() >= new Date().getTime() &&
      date.toISOString() === value
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid date in ISO 8601 format and not in the past`;
  }
}

export const IsValidDate = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidDateConstraint,
    });
  };
};

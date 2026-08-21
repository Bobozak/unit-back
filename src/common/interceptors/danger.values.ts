import { BadRequestException, Logger } from '@nestjs/common';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const logger = new Logger('Validation');

export const NoDangerousChars =
  (validationOptions?: ValidationOptions) =>
  (object: any, propertyName: string) => {
    registerDecorator({
      name: 'noDangerousChars',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate: (value: any) => {
          if (typeof value !== 'string') return false;
          const dangerousChars = /<script|javascript:|on\w+\s*=/i;
          if (dangerousChars.test(value)) {
            logger.error(`Potentially dangerous ${propertyName}: "${value}"`);
            throw new BadRequestException(
              `${propertyName} contains potentially dangerous characters`,
            );
          }
          return true;
        },
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} contains potentially dangerous characters`,
      },
    });
  };

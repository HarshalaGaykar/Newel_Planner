import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'Match' })
class MatchConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const [relatedProperty] = args.constraints as [string];
    return value === (args.object as Record<string, unknown>)[relatedProperty];
  }

  defaultMessage(args: ValidationArguments) {
    const [relatedProperty] = args.constraints as [string];
    return `${args.property} must match ${relatedProperty}`;
  }
}

/**
 * Validates that the decorated property is identical to another property on the same DTO.
 */
export function Match(property: string, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: MatchConstraint,
    });
  };
}

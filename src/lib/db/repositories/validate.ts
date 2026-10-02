export class ValidationError extends Error {}

export function requireName(name: string, max = 40): string {
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError('Name is required');
  if (trimmed.length > max) throw new ValidationError(`Name must be at most ${max} characters`);
  return trimmed;
}

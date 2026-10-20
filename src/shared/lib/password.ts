export const PASSWORD_REQUIREMENT_TEXT =
  "Use at least 8 characters with an uppercase letter, lowercase letter, number, and symbol. Do not use the temporary staff password.";

export const INVITED_ACCOUNT_TEMPORARY_PASSWORD = "Bright123!";

export function getPasswordRequirementFailures(password: string) {
  const failures: string[] = [];

  if (password.length < 8) {
    failures.push("at least 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    failures.push("one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    failures.push("one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    failures.push("one number");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    failures.push("one symbol");
  }

  if (password === INVITED_ACCOUNT_TEMPORARY_PASSWORD) {
    failures.push("a password different from the temporary staff password");
  }

  return failures;
}

export function getPasswordRequirementMessage(password: string) {
  const failures = getPasswordRequirementFailures(password);

  if (failures.length === 0) {
    return null;
  }

  return `Password needs ${failures.join(", ")}.`;
}

/**
 * Field validators shared by onboarding and the dashboard's "Add farm" popup.
 *
 * They live here rather than in either screen because the two collect the same
 * farm details, and a rule that exists in only one of them is a rule a farmer
 * can walk around by using the other door.
 *
 * Every validator returns `null` when the value is acceptable and a
 * farmer-facing message when it is not — so callers can render the message
 * directly without translating a boolean into words at each call site.
 */

/** The message the farmer sees when a number field contains anything but a number. */
export const INVALID_NUMBER_MSG = "Invalid character found — please enter a valid number.";

/**
 * Phone must be exactly ten digits.
 *
 * Indian mobile numbers are ten digits, and the field is the only handle we have
 * on a farmer if an alert has to reach them. Spaces, dashes and a leading +91 are
 * stripped before checking, because farmers type all three and rejecting the
 * formatting rather than the number is just noise.
 */
export function validatePhone(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Phone number is required.";

  const stripped = value.replace(/[\s\-()]/g, "").replace(/^\+?91/, "");

  if (/[^\d]/.test(stripped)) return "Phone number must contain digits only.";
  if (stripped.length !== 10) return "Phone number must be exactly 10 digits.";
  return null;
}

/** The ten digits behind whatever the farmer typed, for storage. */
export function normalizePhone(raw: string): string {
  return raw.trim().replace(/[\s\-()]/g, "").replace(/^\+?91/, "");
}

/**
 * Email must be a Gmail address.
 *
 * This is a product decision, not a technical one, and it is enforced at
 * registration too — see AuthPanel. If it were enforced only here, anyone who
 * signed up with another provider would reach this step with their own address
 * prefilled and no way to satisfy the rule.
 */
export function validateEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return "Email is required.";
  if (/\s/.test(value)) return "Email cannot contain spaces.";
  if (!/^[^\s@]+@gmail\.com$/.test(value)) return "Email must end in @gmail.com.";
  return null;
}

/**
 * An area in acres: a positive number, nothing else.
 *
 * The two failure modes are deliberately separate messages. A "-" or a stray
 * letter is a typo and the farmer needs to know a character is wrong; "0" is
 * well-formed but not a farm, and telling them to "enter a valid number" there
 * would be confusing because they did.
 */
export function validateArea(raw: string, label = "Area"): string | null {
  const value = raw.trim();
  if (!value) return `${label} is required.`;

  // Digits with at most one decimal point. This rejects "-", "+", "e", "1-2"
  // and "1.2.3" — all of which Number() would either accept or quietly coerce.
  if (!/^\d*\.?\d+$/.test(value)) return INVALID_NUMBER_MSG;

  const n = Number(value);
  if (!Number.isFinite(n)) return INVALID_NUMBER_MSG;
  if (n <= 0) return `${label} must be greater than 0.`;
  return null;
}

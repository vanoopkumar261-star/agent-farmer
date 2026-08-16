/**
 * Exercises src/lib/validation.ts against the cases that matter.
 *
 * Run with: node scripts/check-validation.mjs
 *
 * The validators are plain functions with no imports, so this loads the file's
 * source and evaluates it rather than pulling in a TypeScript toolchain just to
 * strip a handful of type annotations.
 */
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/lib/validation.ts", import.meta.url), "utf8")
  .replace(/\bexport /g, "")
  // Strip the parameter and return-type annotations; the bodies are plain JS.
  .replace(/(\braw)\s*:\s*string/g, "$1")
  .replace(/(\blabel)\s*:\s*string(\s*=)/g, "$1$2")
  .replace(/\)\s*:\s*(string \| null|string)\s*\{/g, ") {");

const mod = new Function(
  `${src}; return { validatePhone, validateEmail, validateArea, normalizePhone, normalizeEmail };`
)();

let failures = 0;
function expect(fn, input, wantOk, note = "") {
  const got = fn(input);
  const isOk = got === null;
  const pass = isOk === wantOk;
  if (!pass) failures++;
  console.log(
    `${pass ? "pass" : "FAIL"}  ${JSON.stringify(input).padEnd(20)} ${
      isOk ? "accepted" : `rejected: ${got}`
    }${note ? `   (${note})` : ""}`
  );
}

console.log("\n── phone: exactly 10 digits ──");
["9876543210", "+91 98765 43210", "98765-43210", "+919876543210"].forEach((v) =>
  expect(mod.validatePhone, v, true)
);
["987654321", "98765432100", "98765abcde", "", "abcdefghij", "9876 54321 0 1"].forEach((v) =>
  expect(mod.validatePhone, v, false)
);
console.log("normalize('+91 98765 43210') =>", mod.normalizePhone("+91 98765 43210"));

console.log("\n── email: standard structure, any provider ──");
// The acceptance list from the spec, verbatim.
[
  "farmer@gmail.com",
  "farmer@yahoo.com",
  "user@outlook.com",
  "abc123@domain.com",
  "first.last@domain.com",
  "farmer123@agri.in",
].forEach((v) => expect(mod.validateEmail, v, true, "spec: accept"));

// The rejection list from the spec, verbatim.
[
  "farmer",
  "farmer@",
  "@gmail.com",
  "farmer@gmail",
  "farmer gmail.com",
  "farmer@.com",
  "farmer@domain.",
  "farmer@domain",
  "farmer..name@domain.com",
].forEach((v) => expect(mod.validateEmail, v, false, "spec: reject"));

// Beyond the spec: shapes a naive regex tends to get wrong.
[
  "a+tag@domain.co.uk",
  "a_b-c@sub.domain.org",
  "x@a-b.com",
  "MixedCase@Domain.COM",
  "  padded@domain.com  ",
].forEach((v) => expect(mod.validateEmail, v, true));
[
  ".lead@domain.com",
  "trail.@domain.com",
  "two@@domain.com",
  "a@-domain.com",
  "a@domain-.com",
  "a@domain..com",
  "a@domain.c",
  "a@domain.123",
  "",
  "a".repeat(65) + "@domain.com",
  "a@" + "b".repeat(250) + ".com",
].forEach((v) => expect(mod.validateEmail, v, false));

console.log("\n── email is stored as typed, never rewritten ──");
for (const v of ["  Farmer.Name+Tag@Domain.COM  ", "abc@d.io"]) {
  const got = mod.normalizeEmail(v);
  const want = v.trim();
  const pass = got === want;
  if (!pass) failures++;
  console.log(`${pass ? "pass" : "FAIL"}  ${JSON.stringify(v)} -> ${JSON.stringify(got)}`);
}

console.log("\n── area: positive number, no stray characters ──");
["12", "3.5", ".5", " 4 ", "0.25"].forEach((v) => expect(mod.validateArea, v, true));
["-1", "-", "1-2", "0", "abc", "1e3", "1.2.3", "", "+5", "1,5"].forEach((v) =>
  expect(mod.validateArea, v, false)
);

console.log(failures === 0 ? "\nAll cases behaved as expected.\n" : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);

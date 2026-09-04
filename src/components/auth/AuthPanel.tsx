"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { normalizeEmail, validateEmail, INVALID_EMAIL_MSG } from "@/lib/validation";
import { useT } from "@/components/i18n/LanguageProvider";

/** Maps the fixed set of English messages `validateEmail` can return to a translated string. */
function translateEmailError(raw: string | null, t: (key: string) => string): string | null {
  if (!raw) return null;
  if (raw === "Email is required.") return t("login.error.emailRequired");
  if (raw === INVALID_EMAIL_MSG) return t("login.error.invalidEmail");
  return raw;
}

export type AuthMode = "signin" | "signup";

/**
 * Email + password registration and sign-in.
 *
 * Shared by `/login` and by step 0 of onboarding so the credential logic exists
 * once. Accounts were previously keyed on a username mapped to a synthetic
 * `@agentfarmer.local` address; they are now real email addresses.
 *
 * Supabase email confirmation is disabled for this project, so `signUp` returns
 * a session immediately and no mail is ever sent. The trade-off is that there
 * is no password-reset path — that needs SMTP configured.
 *
 * The panel owns no navigation. It reports success through `onAuthed` and lets
 * the caller decide where the farmer goes, because that differs: /login returns
 * them where they came from, onboarding decides between the wizard and the
 * dashboard based on whether a farm profile already exists.
 */
export default function AuthPanel({
  onAuthed,
  compact = false,
}: {
  /** Called after a successful sign-in or sign-up. */
  onAuthed: (mode: AuthMode) => void | Promise<void>;
  /** Drops the heading, for embedding inside a page that has its own. */
  compact?: boolean;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Shown when someone registers with an email that already has an account.
   * A red line under the field was too easy to miss — and silently flipping the
   * tab to "Sign in" underneath them read as the form losing their input. This
   * stops and says plainly what happened, keeping the email they typed.
   */
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  /**
   * Structural email validation, shared with onboarding and the feedback API
   * through src/lib/validation.ts — one grammar, one message, every form.
   *
   * Any provider is accepted. An earlier build restricted accounts to Gmail;
   * that rule is gone, and nothing here may reintroduce a provider allow-list.
   *
   * `emailTouched` keeps the field quiet until the farmer has actually left it,
   * so an untouched form never greets them in red. It is set on blur and forced
   * on submit, which is what surfaces the message for someone who tabs straight
   * to the button.
   */
  const [emailTouched, setEmailTouched] = useState(false);

  /**
   * Chrome's password manager sets input.value natively, which does NOT fire
   * the event React's synthetic system listens for. React state stayed empty
   * while the fields visibly held the saved credentials, so `canSubmit` was
   * false and the submit button sat greyed out with a not-allowed cursor and
   * no explanation. The DOM is therefore the source of truth on submit, and
   * this effect pulls autofilled values back into state so the UI agrees.
   */
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Chrome fills at different moments depending on how the page was reached,
    // so this samples a few times rather than betting on one.
    const sync = () => {
      const e = emailRef.current?.value ?? "";
      const p = passwordRef.current?.value ?? "";
      if (e) setEmail((prev) => (prev === e ? prev : e));
      if (p) setPassword((prev) => (prev === p ? prev : p));
    };
    sync();
    const timers = [50, 250, 800].map((ms) => window.setTimeout(sync, ms));
    return () => timers.forEach(window.clearTimeout);
  }, []);
  const emailProblem = validateEmail(email);
  const emailValid = emailProblem === null;
  const emailError = emailTouched ? translateEmailError(emailProblem, t) : null;
  /**
   * Matches `[auth.password] min_length = 8` in supabase/config.toml.
   *
   * This was 6 while the server required 8, so the button enabled itself and
   * then signup failed with Supabase's own English error — and the config's
   * comment ("the client check in AuthPanel is only a courtesy and must be
   * raised to match") had been true and unactioned since it was written.
   */
  const MIN_PASSWORD = 8;

  /**
   * The minimum is a SIGNUP rule, checked inside submit(). Enforcing it on
   * sign-in locked out every account created while the minimum was 6 — the
   * saved password was refused by the client before the server ever saw it.
   * On sign-in the server decides, and a wrong password returns a normal error.
   */

  const submit = async () => {
    setError(null);

    // Read the inputs directly: if the browser autofilled after the last
    // render, these hold the real credentials and state does not.
    const emailValue = emailRef.current?.value ?? email;
    const passwordValue = passwordRef.current?.value ?? password;
    if (emailValue !== email) setEmail(emailValue);
    if (passwordValue !== password) setPassword(passwordValue);

    const problem = validateEmail(emailValue);
    if (problem) {
      setEmailTouched(true);
      setError(translateEmailError(problem, t));
      return;
    }
    if (!passwordValue) {
      setError(t("login.auth.passwordTooShort"));
      return;
    }
    if (mode === "signup" && passwordValue.length < MIN_PASSWORD) {
      setError(t("login.auth.passwordTooShort"));
      return;
    }

    setLoading(true);
    // Padding removed, nothing else. The address is sent exactly as typed —
    // Supabase Auth does its own case-folding server-side, so lower-casing here
    // would only mean the farmer's account no longer matches what they entered.
    const cleanEmail = normalizeEmail(emailValue);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: passwordValue,
        });
        if (error) {
          // Supabase answers a duplicate signup with HTTP 422 and
          // "User already registered" (error_code: user_already_exists).
          const dupe =
            /already registered|already exists/i.test(error.message) ||
            (error as { code?: string }).code === "user_already_exists";
          if (dupe) {
            setAlreadyRegistered(true);
          } else {
            setError(error.message);
          }
          return;
        }
        // Confirmation is off, so a session comes back straight away. If it
        // ever gets switched on in Supabase, this is where it would show up.
        if (!data.session) {
          const { error: e2 } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: passwordValue,
          });
          if (e2) {
            setError(t("login.auth.confirmEmailOffError"));
            return;
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: passwordValue,
        });
        if (error) {
          setError(t("login.auth.incorrectCredentials"));
          return;
        }
      }
      await onAuthed(mode);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {alreadyRegistered && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="already-registered-title"
          className="absolute inset-0 z-20 flex items-center justify-center rounded-[20px] bg-af-card/95 backdrop-blur-[2px] p-2"
        >
          <div className="w-full max-w-sm rounded-[18px] border border-af-border bg-af-card p-6 text-center shadow-af-float">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-af-amber/10 text-af-amber-ink">
              <AlertCircle className="h-6 w-6" />
            </span>
            <h3
              id="already-registered-title"
              className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-af-ink"
            >
              {t("login.auth.alreadyRegisteredTitle")}
            </h3>
            <p className="mt-1.5 text-sm text-af-ink-2 leading-relaxed">
              <span className="font-semibold text-af-ink">{email.trim().toLowerCase()}</span>
              {t("login.auth.alreadyHasAccountSuffix")}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  // Keep the email, clear only the password, and land them on
                  // the sign-in tab with the cursor where it needs to be.
                  setAlreadyRegistered(false);
                  setError(null);
                  setPassword("");
                  setMode("signin");
                }}
                className="w-full rounded-[12px] bg-af-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-af-primary-deep active:scale-[0.99]"
              >
                {t("login.auth.goToSignIn")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAlreadyRegistered(false);
                  setEmail("");
                  setPassword("");
                }}
                className="w-full rounded-[12px] px-5 py-2.5 text-sm font-semibold text-af-ink-2 transition hover:text-af-ink"
              >
                {t("login.auth.useDifferentEmail")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex rounded-[14px] bg-af-bg border border-af-border p-1 mb-6">
        {(["signup", "signin"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-[10px] px-4 py-2 text-sm font-semibold transition ${
              mode === m
                ? "bg-af-card text-af-ink shadow-af-sm"
                : "text-af-muted hover:text-af-ink-2"
            }`}
          >
            {m === "signup" ? t("login.auth.createAccount") : t("login.auth.signIn")}
          </button>
        ))}
      </div>

      {!compact && (
        <>
          <h2 className="font-sans text-2xl font-semibold tracking-[-0.02em] text-af-ink">
            {mode === "signin" ? t("login.auth.welcomeBack") : t("login.auth.createYourAccount")}
          </h2>
          <p className="mt-1 text-sm text-af-ink-2">
            {mode === "signin" ? t("login.auth.signInSubtitle") : t("login.auth.signUpSubtitle")}
          </p>
        </>
      )}

      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted">
            {t("login.auth.emailLabel")}
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-af-muted" />
            <input
              ref={emailRef}
              autoFocus
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={t("login.auth.emailPlaceholder")}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "auth-email-error" : undefined}
              className={`w-full rounded-[14px] bg-af-bg border pl-11 pr-4 py-3 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 transition ${
                emailError
                  ? "border-af-danger/50 focus:ring-af-danger/20 focus:border-af-danger"
                  : "border-af-border focus:ring-af-primary/25 focus:border-af-primary/40"
              }`}
            />
          </div>
          {emailError && (
            <p
              id="auth-email-error"
              role="alert"
              className="flex items-start gap-1.5 text-[12px] font-semibold text-af-danger"
            >
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              {emailError}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted">
            {t("login.auth.passwordLabel")}
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-af-muted" />
            <input
              ref={passwordRef}
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={
                mode === "signup"
                  ? t("login.auth.passwordPlaceholderSignup")
                  : t("login.auth.passwordPlaceholderSignin")
              }
              className="w-full rounded-[14px] bg-af-bg border border-af-border pl-11 pr-4 py-3 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
            />
          </div>
          {mode === "signup" && (
            <p className="text-[11px] text-af-muted">{t("login.auth.passwordResetNote")}</p>
          )}
        </div>

        {error && (
          <div className="rounded-[14px] bg-af-danger/10 border border-af-danger/20 px-4 py-3 text-sm text-af-danger">
            {error}
          </div>
        )}

        <button
          type="button"
          // Only ever disabled while a request is in flight. Gating this on
          // validation gave a greyed-out button with a not-allowed cursor and
          // no message — the farmer could see filled fields and a dead button.
          // submit() validates and says what is wrong instead.
          disabled={loading}
          onClick={submit}
          className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-6 py-3.5 text-sm font-semibold transition active:scale-[0.99] shadow-af-md disabled:opacity-50 disabled:hover:bg-af-primary disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {mode === "signin" ? t("login.auth.signingIn") : t("login.auth.creatingAccount")}
            </>
          ) : (
            <>
              {mode === "signin" ? t("login.auth.signIn") : t("login.auth.createAccountSubmit")}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

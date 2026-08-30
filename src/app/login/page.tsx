import { Suspense } from "react";
import LoginForm from "./LoginForm";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <LanguageProvider>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </LanguageProvider>
  );
}

"use client";

import {
  Check,
  ScrollText,
  ShieldCheck,
  X,
} from "lucide-react";

/**
 * Terms & Conditions and Privacy Policy, as full-screen modals.
 *
 * Lifted from Manan's fork (agrawalmanan/agent-farmer @ a9a11e9), where the
 * same legal text was pasted into BOTH the onboarding page and the settings
 * panel. Two copies of a legal document drift apart, so they live here once and
 * both surfaces import them.
 *
 * The wording is his; only the styling is nudged to v2 so these don't look like
 * a different product when they open.
 */


// ── Terms Modal ───────────────────────────────────────────────────────────────
export function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[28px] bg-af-card border border-af-border shadow-af-float overflow-hidden">
        <div className="flex items-center justify-between px-7 py-5 border-b border-af-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage">
              <ScrollText className="w-5 h-5 text-af-secondary" />
            </div>
            <div>
              <h2 className="font-sans text-lg font-semibold text-af-ink">Terms &amp; Conditions</h2>
              <p className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted">Agent Farmer · Last Updated 08/08/2026</p>
            </div>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-bg border border-af-border text-af-muted hover:text-af-ink hover:border-af-primary/40 transition" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto px-7 py-6 space-y-6 text-sm text-af-ink-2 leading-relaxed">
          <div className="rounded-[16px] bg-af-bg border border-af-border px-4 py-3"><p className="text-[13px] text-af-ink-2 leading-relaxed">These Terms and Conditions govern access to and use of the Agent Farmer platform, including its AI-assisted agricultural services, farm-management tools, and related features. By using Agent Farmer, you acknowledge that you have read and agree to these Terms.</p></div>
          {[
            { n: "1", t: "About Agent Farmer", p: ["Agent Farmer is an AI-assisted agricultural decision-support and farm-management platform designed to help farmers make more informed decisions throughout the crop cultivation cycle. The platform brings together farm information, environmental conditions, weather data, artificial intelligence, crop recommendations, crop monitoring, plant disease analysis, expense tracking, agricultural market information, government-scheme information, and other agricultural resources within a unified digital environment.", "The purpose of Agent Farmer is to assist farmers by making relevant agricultural information easier to understand and use. The platform is intended to support the farmer's decision-making process and is not intended to replace the farmer's experience, judgment, or professional agricultural advice."] },
            { n: "2", t: "Account Registration & User Information", p: ["Certain features require the creation of a user account. During registration, users may provide information such as name, age, gender, email address, telephone number, preferred language, and location.", "Users agree to provide information that is accurate and reasonably up to date. Users are responsible for maintaining the confidentiality of their account credentials."] },
            { n: "3", t: "Farm Registration & Agricultural Information", p: ["Agent Farmer allows users to register and manage information relating to one or more agricultural fields or farms, including geographical location, farm area, soil type, irrigation facilities, current crop, expected yield, seeding date, crop health information, cultivation activities, expenses, and alerts."] },
            { n: "4", t: "AI-Assisted Agricultural Recommendations", p: ["Agent Farmer uses artificial intelligence and data-driven systems to analyze farm information and provide agricultural recommendations. AI-generated recommendations are advisory in nature and may produce inaccurate, incomplete, or unsuitable results. The final decision regarding any agricultural activity remains with the farmer."] },
            { n: "5", t: "Crop Recommendations & Yield Estimates", p: ["The system may provide estimated yield, cultivation duration, potential benefits, and risk indicators. Such estimates are predictive and should not be interpreted as guarantees of actual agricultural performance. Agent Farmer does not guarantee any particular yield, income, profit, or successful harvest."] },
            { n: "6", t: "Weather & Environmental Information", p: ["Weather information is inherently uncertain and may change. Agent Farmer does not guarantee that weather information or forecasts will always be accurate, complete, current, or available."] },
            { n: "7", t: "AI Agricultural Assistant", p: ["AI-generated responses may contain errors or incomplete information. Users should independently verify important information and consult qualified agricultural professionals where appropriate."] },
            { n: "8", t: "Plant Disease Detection", p: ["This feature is intended as a preliminary AI-assisted screening tool and does not constitute a guaranteed agricultural diagnosis."] },
            { n: "9", t: "Market & Agricultural Information", p: ["Agent Farmer does not guarantee any particular market price, future price movement, income, or financial return."] },
            { n: "10", t: "Government Schemes & Programs", p: ["The presence of a scheme does not guarantee eligibility or application approval. Users should verify information with the relevant government department."] },
            { n: "11", t: "Fertilizer & Agricultural Input Locations", p: ["Agent Farmer does not guarantee the availability, pricing, quality, licensing, products, or services of third-party establishments."] },
            { n: "12", t: "User-Submitted Content", p: ["Users retain ownership of their original content. By submitting content, users grant Agent Farmer the permissions reasonably necessary to store, process, analyze, and display the information."] },
            { n: "13", t: "Responsible Use", p: ["Users must use Agent Farmer only for lawful and legitimate purposes. Users must not provide false information, access another user's account, interfere with operations, or compromise platform security."] },
            { n: "14", t: "Intellectual Property", p: ["The Agent Farmer platform, including software, interface, design, branding, and original components, is owned by or licensed to Agent Farmer."] },
            { n: "15", t: "Third-Party Services", p: ["Agent Farmer is not responsible for changes, interruptions, inaccuracies, or failures originating from third-party services."] },
            { n: "16", t: "Platform Availability & Changes", p: ["Agent Farmer may occasionally become unavailable and may add, modify, suspend, or discontinue features as the platform develops."] },
            { n: "17", t: "Agricultural Outcomes & Limitation of Responsibility", p: ["Agent Farmer is an agricultural decision-support platform and does not guarantee agricultural success. Agent Farmer shall not be responsible for losses resulting solely from reliance upon AI-generated recommendations."] },
            { n: "18", t: "Account Suspension or Termination", p: ["Agent Farmer may suspend or terminate access where there is a material violation of these Terms or a significant security risk."] },
            { n: "19", t: "Changes to These Terms", p: ["Agent Farmer may update these Terms. Continued use after changes constitutes acceptance of the revised Terms."] },
            { n: "20", t: "Privacy", p: ["Use of Agent Farmer is also governed by the Agent Farmer Privacy Policy."] },
            { n: "21", t: "Governing Law & Contact", p: ["These Terms shall be governed by the applicable laws of India."] },
          ].map((s) => (
            <section key={s.n} className="space-y-2">
              <h3 className="font-sans font-semibold text-af-ink text-base flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-af-primary/10 text-af-primary font-mono text-[11px] font-semibold">{s.n}</span>
                {s.t}
              </h3>
              {s.p.map((para, i) => <p key={i}>{para}</p>)}
            </section>
          ))}
        </div>
        <div className="shrink-0 flex items-center justify-end gap-3 px-7 py-5 border-t border-af-border bg-af-bg/50">
          <button onClick={onClose} className="inline-flex items-center gap-2 rounded-[14px] bg-af-card hover:bg-af-bg border border-af-border px-5 py-2.5 text-sm font-semibold text-af-ink transition active:scale-[0.98]"><X className="w-4 h-4" />Close</button>
          <button onClick={onClose} className="inline-flex items-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-5 py-2.5 text-sm font-semibold transition active:scale-[0.98] shadow-af-md"><Check className="w-4 h-4" />Got it</button>
        </div>
      </div>
    </div>
  );
}


// ── Privacy Modal ─────────────────────────────────────────────────────────────
export function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[28px] bg-af-card border border-af-border shadow-af-float overflow-hidden">
        <div className="flex items-center justify-between px-7 py-5 border-b border-af-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage">
              <ShieldCheck className="w-5 h-5 text-af-secondary" />
            </div>
            <div>
              <h2 className="font-sans text-lg font-semibold text-af-ink">Privacy Policy</h2>
              <p className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted">Agent Farmer · Last Updated 08/08/2026</p>
            </div>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-bg border border-af-border text-af-muted hover:text-af-ink hover:border-af-primary/40 transition" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto px-7 py-6 space-y-6 text-sm text-af-ink-2 leading-relaxed">
          <div className="rounded-[16px] bg-af-bg border border-af-border px-4 py-3"><p className="text-[13px] text-af-ink-2 leading-relaxed">This Privacy Policy explains how Agent Farmer collects, uses, stores, protects, and otherwise processes information when users interact with the platform and its related services.</p></div>
          {[
            { n: "1", t: "Information Covered", p: ["This Policy covers information that identifies you directly or can reasonably be linked to you, as well as information associated with your account, farms, platform interactions, and use of Agent Farmer features."] },
            { n: "2", t: "Information You Provide", p: ["When you create or use an account, you may provide details such as your name, age, gender, email address, telephone number, preferred language, and location. Please provide accurate and reasonably current information."] },
            { n: "3", t: "Farm & Agricultural Information", p: ["Agent Farmer may process information about your fields including farm location, area, soil type, irrigation facilities, crops, seeding date, expected yield, crop health, cultivation activities, expenses, and alerts."] },
            { n: "4", t: "Location Information", p: ["Location information may be used to associate a farm with local environmental conditions, weather information, maps, nearby agricultural input locations, and geographically relevant resources."] },
            { n: "5", t: "Plant Images & Disease Detection", p: ["If you use plant disease detection, you may upload photographs for analysis. Uploaded images may be retained and processed as necessary to provide this functionality."] },
            { n: "6", t: "AI Conversations & Interactions", p: ["We process the content of your questions and interactions to generate responses. Please avoid sharing unnecessary personal information. AI-generated responses are advisory."] },
            { n: "7", t: "Expense Information", p: ["If you use expense-tracking features, Agent Farmer may process expense entries, categories, amounts, dates, and farm associations you provide."] },
            { n: "8", t: "Automatically Collected Information", p: ["Certain technical and usage information may be collected automatically including device, browser, operating-system, network, log, and feature-usage information."] },
            { n: "9", t: "How We Use Information", p: ["We use information to provide and maintain Agent Farmer, create accounts, register farms, generate features, respond to interactions, protect the platform, and comply with legal obligations. We do not use your information for incompatible purposes."] },
            { n: "10", t: "AI & Automated Processing", p: ["Agent Farmer uses AI to analyze inputs and provide recommendations, estimates, image analysis, and AI-assisted responses. AI outputs may be inaccurate and are intended to support, not replace, farmer judgment."] },
            { n: "11", t: "How We Share Information", p: ["We share information only as necessary to provide Agent Farmer, meet legal obligations, or protect users. We do not sell personal information."] },
            { n: "12", t: "Third-Party Services", p: ["Agent Farmer may rely on third-party services for AI, weather, mapping, cloud infrastructure, authentication, and market data. Their independent terms and privacy policies may also apply."] },
            { n: "13", t: "Data Security", p: ["We use reasonable technical and organisational measures to protect information. Your data is stored securely via Supabase with row-level security enforced. No digital system can be guaranteed completely secure."] },
            { n: "14", t: "Data Retention", p: ["We retain information for as long as reasonably necessary to provide services, maintain records, meet legal requirements, resolve disputes, and protect the platform."] },
            { n: "15", t: "Your Privacy Rights & Choices", p: ["Subject to applicable law, you may request access to, correction of, or deletion of your personal information. Contact us using the details provided."] },
            { n: "16", t: "Withdrawal of Consent", p: ["Where processing is based on consent, you may withdraw it at any time. Withdrawal will not affect processing carried out before it was withdrawn."] },
            { n: "17", t: "Account & Data Deletion", p: ["You may request deletion of your account and associated personal information by contacting the Agent Farmer support team."] },
            { n: "18", t: "Government & Market Information", p: ["External information is provided to support access to relevant agricultural resources and may be incomplete, delayed, or subject to change. Users should verify with official sources."] },
            { n: "19", t: "Cookies & Similar Technologies", p: ["Agent Farmer may use cookies to provide functionality, maintain sessions, remember preferences, and support security."] },
            { n: "20", t: "Children's Information", p: ["Agent Farmer is not directed to children. If you believe a child has provided personal information without authorisation, please contact us."] },
            { n: "21", t: "International Data Processing", p: ["Information may be processed using service providers or infrastructure located outside your region. We will handle information in accordance with this Policy and applicable law."] },
            { n: "22", t: "Changes to This Policy", p: ["We may update this Privacy Policy to reflect changes. Continued use after an update constitutes acceptance."] },
            { n: "23", t: "Contact & Grievances", p: ["For privacy questions, requests, or grievances, please contact Agent Farmer through the platform's support channels."] },
          ].map((s) => (
            <section key={s.n} className="space-y-2">
              <h3 className="font-sans font-semibold text-af-ink text-base flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-af-primary/10 text-af-primary font-mono text-[11px] font-semibold">{s.n}</span>
                {s.t}
              </h3>
              {s.p.map((para, i) => <p key={i}>{para}</p>)}
            </section>
          ))}
        </div>
        <div className="shrink-0 flex items-center justify-end gap-3 px-7 py-5 border-t border-af-border bg-af-bg/50">
          <button onClick={onClose} className="inline-flex items-center gap-2 rounded-[14px] bg-af-card hover:bg-af-bg border border-af-border px-5 py-2.5 text-sm font-semibold text-af-ink transition active:scale-[0.98]"><X className="w-4 h-4" />Close</button>
          <button onClick={onClose} className="inline-flex items-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-5 py-2.5 text-sm font-semibold transition active:scale-[0.98] shadow-af-md"><Check className="w-4 h-4" />Got it</button>
        </div>
      </div>
    </div>
  );
}


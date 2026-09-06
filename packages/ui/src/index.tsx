// @voz/ui — reusable bilingual admin components + i18n context.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "en" | "es";

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

type Dict = Record<string, { en: string; es: string }>;

export const STRINGS: Dict = {
  appName: { en: "Voz", es: "Voz" },
  appTagline: {
    en: "Compliance-first bilingual messaging",
    es: "Mensajería bilingüe con cumplimiento integrado",
  },
  navCampaigns: { en: "Campaigns", es: "Campañas" },
  navBuilder: { en: "Campaign Builder", es: "Constructor de campañas" },
  navContacts: { en: "Contacts & Consent", es: "Contactos y Consentimiento" },
  navLive: { en: "Live Reporting", es: "Reporte en Vivo" },
  navReports: { en: "Post-Campaign Reports", es: "Reportes de Campaña" },
  navSettings: { en: "Compliance Settings", es: "Ajustes de Cumplimiento" },

  newCampaign: { en: "New campaign", es: "Nueva campaña" },
  campaignName: { en: "Campaign name", es: "Nombre de la campaña" },
  campaignType: { en: "Campaign type", es: "Tipo de campaña" },
  channel: { en: "Channel", es: "Canal" },
  language: { en: "Language", es: "Idioma" },
  status: { en: "Status", es: "Estado" },
  startFlow: { en: "Open builder", es: "Abrir constructor" },
  launch: { en: "Launch", es: "Lanzar" },
  paused: { en: "Paused", es: "Pausada" },
  draft: { en: "Draft", es: "Borrador" },
  active: { en: "Active", es: "Activa" },
  completed: { en: "Completed", es: "Completada" },

  sent: { en: "Sent", es: "Enviados" },
  delivered: { en: "Delivered", es: "Entregados" },
  failed: { en: "Failed", es: "Fallidos" },
  optedOut: { en: "Opted out", es: "Cancelados" },
  responseRate: { en: "Response rate", es: "Tasa de respuesta" },
  completionRate: { en: "Completion rate", es: "Tasa de completado" },
  responseByLanguage: { en: "Responses by language", es: "Respuestas por idioma" },
  sentimentSplit: { en: "Sentiment split", es: "Distribución de sentimiento" },
  throughput: { en: "Send throughput (hourly)", es: "Rendimiento por hora" },

  contacts: { en: "Contacts", es: "Contactos" },
  consent: { en: "Consent", es: "Consentimiento" },
  suppression: { en: "Suppression list", es: "Lista de supresión" },
  importContacts: { en: "Import contacts", es: "Importar contactos" },
  phone: { en: "Phone", es: "Teléfono" },
  name: { en: "Name", es: "Nombre" },
  source: { en: "Source", es: "Origen" },
  reason: { en: "Reason", es: "Razón" },
  disclosureVersion: { en: "Disclosure version", es: "Versión de divulgación" },

  flowCanvas: { en: "Flow canvas", es: "Lienzo de flujo" },
  addNode: { en: "Add node", es: "Agregar nodo" },
  message: { en: "Message", es: "Mensaje" },
  question: { en: "Question", es: "Pregunta" },
  branch: { en: "Branch", es: "Bifurcación" },
  unsubscribe: { en: "Unsubscribe", es: "Cancelar suscripción" },
  tag: { en: "Tag", es: "Etiqueta" },
  agent: { en: "Agent", es: "Agente" },
  done: { en: "Done", es: "Listo" },
  preview: { en: "Preview", es: "Vista previa" },
  save: { en: "Save", es: "Guardar" },
  cancel: { en: "Cancel", es: "Cancelar" },
  exportCSV: { en: "Export CSV", es: "Exportar CSV" },
  exportReport: { en: "Export report (HTML/PDF)", es: "Exportar reporte (HTML/PDF)" },
  quietHours: { en: "Quiet hours", es: "Horas silenciosas" },
  sendGate: { en: "Send gate", es: "Puerta de envío" },

  funnel: { en: "Conversion funnel", es: "Embudo de conversión" },
  auditAppendix: { en: "Audit appendix", es: "Apéndice de auditoría" },
  answerDistribution: { en: "Answer distribution", es: "Distribución de respuestas" },
  methodology: { en: "Methodology notes", es: "Notas de metodología" },
};

interface I18nCtx {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: keyof typeof STRINGS | string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof navigator !== "undefined" && /^es/i.test(navigator.language)) return "es";
    return "en";
  });
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      setLang,
      t: (key) => {
        const entry = STRINGS[key];
        return entry ? (lang === "es" ? entry.es : entry.en) : key;
      },
    }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches)
      return "dark";
    return "dark";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="Voz">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M9 21V11l7 5-7 5z" fill="#fff" />
      <rect x="18" y="11" width="4" height="10" rx="2" fill="#fff" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error" | "primary" | "blue" | "purple";
}) {
  const map: Record<string, string> = {
    neutral: "border-border text-text-muted bg-surface-offset",
    success: "border-success/30 text-success bg-success/10",
    warning: "border-warning/30 text-warning bg-warning/10",
    error: "border-error/30 text-error bg-error/10",
    primary: "border-primary/30 text-primary bg-primary/10",
    blue: "border-blue/30 text-blue bg-blue/10",
    purple: "border-purple/30 text-purple bg-purple/10",
  };
  return <span className={`chip ${map[tone]}`}>{children}</span>;
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 gap-2">
      {icon && <div className="text-text-faint mb-2">{icon}</div>}
      <p className="font-display text-base font-medium">{title}</p>
      {hint && <p className="text-sm text-text-muted max-w-sm">{hint}</p>}
    </div>
  );
}

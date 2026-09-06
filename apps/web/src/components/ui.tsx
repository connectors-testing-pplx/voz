import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div>
        <h1 className="font-display font-bold tracking-tight" style={{ fontSize: "var(--text-xl)" }}>
          {title}
        </h1>
        {subtitle && <p className="text-sm text-text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  actions,
  children,
  className = "",
  pad = true,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`card ${pad ? "card-pad" : ""} ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 mb-3.5 -mt-1">
          {title && <h2 className="font-display font-semibold text-base">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "error";
  icon?: ReactNode;
}) {
  const toneText: Record<string, string> = {
    neutral: "text-text",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    error: "text-error",
  };
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between">
        <span className="label-xs whitespace-nowrap">{label}</span>
        {icon && <span className="text-text-faint shrink-0">{icon}</span>}
      </div>
      <span className={`font-display font-bold text-2xl ${toneText[tone]}`}>{value}</span>
      {sub && <span className="text-xs text-text-muted">{sub}</span>}
    </div>
  );
}

export function statusBadge(status: string): { tone: "neutral" | "success" | "warning" | "primary" | "error"; label: string } {
  switch (status) {
    case "active":
      return { tone: "success", label: "Active" };
    case "draft":
      return { tone: "neutral", label: "Draft" };
    case "paused":
      return { tone: "warning", label: "Paused" };
    case "completed":
      return { tone: "primary", label: "Completed" };
    default:
      return { tone: "neutral", label: status };
  }
}

export function channelIcon(ch: string): string {
  return ch === "whatsapp" ? "WhatsApp" : "SMS";
}

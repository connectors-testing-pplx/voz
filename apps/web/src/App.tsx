import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import {
  Megaphone,
  Workflow,
  Users,
  Activity,
  FileBarChart,
  ShieldCheck,
  Languages,
  Sun,
  Moon,
  RotateCcw,
} from "lucide-react";
import { Logo, useI18n, useTheme } from "@voz/ui";
import { useStore } from "./lib/store";
import Campaigns from "./pages/Campaigns";
import Builder from "./pages/Builder";
import Contacts from "./pages/Contacts";
import Live from "./pages/Live";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

function Sidebar() {
  const { t } = useI18n();
  const [loc] = useLocation();
  const items = [
    { to: "/", label: t("navCampaigns"), icon: Megaphone, match: (l: string) => l === "/" },
    { to: "/builder/:id", label: t("navBuilder"), icon: Workflow, match: (l: string) => l.startsWith("/builder") },
    { to: "/contacts", label: t("navContacts"), icon: Users, match: (l: string) => l.startsWith("/contacts") },
    { to: "/live", label: t("navLive"), icon: Activity, match: (l: string) => l.startsWith("/live") },
    { to: "/reports", label: t("navReports"), icon: FileBarChart, match: (l: string) => l.startsWith("/reports") },
    { to: "/settings", label: t("navSettings"), icon: ShieldCheck, match: (l: string) => l.startsWith("/settings") },
  ];
  return (
    <aside className="hidden md:flex md:w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-divider">
        <span className="text-primary">
          <Logo size={26} />
        </span>
        <div className="leading-tight">
          <div className="font-display font-bold text-base text-text">Voz</div>
          <div className="text-[11px] text-text-faint -mt-0.5">{t("appTagline")}</div>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 p-2.5 flex-1">
        {items.map((it) => {
          const active = it.match(loc);
          return (
            <Link
              key={it.to}
              href={it.to === "/builder/:id" ? "/builder/cam_1" : it.to}
              className={`nav-link ${active ? "nav-link-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <it.icon size={17} className={active ? "text-primary" : "text-text-faint"} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-divider">
        <div className="rounded-md bg-surface-offset p-2.5 text-[11px] text-text-muted leading-snug">
          A2P 10DLC + WhatsApp · CTIA / TCPA baseline enforced · Disclosure v2026.1
        </div>
      </div>
    </aside>
  );
}

function Topbar() {
  const { lang, setLang, t } = useI18n();
  const { theme, toggle } = useTheme();
  const { resetDemo } = useStore();
  return (
    <header className="h-16 flex items-center justify-between gap-3 px-4 md:px-6 border-b border-border bg-surface sticky top-0 z-20">
      <div className="flex items-center gap-2 md:hidden">
        <span className="text-primary"><Logo size={22} /></span>
        <span className="font-display font-bold">Voz</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn-ghost px-2.5 py-2"
          aria-label="Switch language"
          onClick={() => setLang(lang === "en" ? "es" : "en")}
        >
          <Languages size={17} />
          <span className="text-sm font-medium">{lang === "en" ? "EN" : "ES"}</span>
        </button>
        <button className="btn-ghost px-2.5 py-2" aria-label="Toggle theme" onClick={toggle}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          className="btn-ghost px-2.5 py-2 hidden sm:inline-flex"
          aria-label="Reset demo data"
          onClick={resetDemo}
          title="Reset demo data"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </header>
  );
}

function MobileNav() {
  const { t } = useI18n();
  const [loc] = useLocation();
  const items = [
    { to: "/", label: "Campaigns", icon: Megaphone, match: (l: string) => l === "/" },
    { to: "/contacts", label: "Contacts", icon: Users, match: (l: string) => l.startsWith("/contacts") },
    { to: "/live", label: "Live", icon: Activity, match: (l: string) => l.startsWith("/live") },
    { to: "/reports", label: "Reports", icon: FileBarChart, match: (l: string) => l.startsWith("/reports") },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-border flex">
      {items.map((it) => {
        const active = it.match(loc);
        return (
          <Link key={it.to} href={it.to} className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-primary" : "text-text-muted"}`}>
            <it.icon size={18} />
            <span className="truncate max-w-full px-1">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Shell() {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Switch>
            <Route path="/" component={Campaigns} />
            <Route path="/builder/:id" component={Builder} />
            <Route path="/contacts" component={Contacts} />
            <Route path="/live" component={Live} />
            <Route path="/live/:id" component={Live} />
            <Route path="/reports" component={Reports} />
            <Route path="/reports/:id" component={Reports} />
            <Route path="/settings" component={Settings} />
            <Route>Campaigns</Route>
          </Switch>
        </main>
        <MobileNav />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <Shell />
    </Router>
  );
}

// In-memory app store (React context). The static GitHub-Pages build has no
// backend, so all state lives in React context for the live demo. In production
// this layer is backed by Postgres/Supabase and the apps/worker writes sends,
// responses, and suppression events via webhooks.
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppState, Campaign, Contact, ConsentRecord } from "../types";
import { buildSeed } from "./seed";
import type { Flow } from "@voz/flows";

interface StoreApi {
  state: AppState;
  updateFlow: (flowId: string, flow: Flow) => void;
  addCampaign: (c: Campaign) => void;
  updateCampaign: (id: string, patch: Partial<Campaign>) => void;
  importContacts: (rows: { firstName: string; lastName: string; phone: string; language: "en" | "es"; zip?: string; source: ConsentRecord["source"] }[]) => { added: number; deduped: number };
  removeContact: (contactId: string, reason: AppState["suppression"][number]["reason"]) => void;
  toggleSuppression: (contactId: string, phone: string, channel: "sms" | "whatsapp", on: boolean) => void;
  resetDemo: () => void;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => buildSeed());

  const api = useMemo<StoreApi>(() => {
    const update = (fn: (s: AppState) => AppState) => setState((s) => fn(s));

    return {
      state,
      updateFlow: (flowId, flow) =>
        update((s) => ({
          ...s,
          flows: s.flows.map((f) => (f.id === flowId ? flow : f)),
        })),
      addCampaign: (c) => update((s) => ({ ...s, campaigns: [c, ...s.campaigns] })),
      updateCampaign: (id, patch) =>
        update((s) => ({
          ...s,
          campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      importContacts: (rows) => {
        let added = 0;
        let deduped = 0;
        update((s) => {
          const existingPhones = new Set(s.contacts.map((c) => c.phone));
          const contacts = [...s.contacts];
          const consents = [...s.consents];
          const suppression = [...s.suppression];
          for (const r of rows) {
            const phone = r.phone.replace(/\s+/g, "");
            if (existingPhones.has(phone)) {
              deduped++;
              continue;
            }
            existingPhones.add(phone);
            const cid = "con_imp_" + Date.now() + "_" + added;
            const c: Contact = {
              id: cid,
              phone,
              firstName: r.firstName,
              lastName: r.lastName,
              language: r.language,
              zip: r.zip,
              tags: [r.language === "es" ? "latino-us" : "gen-pop"],
              createdAt: Date.now(),
            };
            contacts.push(c);
            consents.push({
              id: "cs_imp_" + Date.now() + "_" + added,
              contactId: cid,
              channel: "sms",
              source: r.source,
              language: r.language,
              disclosureVersion: "2026.1",
              timestamp: Date.now(),
              evidence: "imported-list.csv",
            } as ConsentRecord);
            added++;
          }
          return { ...s, contacts, consents, suppression };
        });
        return { added, deduped };
      },
      removeContact: (contactId, reason) =>
        update((s) => {
          const c = s.contacts.find((x) => x.id === contactId);
          if (!c) return s;
          return {
            ...s,
            suppression: [
              ...s.suppression,
              { contactId, phone: c.phone, reason, channel: "sms", source: "manual", timestamp: Date.now() },
            ],
          };
        }),
      toggleSuppression: (contactId, phone, channel, on) =>
        update((s) => {
          let suppression = s.suppression;
          if (on) {
            if (!suppression.some((e) => e.phone === phone && e.channel === channel)) {
              suppression = [...suppression, { contactId, phone, channel, reason: "manual_optout", source: "manual", timestamp: Date.now() }];
            }
          } else {
            suppression = suppression.filter((e) => !(e.phone === phone && e.channel === channel));
          }
          return { ...s, suppression };
        }),
      resetDemo: () => setState(buildSeed()),
    };
  }, [state]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}

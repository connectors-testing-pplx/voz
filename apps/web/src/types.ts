// App-level domain model. Package-level types (consent, flow, send/response)
// are imported from @voz/* packages and composed here.

import type { CampaignType, Channel, ConsentRecord, Language, RemovalReason, SuppressionEntry } from "@voz/compliance";
import type { Flow } from "@voz/flows";
import type { Response, Send } from "@voz/reports";

export type { CampaignType, Channel, ConsentRecord, Language, RemovalReason, SuppressionEntry } from "@voz/compliance";

export interface Organization {
  id: string;
  name: string;
  type: CampaignType;
}

export interface Client {
  id: string;
  orgId: string;
  name: string;
  senderId: string; // registered A2P sender / WhatsApp number
}

export interface Contact {
  id: string;
  phone: string; // E.164
  firstName: string;
  lastName: string;
  language: Language;
  zip?: string;
  tags: string[];
  createdAt: number;
}

export interface Campaign {
  id: string;
  name: string;
  orgId: string;
  clientId: string;
  type: CampaignType;
  channel: Channel;
  language: Language;
  senderId: string;
  flowId: string;
  disclosureVersion: string;
  status: "draft" | "paused" | "active" | "completed";
  scheduledAt?: number;
  createdAt: number;
}

export interface AppState {
  organizations: Organization[];
  clients: Client[];
  contacts: Contact[];
  consents: ConsentRecord[];
  suppression: SuppressionEntry[];
  flows: Flow[];
  campaigns: Campaign[];
  sends: Send[];
  responses: Response[];
  completions: Record<string, string[]>; // campaignId -> contactIds that reached completion
}

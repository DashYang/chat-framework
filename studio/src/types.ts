export type MessageKind = "text" | "image" | "link-card" | "status";

export interface Participant {
  id: string;
  name: string;
  avatar: string;
  bio: string;
}

export interface Asset {
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

export interface Message {
  id: string;
  senderId: string;
  timeRaw: string;
  kind: MessageKind;
  text: string;
  imageSource?: string;
  caption?: string;
  linkCard?: { url: string; title: string; desc: string; image: string; site: string };
  quoteId: string;
  recallDelaySec: number;
}

export interface AuthoringProject {
  schemaVersion: string;
  id: string;
  title: string;
  theme: string;
  selfId: string;
  participants: Participant[];
  conversation: { id: string; title: string; type: string; messages: Message[] };
  assets: Asset[];
}

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  path?: string;
  entityId?: string;
  field?: string;
}

export interface ProjectSummary { id: string; title: string; updatedAt: number }

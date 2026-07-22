export type MessageKind = "text" | "image" | "link-card" | "status" | "choice";

export interface Requirement {
  requireScore?: number;
  requireFlags?: string[];
  requireScope?: "account" | "global";
}

export interface IdentityTimelineEntry {
  id: string;
  effectiveAt: string;
  name: string;
  avatar: string;
  bio: string;
}

export interface Participant {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  identityTimeline: IdentityTimelineEntry[];
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
  requireScore?: number;
  requireFlags?: string[];
  requireScope?: "account" | "global";
  choice?: {
    prompt: string;
    speakerId: string;
    scope: "account" | "global";
    options: Array<{ id: string; label: string; text: string; score: number; flags: string[] }>;
  };
}

export interface Conversation extends Requirement {
  id: string;
  title: string;
  type: "single" | "group";
  selfId: string;
  messages: Message[];
}

export interface SocialPost extends Requirement {
  id: string;
  authorId: string;
  publishAt: string;
  text: string;
  images: string[];
  requireScore?: number;
  requireFlags?: string[];
  requireScope?: "account" | "global";
}

export interface Article extends Requirement {
  id: string;
  authorId: string;
  publishAt: string;
  title: string;
  cover: string;
  summary: string;
  body: string;
  images: string[];
  requireScore?: number;
  requireFlags?: string[];
  requireScope?: "account" | "global";
}

export interface LibraryDocument {
  id: string;
  type: "settings" | "timeline";
  title: string;
  items: Array<{
    id: string;
    name: string;
    image: string;
    time: string;
    description: string;
    participantIds: string[];
  }>;
}

export interface StoryConfig {
  enabled: boolean;
  accountOrder: string[];
  title: string;
  favicon: string;
  resetInfo: string;
  resetAccount: string;
  endInfo: string;
}

export interface AuthoringProject {
  schemaVersion: string;
  id: string;
  title: string;
  theme: string;
  statusBarCarrier: string;
  selfId: string;
  participants: Participant[];
  conversations: Conversation[];
  socialPosts: SocialPost[];
  articles: Article[];
  documents: LibraryDocument[];
  story: StoryConfig;
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

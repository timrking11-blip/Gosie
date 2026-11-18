export type SocialContext = "all" | "solo" | "friends" | "date" | "group" | "family";
export type WeekGrouping = "company" | "category" | "chronological";
export type FeedbackAction = "saved" | "dismissed" | "rating";

export interface CustomInterest {
  id?: string;
  label: string;
  category?: string;
  specificInterest?: string;
  desiredExperience?: string;
  priority?: number;
}

export interface ProfileConfig {
  schemaVersion: "1.0.0-draft";
  balance: "professional" | "personal" | "balanced";
  weekGrouping: WeekGrouping;
  weekNested?: string | null;
  budgetPerActivity: number;
  budgetHard: boolean;
  maxTravelMinutes: number;
  exceptionTravelMinutes: number;
  allowExceptions: boolean;
  transportModes: string[];
  homeBase?: string | null;
  weekendInterests: string[];
  customInterests: CustomInterest[];
  socialContexts: string[];
  surpriseMe: boolean;
  balancedPriorities?: string[];
  customSections?: unknown[];
}

export interface SessionResponse {
  authenticated: boolean;
  user?: { id: string; email: string };
  csrfToken?: string;
  expiresAt?: string;
}

export interface Profile {
  id: string;
  title: string;
  isDemo: boolean;
  config: ProfileConfig;
  createdAt?: string;
}

export interface WeekItem {
  id: string;
  day: string;
  timeLabel: string | null;
  title: string;
  category: string;
  company: string | null;
  domain: "professional" | "personal";
  priority: "High" | "Medium" | "Low";
  completed: boolean;
  sourceType?: "user-entered" | "fictional-demo";
  carriedFromId?: string | null;
  createdAt?: string;
}

export interface WeekResponse {
  profileId: string;
  weekStart: string;
  grouping: WeekGrouping;
  items: WeekItem[];
  groups: Record<string, WeekItem[]>;
  why: string[];
}

export interface FeedbackItem {
  itemId: string;
  action: FeedbackAction;
  rating: number | null;
  createdAt?: string;
}

export interface WeekendIdea {
  id: string;
  name: string;
  category: string;
  price: number;
  travelMinutes: number;
  transport: string;
  social: string[];
  interests: string[];
  sourceType: "fictional-demo";
  score: number | null;
  status: "included" | "exception" | "excluded" | "dismissed";
  why: string[];
  excludeReasons: string[];
  saved: boolean;
  rating: number | null;
}

export interface WeekendResponse {
  profileId: string;
  social: SocialContext;
  included: WeekendIdea[];
  exceptions: WeekendIdea[];
  excluded: WeekendIdea[];
  dismissed: WeekendIdea[];
  includedCount: number;
  exceptionCount: number;
  excludedCount: number;
  dismissedCount: number;
}

export interface ProfileExport {
  schemaVersion: "1.0.0-draft";
  title: string;
  config: ProfileConfig;
  weekItems: WeekItem[];
  feedback: FeedbackItem[];
}

export interface ApiError {
  error: string;
  detail?: string;
}

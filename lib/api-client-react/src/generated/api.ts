import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ApiError,
  FeedbackAction,
  FeedbackItem,
  Profile,
  ProfileConfig,
  ProfileExport,
  SessionResponse,
  SocialContext,
  WeekItem,
  WeekResponse,
  WeekendResponse,
} from "./api.schemas";

let csrfToken: string | undefined;

export function setApiCsrfToken(token?: string) {
  csrfToken = token;
}

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; csrf?: boolean } = {},
): Promise<T> {
  const method = options.method || "GET";
  const headers = new Headers();
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.csrf !== false && !["GET", "HEAD"].includes(method) && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  const response = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = payload.error;
    throw error;
  }
  return payload as T;
}

export const getSessionQueryKey = () => ["gosie", "session"] as const;
export const getProfilesQueryKey = () => ["gosie", "profiles"] as const;
export const getDemoProfilesQueryKey = () => ["gosie", "demo-profiles"] as const;
export const getWeekQueryKey = (profileId?: string, weekStart?: string) => ["gosie", "week", profileId, weekStart] as const;
export const getWeekendQueryKey = (profileId?: string, social?: SocialContext) => ["gosie", "weekend", profileId, social] as const;
export const getFeedbackQueryKey = (profileId?: string) => ["gosie", "feedback", profileId] as const;

export function useSession() {
  return useQuery({
    queryKey: getSessionQueryKey(),
    queryFn: async () => {
      const session = await apiRequest<SessionResponse>("/auth/session");
      setApiCsrfToken(session.authenticated ? session.csrfToken : undefined);
      return session;
    },
    retry: false,
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: { email: string; password: string; pilotConsent: boolean }) =>
      apiRequest<{ id: string; email: string }>("/auth/register", { method: "POST", body: input, csrf: false }),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const result = await apiRequest<{ user: { id: string; email: string }; csrfToken: string; expiresAt: string }>(
        "/auth/login",
        { method: "POST", body: input, csrf: false },
      );
      setApiCsrfToken(result.csrfToken);
      return result;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(getSessionQueryKey(), {
        authenticated: true,
        user: result.user,
        csrfToken: result.csrfToken,
        expiresAt: result.expiresAt,
      } satisfies SessionResponse);
      queryClient.invalidateQueries({ queryKey: getProfilesQueryKey() });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<{ status: string }>("/auth/logout", { method: "POST", body: {} }),
    onSettled: () => {
      setApiCsrfToken(undefined);
      queryClient.clear();
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<{ status: string }>("/auth/account", { method: "DELETE", body: {} }),
    onSettled: () => {
      setApiCsrfToken(undefined);
      queryClient.clear();
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: getProfilesQueryKey(),
    queryFn: async () => (await apiRequest<{ profiles: Profile[] }>("/profiles")).profiles,
  });
}

export function useDemoProfiles() {
  return useQuery({
    queryKey: getDemoProfilesQueryKey(),
    queryFn: async () => (await apiRequest<{ profiles: Profile[] }>("/demo-profiles")).profiles,
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; config: ProfileConfig }) =>
      apiRequest<{ id: string; title: string; config: ProfileConfig }>("/profiles", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getProfilesQueryKey() }),
  });
}

export function useCopyDemoProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { demoId: string; title?: string }) =>
      apiRequest<{ id: string; title: string; sampleWeekAdded: boolean }>("/profiles/copy-demo", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getProfilesQueryKey() }),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; title: string; config: ProfileConfig }) =>
      apiRequest<{ id: string }>(`/profiles/${encodeURIComponent(input.id)}`, {
        method: "PUT",
        body: { title: input.title, config: input.config },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getProfilesQueryKey() }),
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) =>
      apiRequest<{ status: string }>(`/profiles/${encodeURIComponent(profileId)}`, { method: "DELETE", body: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getProfilesQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["gosie", "week"] });
      queryClient.invalidateQueries({ queryKey: ["gosie", "weekend"] });
    },
  });
}

export function useExportProfile() {
  return useMutation({
    mutationFn: (profileId: string) => apiRequest<ProfileExport>(`/profiles/${encodeURIComponent(profileId)}/export`),
  });
}

export function useImportProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileExport) => apiRequest<{ id: string; title: string }>("/profiles/import", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getProfilesQueryKey() }),
  });
}

export function useWeek(profileId?: string, weekStart?: string) {
  return useQuery({
    queryKey: getWeekQueryKey(profileId, weekStart),
    enabled: Boolean(profileId && weekStart),
    queryFn: () => apiRequest<WeekResponse>(
      `/week?profile_id=${encodeURIComponent(profileId!)}&week_start=${encodeURIComponent(weekStart!)}`,
    ),
  });
}

export function useCreateWeekItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { profileId: string; weekStart: string; item: Omit<WeekItem, "id" | "createdAt" | "carriedFromId"> }) =>
      apiRequest<{ item: WeekItem }>(`/week?profile_id=${encodeURIComponent(input.profileId)}`, { method: "POST", body: input.item }),
    onSuccess: (_data, input) => queryClient.invalidateQueries({ queryKey: getWeekQueryKey(input.profileId, input.weekStart) }),
  });
}

export function useCopyDemoWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { profileId: string; weekStart: string }) =>
      apiRequest<{ items: WeekItem[] }>(
        `/week/copy-demo?profile_id=${encodeURIComponent(input.profileId)}&week_start=${encodeURIComponent(input.weekStart)}`,
        { method: "POST", body: {} },
      ),
    onSuccess: (_data, input) => queryClient.invalidateQueries({ queryKey: getWeekQueryKey(input.profileId, input.weekStart) }),
  });
}

export function useUpdateWeekItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { profileId: string; weekStart: string; itemId: string; update: Partial<WeekItem> }) =>
      apiRequest<{ item: WeekItem }>(
        `/week/${encodeURIComponent(input.itemId)}?profile_id=${encodeURIComponent(input.profileId)}`,
        { method: "PATCH", body: input.update },
      ),
    onSuccess: (_data, input) => queryClient.invalidateQueries({ queryKey: getWeekQueryKey(input.profileId, input.weekStart) }),
  });
}

export function useDeleteWeekItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { profileId: string; weekStart: string; itemId: string }) =>
      apiRequest<{ status: string }>(
        `/week/${encodeURIComponent(input.itemId)}?profile_id=${encodeURIComponent(input.profileId)}`,
        { method: "DELETE", body: {} },
      ),
    onSuccess: (_data, input) => queryClient.invalidateQueries({ queryKey: getWeekQueryKey(input.profileId, input.weekStart) }),
  });
}

export function useCarryForwardWeekItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { profileId: string; weekStart: string; itemId: string }) =>
      apiRequest<{ item: WeekItem }>(
        `/week/${encodeURIComponent(input.itemId)}/carry-forward?profile_id=${encodeURIComponent(input.profileId)}`,
        { method: "POST", body: {} },
      ),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: getWeekQueryKey(input.profileId, input.weekStart) });
      queryClient.invalidateQueries({ queryKey: getWeekQueryKey(input.profileId) });
    },
  });
}

export function useWeekend(profileId?: string, social: SocialContext = "all") {
  return useQuery({
    queryKey: getWeekendQueryKey(profileId, social),
    enabled: Boolean(profileId),
    queryFn: () => apiRequest<WeekendResponse>(
      `/weekend?profile_id=${encodeURIComponent(profileId!)}&social=${encodeURIComponent(social)}`,
    ),
  });
}

export function useFeedback(profileId?: string) {
  return useQuery({
    queryKey: getFeedbackQueryKey(profileId),
    enabled: Boolean(profileId),
    queryFn: async () => (await apiRequest<{ feedback: FeedbackItem[] }>(`/feedback?profile_id=${encodeURIComponent(profileId!)}`)).feedback,
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { profileId: string; itemId: string; action: FeedbackAction; rating?: number; value?: boolean }) =>
      apiRequest("/feedback", { method: "POST", body: input }),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: getFeedbackQueryKey(input.profileId) });
      queryClient.invalidateQueries({ queryKey: ["gosie", "weekend", input.profileId] });
    },
  });
}

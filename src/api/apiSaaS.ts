const base = () => (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function request<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const { token: _t, ...rest } = opts;
  const res = await fetch(`${base()}${path}`, { ...rest, headers });
  if (!res.ok) {
    let detail: string = res.statusText;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type UserOut = {
  id: number;
  email: string;
  name: string | null;
  is_admin?: boolean;
};

export type AdminUserRow = {
  id: number;
  email: string;
  name: string | null;
  is_admin: boolean;
  created_at: string;
  password_note: string;
};

export async function apiRegister(body: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ access_token: string; token_type: string }> {
  return request("/api/auth/register", { method: "POST", body: JSON.stringify(body) });
}

export async function apiLogin(body: {
  email: string;
  password: string;
}): Promise<{ access_token: string; token_type: string }> {
  return request("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
}

export async function apiMe(token: string): Promise<UserOut> {
  return request("/api/auth/me", { token, method: "GET" });
}

export async function apiChangePassword(
  token: string,
  body: { current_password: string; new_password: string },
): Promise<{ ok: boolean }> {
  return request("/api/auth/me/password", {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type ShopOut = {
  id: number;
  name: string;
  check_interval_hours: number;
  check_interval_minutes: number;
  woocommerce_configured: boolean;
  woo_currency: string | null;
};

export async function apiListShops(token: string): Promise<ShopOut[]> {
  return request("/api/shops", { token, method: "GET" });
}

export async function apiCreateShop(token: string, body: { name: string }): Promise<ShopOut> {
  return request("/api/shops", { token, method: "POST", body: JSON.stringify(body) });
}

export async function apiGetShop(token: string, shopId: number): Promise<ShopOut> {
  return request(`/api/shops/${shopId}`, { token, method: "GET" });
}

export async function apiUpdateShop(
  token: string,
  shopId: number,
  body: Partial<{ name: string; check_interval_hours: number; check_interval_minutes: number }>,
): Promise<ShopOut> {
  return request(`/api/shops/${shopId}`, { token, method: "PATCH", body: JSON.stringify(body) });
}

export type DashboardRecommendation = { id: string; text: string };

export type DashboardStats = {
  product_count: number;
  products_with_competitors: number;
  competitor_links: number;
  check_interval_minutes: number;
  total_scans: number;
  scans_in_last_interval_window: number;
  scans_expected_per_full_cycle: number;
  worker_interval_seconds: number;
  queue_explanation: string;
  estimated_full_queue_minutes_rounded: number;
  recommendations: DashboardRecommendation[];
};

export async function apiDashboardStats(token: string, shopId: number): Promise<DashboardStats> {
  return request(`/api/shops/${shopId}/dashboard-stats`, { token, method: "GET" });
}

export type SetupStep = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  cta_label: string;
  cta_path: string;
};

export type SetupChecklistResponse = {
  dismissed: boolean;
  percent_complete: number;
  steps: SetupStep[];
};

export async function apiSetupChecklist(
  token: string,
  shopId: number,
): Promise<SetupChecklistResponse> {
  return request(`/api/shops/${shopId}/setup-checklist`, { token, method: "GET" });
}

export async function apiDismissSetupChecklist(token: string, shopId: number): Promise<{ ok: boolean }> {
  return request(`/api/shops/${shopId}/setup-checklist/dismiss`, { token, method: "POST" });
}

export type HealthIssue = {
  code: string;
  severity: string;
  title: string;
  detail: string;
};

export type AccountHealth = {
  status: "ok" | "warning" | "critical";
  score: number;
  issues: HealthIssue[];
  summary: string;
};

export async function apiAccountHealth(token: string, shopId: number): Promise<AccountHealth> {
  return request(`/api/shops/${shopId}/account-health`, { token, method: "GET" });
}

export async function apiWeeklyReportCsv(token: string, shopId: number): Promise<Blob> {
  const res = await fetch(`${base()}/api/shops/${shopId}/reports/weekly.csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}

export type TrackedCompetitorRow = {
  id: number;
  domain: string;
  display_name: string;
  links_count: number;
};

export async function apiListTrackedCompetitors(
  token: string,
  shopId: number,
): Promise<TrackedCompetitorRow[]> {
  return request(`/api/shops/${shopId}/tracked-competitors`, { token, method: "GET" });
}

export async function apiPatchTrackedCompetitor(
  token: string,
  shopId: number,
  trackedId: number,
  body: { display_name: string },
): Promise<TrackedCompetitorRow> {
  return request(`/api/shops/${shopId}/tracked-competitors/${trackedId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type ScanLogRow = {
  id: number;
  created_at: string;
  product_name: string;
  competitor_domain: string;
  our_price: number | null;
  competitor_price: number | null;
  previous_competitor_price: number | null;
  price_changed: boolean;
  comparison: string;
  comparison_label: string;
};

export type ScanLogsResponse = {
  items: ScanLogRow[];
  total: number;
};

export async function apiScanLogs(
  token: string,
  shopId: number,
  skip = 0,
  limit = 50,
): Promise<ScanLogsResponse> {
  return request(`/api/shops/${shopId}/scan-logs?skip=${skip}&limit=${limit}`, {
    token,
    method: "GET",
  });
}

export async function apiSyncShop(token: string, shopId: number): Promise<{ synced: number }> {
  return request(`/api/shops/${shopId}/sync`, { token, method: "POST" });
}

export type ProductOut = {
  id: number;
  name: string;
  sku: string | null;
  permalink: string | null;
  image_url: string | null;
  category_name?: string | null;
  category_path?: string | null;
  regular_price: number | null;
  competitors_count: number;
  shop_currency: string | null;
  auto_pricing_enabled: boolean;
  auto_pricing_min_price: number | null;
  auto_pricing_trigger_kind: "percent" | "amount";
  auto_pricing_trigger_value: number | null;
  auto_pricing_action_kind: "percent" | "amount";
  auto_pricing_action_value: number | null;
  auto_pricing_strategy: "reactive_down" | "smart_anchor";
};

type ProductListResponse =
  | ProductOut[]
  | { items: ProductOut[]; total?: number; skip?: number; limit?: number };
export type ProductCategoryRow = {
  name: string;
  count: number;
};

export type CompetitorIntelRow = {
  tracked_competitor_id: number | null;
  competitor_name: string;
  domain: string;
  links_count: number;
  current_cheaper: number;
  current_expensive: number;
  current_tie: number;
  current_compared: number;
  price_changes_in_period: number;
  last_price_change_at: string | null;
};

export type CompetitorIntelligenceOut = {
  period_days: number;
  current_overall: {
    cheaper: number;
    expensive: number;
    tie: number;
    compared: number;
  };
  total_price_changes_in_period: number;
  competitors: CompetitorIntelRow[];
};

export async function apiListProducts(
  token: string,
  shopId: number,
  opts?: { q?: string; category?: string; skip?: number; limit?: number },
): Promise<{ items: ProductOut[]; total: number; skip: number; limit: number }> {
  const p = new URLSearchParams();
  if (opts?.q) p.set("q", opts.q);
  if (opts?.category) p.set("category", opts.category);
  if (opts?.skip != null) p.set("skip", String(opts.skip));
  if (opts?.limit != null) p.set("limit", String(opts.limit));
  const d = p.toString() ? `?${p.toString()}` : "";

  const data = await request<ProductListResponse>(`/api/shops/${shopId}/products${d}`, {
    token,
    method: "GET",
  });

  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      skip: opts?.skip ?? 0,
      limit: opts?.limit ?? 50,
    };
  }

  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: typeof data.total === "number" ? data.total : 0,
    skip: typeof data.skip === "number" ? data.skip : (opts?.skip ?? 0),
    limit: typeof data.limit === "number" ? data.limit : (opts?.limit ?? 50),
  };

}

export async function apiProductCategories(token: string, shopId: number): Promise<ProductCategoryRow[]> {
  return request(`/api/shops/${shopId}/products/categories`, { token, method: "GET" });
}

export async function apiCompetitorIntelligence(
  token: string,
  shopId: number,
  days: number = 30,
): Promise<CompetitorIntelligenceOut> {
  return request(`/api/shops/${shopId}/competitors/intelligence?days=${days}`, {
    token,
    method: "GET",
  });
}

export async function apiPatchProductAutoPricing(
  token: string,
  shopId: number,
  productId: number,
  body: Partial<{
    auto_pricing_enabled: boolean;
    auto_pricing_min_price: number | null;
    auto_pricing_trigger_kind: "percent" | "amount";
    auto_pricing_trigger_value: number | null;
    auto_pricing_action_kind: "percent" | "amount";
    auto_pricing_action_value: number | null;
    auto_pricing_strategy: "reactive_down" | "smart_anchor";
  }>,
): Promise<ProductOut> {
  return request(`/api/shops/${shopId}/products/${productId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiCompetitorLabels(
  token: string,
  shopId: number,
): Promise<{ labels: string[] }> {
  return request(`/api/shops/${shopId}/competitor-labels`, { token, method: "GET" });
}

export type CompetitorOut = {
  id: number;
  url: string;
  label: string | null;
  domain: string;
  display_name: string;
  tracked_competitor_id: number | null;
  last_price: number | null;
  last_checked_at: string | null;
  price_status: "live" | "processing";
};

export async function apiListCompetitors(
  token: string,
  shopId: number,
  productId: number,
): Promise<CompetitorOut[]> {
  return request(`/api/shops/${shopId}/products/${productId}/competitors`, {
    token,
    method: "GET",
  });
}

export async function apiAddCompetitor(
  token: string,
  shopId: number,
  productId: number,
  body: {
    url: string;
    tracked_competitor_id?: number;
    competitor_name?: string;
    label?: string;
  },
): Promise<CompetitorOut> {
  return request(`/api/shops/${shopId}/products/${productId}/competitors`, {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiBulkAddCompetitors(
  token: string,
  shopId: number,
  productId: number,
  body: { urls_text: string; label_prefix?: string | null },
): Promise<{ added: number; lines_processed: number }> {
  return request(`/api/shops/${shopId}/products/${productId}/competitors/bulk`, {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiCheckCompetitor(
  token: string,
  shopId: number,
  competitorId: number,
): Promise<{
  price: number | null;
  currency: string | null;
  price_status: "live" | "processing";
}> {
  return request(`/api/shops/${shopId}/competitors/${competitorId}/check`, {
    token,
    method: "POST",
  });
}

export type SnapshotOut = {
  id: number;
  price: number | null;
  currency: string | null;
  fetched_at: string;
};

export async function apiSnapshots(
  token: string,
  shopId: number,
  competitorId: number,
): Promise<SnapshotOut[]> {
  return request(`/api/shops/${shopId}/competitors/${competitorId}/snapshots`, {
    token,
    method: "GET",
  });
}

export type AlertOut = {
  id: number;
  message: string;
  severity: string;
  read: boolean;
  created_at: string;
  kind: string;
};

export type NotificationPreferences = {
  notify_competitor_cheaper: boolean;
  notify_price_change: boolean;
  notify_auto_pricing: boolean;
  notify_sanity: boolean;
};

export async function apiGetNotificationPreferences(
  token: string,
  shopId: number,
): Promise<NotificationPreferences> {
  return request(`/api/shops/${shopId}/notification-preferences`, { token, method: "GET" });
}

export async function apiPatchNotificationPreferences(
  token: string,
  shopId: number,
  body: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return request(`/api/shops/${shopId}/notification-preferences`, {
    token,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiDismissRecommendations(
  token: string,
  shopId: number,
  ids: string[],
): Promise<{ ok: boolean; dismissed_count: number }> {
  return request(`/api/shops/${shopId}/recommendations/dismiss`, {
    token,
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export async function apiListAlerts(
  token: string,
  shopId: number,
  unreadOnly?: boolean,
): Promise<AlertOut[]> {
  const h = unreadOnly ? "?unread_only=true" : "";
  return request(`/api/shops/${shopId}/alerts${h}`, { token, method: "GET" });
}

export async function apiReadAlert(token: string, shopId: number, alertId: number) {
  return request(`/api/shops/${shopId}/alerts/${alertId}/read`, { token, method: "POST" });
}

export async function apiReadAllAlerts(token: string, shopId: number) {
  return request(`/api/shops/${shopId}/alerts/read-all`, { token, method: "POST" });
}

export type PriceSeriesPoint = { t: string; price: number; samples?: number };

export async function apiPriceSeries(
  token: string,
  shopId: number,
  productId?: number,
  competitorId?: number,
  /** hourly_min: מחיר מינימום בשוק לכל שעה — מתאים לדשבורד (לא מחבר מוצרים שונים בזיגזג) */
  aggregate?: "hourly_min" | null,
): Promise<{ points: PriceSeriesPoint[] }> {
  const p = new URLSearchParams();
  if (productId != null) p.set("product_id", String(productId));
  if (competitorId != null) p.set("competitor_id", String(competitorId));
  if (aggregate) p.set("aggregate", aggregate);
  const q = p.toString();
  return request(`/api/shops/${shopId}/analytics/price-series${q ? `?${q}` : ""}`, {
    token,
    method: "GET",
  });
}

export async function apiSnapshotsExport(token: string, shopId: number): Promise<Blob> {
  const res = await fetch(
    `${base()}/api/shops/${shopId}/analytics/snapshots-export`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}

export async function apiInsights(token: string, shopId: number): Promise<{ summary: string }> {
  return request(`/api/shops/${shopId}/insights`, { token, method: "GET" });
}

export type MemberOut = { user_id: number; email: string; role: string };

export type OwnershipTransferRow = {
  id: number;
  shop_id: number;
  shop_name: string;
  from_user_id: number;
  from_email: string;
  to_user_id: number;
  to_email: string;
  status: "pending" | "accepted" | "declined" | "canceled" | "expired" | string;
  note: string | null;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
};

export async function apiMembers(token: string, shopId: number): Promise<MemberOut[]> {
  return request(`/api/shops/${shopId}/members`, { token, method: "GET" });
}

export async function apiInvite(
  token: string,
  shopId: number,
  body: { email: string; role?: string },
): Promise<{ token: string }> {
  return request(`/api/shops/${shopId}/invites`, { token, method: "POST", body: JSON.stringify(body) });
}

export async function apiOwnershipTransferCreate(
  token: string,
  shopId: number,
  body: { target_email: string; note?: string },
): Promise<OwnershipTransferRow> {
  return request(`/api/shops/${shopId}/ownership-transfer/request`, {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiOwnershipTransferIncoming(token: string): Promise<OwnershipTransferRow[]> {
  return request("/api/shops/ownership-transfer/requests/incoming", { token, method: "GET" });
}

export async function apiOwnershipTransferOutgoing(token: string): Promise<OwnershipTransferRow[]> {
  return request("/api/shops/ownership-transfer/requests/outgoing", { token, method: "GET" });
}

export async function apiOwnershipTransferApprove(token: string, requestId: number): Promise<OwnershipTransferRow> {
  return request(`/api/shops/ownership-transfer/requests/${requestId}/approve`, {
    token,
    method: "POST",
  });
}

export async function apiOwnershipTransferDecline(token: string, requestId: number): Promise<OwnershipTransferRow> {
  return request(`/api/shops/ownership-transfer/requests/${requestId}/decline`, {
    token,
    method: "POST",
  });
}

export async function apiOwnershipTransferCancel(token: string, requestId: number): Promise<OwnershipTransferRow> {
  return request(`/api/shops/ownership-transfer/requests/${requestId}/cancel`, {
    token,
    method: "POST",
  });
}

export type ApiKeyOut = { id: number; name: string; created_at: string; prefix: string };

export async function apiListApiKeys(token: string, shopId: number): Promise<ApiKeyOut[]> {
  return request(`/api/shops/${shopId}/api-keys`, { token, method: "GET" });
}

export async function apiCreateApiKey(
  token: string,
  shopId: number,
  body: { name: string },
): Promise<{ id: number; raw_key: string }> {
  return request(`/api/shops/${shopId}/api-keys`, {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiDeleteApiKey(token: string, shopId: number, keyId: number) {
  return request(`/api/shops/${shopId}/api-keys/${keyId}`, { token, method: "DELETE" });
}

export async function apiWooConfig(
  token: string,
  shopId: number,
  body: { site_url: string; consumer_key: string; consumer_secret: string },
): Promise<{ ok: boolean; woo_currency: string | null }> {
  return request(`/api/shops/${shopId}/woocommerce`, {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type PriceCandidate = {
  price_text: string;
  score: number;
  selector: string;
  selector_alternates?: string[];
};

export type PriceResolveOut = {
  url: string;
  domain: string;
  price: number | null;
  currency: string | null;
  source: string | null;
  learned_selector: string | null;
  candidates: PriceCandidate[];
  resolution_token: string | null;
};

export async function apiPriceResolve(body: { url: string }): Promise<PriceResolveOut> {
  return request("/api/price/resolve", { method: "POST", body: JSON.stringify(body) });
}

/** פאנל אדמין — אפשר להתעלם מסלקטור שמור ולקבל רשימת מועמדים מחדש */
export async function apiAdminPriceResolve(
  token: string,
  body: { url: string; ignore_saved_selector: boolean },
): Promise<PriceResolveOut> {
  return request("/api/admin/price-resolve", {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiPriceConfirm(body: {
  url: string;
  css_selector: string;
  resolution_token?: string | null;
  selector_alternates?: string[];
}): Promise<{ ok: boolean; domain: string }> {
  return request("/api/price/confirm", { method: "POST", body: JSON.stringify(body) });
}

/** תוסף ישן (ping בלבד) — להקמת חנות משתמשים ב־apiDownloadWpPluginZip לפי חנות. */
export function getPluginDownloadUrl(): string {
  return `${base()}/api/plugin/download-zip`;
}

export async function apiDownloadWpPluginZip(
  token: string,
  shopId: number,
  opts?: { apiBase?: string | null },
): Promise<Blob> {
  const q = new URLSearchParams();
  if (opts?.apiBase) q.set("api_base", opts.apiBase);
  const suffix = q.toString() ? `?${q}` : "";
  const res = await fetch(`${base()}/api/shops/${shopId}/wordpress-plugin.zip${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.blob();
}

export async function apiDownloadCompetitorsTemplate(
  token: string,
  shopId: number,
  category?: string | null,
): Promise<Blob> {
  const q = new URLSearchParams();
  if (category) q.set("category", category);
  const suffix = q.toString() ? `?${q}` : "";
  const res = await fetch(`${base()}/api/shops/${shopId}/competitors-import-template.xlsx${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}

export async function apiImportCompetitorsExcel(
  token: string,
  shopId: number,
  file: File,
): Promise<{ added: number; updated: number; skipped: number; errors: string[] }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${base()}/api/shops/${shopId}/competitors-import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export type PriceSanitySettings = {
  enabled: boolean;
  abs_min: number;
  abs_max: number;
  vs_prev_max_multiplier: number;
  vs_ours_max_multiplier: number;
  updated_at: string;
};

export async function apiAdminGetPriceSanity(token: string): Promise<PriceSanitySettings> {
  return request("/api/admin/price-sanity", { token, method: "GET" });
}

export async function apiAdminPatchPriceSanity(
  token: string,
  body: Partial<{
    enabled: boolean;
    abs_min: number;
    abs_max: number;
    vs_prev_max_multiplier: number;
    vs_ours_max_multiplier: number;
  }>,
): Promise<PriceSanitySettings> {
  return request("/api/admin/price-sanity", {
    token,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiShopifyOAuthStart(token: string): Promise<{ url: string }> {
  return request("/api/integrations/shopify/oauth/start", { token, method: "GET" });
}

export async function apiStripeBillingPortal(token: string): Promise<{ url: string }> {
  return request("/api/integrations/stripe/billing-portal", { token, method: "POST" });
}

export async function apiAdminUsers(token: string): Promise<AdminUserRow[]> {
  return request("/api/admin/users", { token, method: "GET" });
}

export async function apiAdminPatchUser(
  token: string,
  userId: number,
  body: { email?: string; name?: string | null; is_admin?: boolean },
): Promise<AdminUserRow> {
  return request(`/api/admin/users/${userId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiAdminSetPassword(token: string, userId: number, newPassword: string) {
  return request(`/api/admin/users/${userId}/password`, {
    token,
    method: "POST",
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export type DomainReviewRow = {
  queue_item_id: number | null;
  domain: string;
  shop_id: number | null;
  product_name: string | null;
  source: string;
  reporter_note: string | null;
  status: string;
  sample_url: string;
  pending_price: number | null;
  pending_currency: string | null;
  suggested_selector: string | null;
  candidates: { price_text?: string; selector?: string; score?: number }[];
  updated_at: string;
};

export async function apiAdminDomainReviews(
  token: string,
  statusFilter: "pending" | "all" = "pending",
): Promise<DomainReviewRow[]> {
  return request(`/api/admin/domain-price-reviews?status_filter=${statusFilter}`, {
    token,
    method: "GET",
  });
}

export async function apiAdminApproveDomain(
  token: string,
  body: {
    domain: string;
    css_selector: string;
    selector_alternates?: string[];
    queue_item_id?: number | null;
  },
): Promise<{
  ok: boolean;
  domain: string;
  validated_price: number;
  re_scanned: number;
  re_scan_errors: string[];
}> {
  return request("/api/admin/domain-price-reviews/approve", {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiAdminRescanDomainCandidates(
  token: string,
  body: { queue_item_id?: number | null; domain?: string | null },
): Promise<{
  ok: boolean;
  domain?: string;
  queue_item_id?: number;
  candidates_count: number;
  pending_price: number | null;
  rows_updated: number;
}> {
  return request("/api/admin/domain-price-reviews/rescan-candidates", {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiReportCompetitorPriceIssue(
  token: string,
  shopId: number,
  competitorId: number,
  body: { note?: string },
): Promise<{ ok: boolean; queue_item_id: number; domain: string }> {
  return request(`/api/shops/${shopId}/competitors/${competitorId}/report-price-issue`, {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type SalesInsightsOut =
  | { ok: false; error: string; message_he?: string }
  | {
    ok: true;
    woo_connected: boolean;
    period_days: number;
    currency: string;
    orders_fetched: number;
    orders_with_tracked_lines: number;
    tracked_line_items: number;
    total_revenue_tracked: number;
    total_units_tracked: number;
    auto_pricing_revenue: number;
    auto_pricing_units: number;
    top_products: { product_id: number; name: string; revenue: number; units: number }[];
    price_bands: { label: string; revenue: number; units: number }[];
    period_split: {
      first_half_revenue: number;
      second_half_revenue: number;
      comparison_note: string | null;
    } | null;
    methodology_he: string;
    cache?: {
      fresh: boolean;
      stale?: boolean;
      computed_at?: string | null;
    };
  };

export async function apiShopSalesInsights(
  token: string,
  shopId: number,
  days: number = 90,
  opts?: { forceRefresh?: boolean },
): Promise<SalesInsightsOut> {
  const q = new URLSearchParams({ days: String(days) });
  if (opts?.forceRefresh) q.set("force_refresh", "true");
  return request(`/api/shops/${shopId}/analytics/sales-insights?${q}`, {
    token,
    method: "GET",
  });
}

// --- פאנל ניהול: מנוע סריקות ויומן תפעול ---

export type ScanEngineHealth = {
  status: string;
  message_he: string;
  stale_seconds: number | null;
};

export type SchedulerHeartbeatApi = {
  last_tick_at: string | null;
  last_tick_duration_ms: number;
  last_tick_ok: boolean;
  last_tick_scans: number;
  last_tick_shops_touched: number;
  last_error_message: string | null;
  last_error_detail: string | null;
  last_error_at: string | null;
  consecutive_failures: number;
  total_ticks: number;
};

export type HourlyBucket = { bucket: string; count: number };

export type ScanEngineSummary = {
  health: ScanEngineHealth;
  heartbeat: SchedulerHeartbeatApi;
  scheduler_interval_seconds: number;
  scanlog_total: number;
  scanlog_last_24h: number;
  hourly_scans: HourlyBucket[];
  ops_errors_24h: number;
  ops_warnings_24h: number;
  users_count: number;
  shops_count: number;
  competitor_links_count: number;
  pending_domain_reviews: number;
};

export async function apiAdminScanEngineSummary(token: string): Promise<ScanEngineSummary> {
  return request("/api/admin/scan-engine/summary", { token, method: "GET" });
}

export type AdminDashboardOverview = {
  health: ScanEngineHealth;
  heartbeat: SchedulerHeartbeatApi;
  scanlog_total: number;
  scanlog_last_24h: number;
  users_count: number;
  shops_count: number;
  competitor_links_count: number;
  pending_domain_reviews: number;
  ops_errors_24h: number;
  ops_warnings_24h: number;
};

export async function apiAdminDashboardOverview(token: string): Promise<AdminDashboardOverview> {
  return request("/api/admin/dashboard/overview", { token, method: "GET" });
}

export type OperationalLogRow = {
  id: number;
  created_at: string;
  level: string;
  code: string;
  title: string;
  detail: string;
  shop_id: number | null;
  competitor_link_id: number | null;
};

export type OperationalLogPage = {
  items: OperationalLogRow[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminSystemConfig = {
  backend_mode: "local" | "custom" | string;
  backend_api_base: string | null;
  updated_at: string;
};

export async function apiAdminOperationsLog(
  token: string,
  opts?: { limit?: number; offset?: number; level?: string | null; code_prefix?: string | null },
): Promise<OperationalLogPage> {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  if (opts?.level) q.set("level", opts.level);
  if (opts?.code_prefix) q.set("code_prefix", opts.code_prefix);
  const suffix = q.toString() ? `?${q}` : "";
  return request(`/api/admin/operations-log${suffix}`, { token, method: "GET" });
}

export async function apiAdminGetSystemConfig(token: string): Promise<AdminSystemConfig> {
  return request("/api/admin/system/config", { token, method: "GET" });
}

export async function apiAdminPatchSystemConfig(
  token: string,
  body: Partial<{ backend_mode: "local" | "custom"; backend_api_base: string | null }>,
): Promise<AdminSystemConfig> {
  return request("/api/admin/system/config", {
    token,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// 以 "-" 開頭的檔案不會被 TanStack Router 當成路由，僅供 /console 底下的頁面共用。

// 後台配色：肚肚橘 + 米白。以字面值寫在各頁的 Tailwind class 中，
// 不改動 src/styles.css 的 CSS 變數，避免影響肚肚官網。
export const ACCENT = "#FF8300";
export const ACCENT_DARK = "#E67600";
export const CREAM = "#FDF7F0";

export type VStatus = "pending" | "approved" | "rejected";

// 方案別沿用上游 merchant_profiles.foodie_plan 的 enum，商家後台訂閱時寫入同一個欄位，
// 營運後台不另建欄位，兩邊看到的方案才會一致。
export type PlanKey = Database["public"]["Enums"]["foodie_plan"];
export type SubscriptionStatus = Database["public"]["Enums"]["foodie_subscription_status"];

/**
 * 方案別與拆帳規則。
 * key 是資料庫的 enum 值，label 是介面顯示名稱。
 * price 為商家支付金額；platformFee 僅供結算時預填，不顯示於介面。
 * enterprise 為單案制客製報價，因此金額為 null，結算時需人工填寫。
 */
export const PLANS: {
  key: PlanKey;
  label: string;
  price: number | null;
  platformFee: number | null;
  desc: string;
}[] = [
  { key: "basic", label: "Basic", price: 750, platformFee: 600, desc: "$750" },
  { key: "pro", label: "Pro", price: 1999, platformFee: 1600, desc: "$1,999" },
  {
    key: "enterprise",
    label: "Enterprise",
    price: null,
    platformFee: null,
    desc: "單案制．客製報價",
  },
];

export const PLAN_KEYS = PLANS.map((p) => p.key);

export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = {
  active: "訂閱中",
  inactive: "未訂閱",
  expired: "已到期",
};

export function planOf(key: string | null | undefined) {
  return PLANS.find((p) => p.key === key) ?? null;
}

export type MerchantRow = {
  id: string;
  user_id: string;
  store_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  region: string | null;
  address: string | null;
  foodie_plan: PlanKey | null;
  foodie_subscription_status: SubscriptionStatus;
  blacklisted: boolean;
  blacklist_reason: string | null;
  blacklisted_at: string | null;
  verification_status: VStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FoodieRow = {
  id: string;
  user_id: string;
  nickname: string;
  real_name: string | null;
  region: string | null;
  area: string | null;
  areas: string[];
  categories: string[];
  collab_preferences: string[];
  ig_handle: string | null;
  ig_url: string | null;
  ig_followers: number;
  threads_handle: string | null;
  threads_followers: number;
  youtube_channel: string | null;
  youtube_subscribers: number;
  reels_avg_views: number;
  engagement_rate: number;
  portfolio_url: string | null;
  phone: string | null;
  email: string | null;
  verification_status: VStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

// 部分欄位與資料表尚未反映在自動產生的 types.ts：applications 的 material_caption /
// material_media（後台直接新增）與審核狀態欄位、merchant_profiles 的黑名單欄位、
// 以及 settlements 表。重新產生型別後即可移除這層轉型。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rawSupabase = supabase as any;

export function useMerchants(enabled: boolean) {
  return useQuery({
    queryKey: ["console-merchants"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MerchantRow[];
    },
  });
}

export function useFoodies(enabled: boolean) {
  return useQuery({
    queryKey: ["console-foodies"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foodie_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FoodieRow[];
    },
  });
}

export function useCampaigns(enabled: boolean) {
  return useQuery({
    queryKey: ["console-campaigns"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type ApplicationRow = {
  id: string;
  status: VStatus;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  creator_id: string;
  campaign_id: string;
  message: string | null;
  submitted_at: string | null;
  // 交付內容：由 Foodie 從官網填寫，營運後台與官網同源
  material_caption: string | null;
  material_media: string[] | null;
  // 審核狀態：本分支新增。migration 套用前為 undefined，UI 會顯示提示
  material_caption_prev: string | null;
  selected_media: string[] | null;
  caption_status: SubStatus | null;
  media_status: SubStatus | null;
  caption_reviewed_at: string | null;
  media_reviewed_at: string | null;
  campaigns: { title: string; restaurant_name: string | null; merchant_id: string } | null;
};

export function useApplications(enabled: boolean) {
  return useQuery({
    queryKey: ["console-applications"],
    enabled,
    queryFn: async () => {
      // material_* 與審核狀態欄位不在自動產生的 types.ts 裡，因此走 rawSupabase 並取全部欄位
      const { data, error } = await rawSupabase
        .from("applications")
        .select("*,campaigns(title,restaurant_name,merchant_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ApplicationRow[];
    },
  });
}

/** 從有填寫的帳號推導 Foodie 實際使用的宣傳平台。 */
export function platformsOf(f: FoodieRow) {
  const list: { name: string; followers: number; handle: string | null }[] = [];
  if (f.ig_handle || f.ig_url || f.ig_followers > 0) {
    list.push({ name: "Instagram", followers: f.ig_followers, handle: f.ig_handle });
  }
  if (f.threads_handle || f.threads_followers > 0) {
    list.push({ name: "Threads", followers: f.threads_followers, handle: f.threads_handle });
  }
  if (f.youtube_channel || f.youtube_subscribers > 0) {
    list.push({ name: "YouTube", followers: f.youtube_subscribers, handle: f.youtube_channel });
  }
  return list;
}

/** 曾經合作次數：以「已標記完成」的申請筆數計算。 */
export function collabStats(apps: ApplicationRow[], creatorId: string) {
  const mine = apps.filter((a) => a.creator_id === creatorId);
  return {
    completed: mine.filter((a) => a.completed).length,
    approved: mine.filter((a) => a.status === "approved").length,
    total: mine.length,
  };
}

export type SettlementStatus = "pending" | "invoiced" | "paid" | "void";

export type Settlement = {
  id: string;
  application_id: string;
  merchant_id: string;
  creator_id: string;
  period: string;
  amount: number;
  platform_fee: number;
  currency: string;
  status: SettlementStatus;
  note: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useSettlements(enabled: boolean) {
  return useQuery({
    queryKey: ["console-settlements"],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await rawSupabase
        .from("settlements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Settlement[];
    },
  });
}

export type SubStatus = "draft" | "submitted" | "revising" | "approved";

export const SUB_LABEL: Record<SubStatus, string> = {
  draft: "待提交",
  submitted: "待確稿",
  revising: "修改中",
  approved: "已確稿",
};

/**
 * 逐行比對兩份文案，用於「比較差異」。
 * 以最長共同子序列標出新增與刪除的行，未變動的行原樣顯示。
 */
export function diffLines(prev: string, next: string) {
  const a = prev.split("\n");
  const b = next.split("\n");
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: { type: "same" | "add" | "del"; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ type: "del", text: a[i]! });
      i++;
    } else {
      out.push({ type: "add", text: b[j]! });
      j++;
    }
  }
  while (i < m) out.push({ type: "del", text: a[i++]! });
  while (j < n) out.push({ type: "add", text: b[j++]! });
  return out;
}

export const TWD = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

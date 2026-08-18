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
  foodie_subscribed_at: string | null;
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
  // 成效追蹤：submission_url 為貼文連結，result_images 為成效截圖網址
  submission_url: string | null;
  result_images: string[] | null;
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
  caption_review_note: string | null;
  media_review_note: string | null;
  // 三段流程：平台確稿 → 商家確稿 → Foodie 發文
  merchant_review_status: SubStatus | null;
  merchant_reviewed_at: string | null;
  merchant_review_note: string | null;
  published_at: string | null;
  campaigns: { title: string; restaurant_name: string | null; merchant_id: string } | null;
};

/**
 * 訂閱資料的實際來源。
 * merchant_subscriptions 是在 Supabase 後台直接新增的（沒有進任何分支的 migration），
 * 商家在前端開通方案後寫入這裡；merchant_profiles.foodie_plan 已不再更新，
 * 因此營運後台以這張表為準，僅在查不到訂閱紀錄時退回讀 merchant_profiles。
 */
export type MerchantSubscription = {
  id: string;
  merchant_id: string;
  status: SubscriptionStatus;
  price: number | null;
  started_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useSubscriptions(enabled: boolean) {
  return useQuery({
    queryKey: ["console-subscriptions"],
    enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await rawSupabase
        .from("merchant_subscriptions")
        .select("*")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MerchantSubscription[];
    },
  });
}

/** merchant_subscriptions 沒有方案欄位，方案以訂閱金額判定。 */
export function planByPrice(price: number | null | undefined) {
  if (price === null || price === undefined) return null;
  return PLANS.find((p) => p.price !== null && Number(p.price) === Number(price)) ?? null;
}

/**
 * 取某商家最新一筆訂閱。
 * merchant_id 可能對應 auth.users.id 或 merchant_profiles.id（同事的表沒有註記），
 * 兩者都比對以確保抓得到。
 */
export function subscriptionOf(subs: MerchantSubscription[], m: MerchantRow) {
  const mine = subs.filter((s) => s.merchant_id === m.user_id || s.merchant_id === m.id);
  return mine[0] ?? null;
}

/** 商家目前的方案與訂閱狀態：優先取訂閱表，查不到才退回 merchant_profiles。 */
export function subscriptionView(subs: MerchantSubscription[], m: MerchantRow) {
  const sub = subscriptionOf(subs, m);
  if (sub) {
    return {
      plan: planByPrice(sub.price),
      status: sub.status,
      since: sub.started_at,
      expiresAt: sub.expires_at,
      price: sub.price,
      fromSubscriptionTable: true,
    };
  }
  return {
    plan: planOf(m.foodie_plan),
    status: m.foodie_subscription_status,
    since: m.foodie_subscribed_at,
    expiresAt: null,
    price: null,
    fromSubscriptionTable: false,
  };
}

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

export type SubStatus = "draft" | "submitted" | "revising" | "approved";

/** 商家審核階段的文字：與平台端的 SUB_LABEL 語意不同，需分開。 */
export const MERCHANT_STAGE_LABEL: Record<SubStatus, string> = {
  draft: "待平台確稿",
  submitted: "待商家確稿",
  revising: "商家退回",
  approved: "可發文",
};

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

/** 以使用者當地時區取得 YYYY-MM-DD，用來和 campaigns.deadline（date）比較。 */
export function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 截止日已過（當天仍算有效）。無截止日視為未過期。 */
export function isExpired(deadline: string | null | undefined, today = todayISO()) {
  return !!deadline && deadline < today;
}

/** 本月第一天 00:00 的 ISO timestamp，用來計算方案的每月案件額度用量。 */
export function startOfMonthISO() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * 粉絲數門檻級距。資料庫的 campaigns.min_followers 是整數，
 * 沒有分級欄位，因此在前端定義級距供篩選使用。
 */
export const FOLLOWER_TIERS = [
  { label: "1,000 以下", min: 0, max: 999 },
  { label: "1,000–4,999", min: 1000, max: 4999 },
  { label: "5,000–9,999", min: 5000, max: 9999 },
  { label: "10,000–49,999", min: 10000, max: 49999 },
  { label: "50,000 以上", min: 50000, max: Infinity },
];

export function matchesTier(label: string, minFollowers: number) {
  const tier = FOLLOWER_TIERS.find((t) => t.label === label);
  return !!tier && minFollowers >= tier.min && minFollowers <= tier.max;
}

/**
 * 文案／素材／商家確稿的審核狀態，applications.caption_status、media_status、
 * merchant_review_status 共用同一個 submission_status enum。
 * 流程：Foodie 送出文案＋素材 → 平台分別審核文案與素材（各自 approved 才算過）
 * → 兩者都過，自動進入商家確稿 → 商家 approved 後 Foodie 才能標記發文時間。
 */
export type SubmissionStatus = "draft" | "submitted" | "revising" | "approved";

export const SUBMISSION_LABEL: Record<
  SubmissionStatus,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  draft: { label: "尚未送審", variant: "secondary" },
  submitted: { label: "審核中", variant: "secondary" },
  revising: { label: "需修改", variant: "destructive" },
  approved: { label: "已通過", variant: "default" },
};

export type DeliveryRow = {
  caption_status?: SubmissionStatus | null;
  media_status?: SubmissionStatus | null;
  merchant_review_status?: SubmissionStatus | null;
};

/** Foodie 看到的整體進度徽章：平台審核（文案＋素材）過了才會進商家確稿。 */
export function deliveryStageLabel(
  r: DeliveryRow,
): { label: string; variant: "default" | "secondary" | "destructive" } {
  const captionStatus = r.caption_status ?? "draft";
  const mediaStatus = r.media_status ?? "draft";
  const merchantStatus = r.merchant_review_status ?? "draft";
  if (captionStatus === "revising" || mediaStatus === "revising") {
    return { label: "平台退件，需修改", variant: "destructive" };
  }
  if (captionStatus !== "approved" || mediaStatus !== "approved") {
    return { label: "平台審核中", variant: "secondary" };
  }
  if (merchantStatus === "revising") {
    return { label: "商家退件，需修改", variant: "destructive" };
  }
  if (merchantStatus !== "approved") {
    return { label: "商家確稿中", variant: "secondary" };
  }
  return { label: "已通過，可發佈", variant: "default" };
}

/** Foodie 可編輯文案／素材並（重新）送審：只要還沒同時送到商家審核就能改。 */
export function canEditDelivery(r: DeliveryRow) {
  return (
    r.caption_status !== "submitted" &&
    r.media_status !== "submitted" &&
    r.merchant_review_status !== "submitted"
  );
}

export const APPLIED_LABEL: Record<string, string> = {
  pending: "審核中",
  approved: "已核准",
  rejected: "未通過",
};

export type FoodType = {
  value: string;
  label: string;
  englishLabel: string;
  emoji: string;
};

/** 案件的餐飲類型，stable value 存進 campaigns.food_types，label 只用於顯示。 */
export const FOOD_TYPES: FoodType[] = [
  { value: "main_meal", label: "正餐料理", englishLabel: "Main Meal", emoji: "🍽️" },
  { value: "hot_pot", label: "火鍋／鍋物", englishLabel: "Hot Pot", emoji: "🍲" },
  { value: "bbq_grill", label: "燒肉／烤物", englishLabel: "BBQ & Grill", emoji: "🍖" },
  { value: "japanese", label: "日式料理", englishLabel: "Japanese", emoji: "🍣" },
  { value: "western", label: "西式料理", englishLabel: "Western", emoji: "🍝" },
  { value: "asian_cuisine", label: "亞洲料理", englishLabel: "Asian Cuisine", emoji: "🍜" },
  { value: "cafe", label: "咖啡廳", englishLabel: "Café", emoji: "☕" },
  { value: "dessert", label: "甜點", englishLabel: "Dessert", emoji: "🍰" },
  { value: "beverage", label: "飲品", englishLabel: "Beverage", emoji: "🥤" },
  { value: "bakery", label: "烘焙／麵包", englishLabel: "Bakery", emoji: "🥐" },
  { value: "brunch", label: "早午餐", englishLabel: "Brunch", emoji: "🥞" },
  { value: "bar_late_night", label: "酒吧／宵夜", englishLabel: "Bar & Late Night", emoji: "🍸" },
  { value: "healthy", label: "健康／輕食", englishLabel: "Healthy", emoji: "🥗" },
  { value: "packaged_food", label: "食品／伴手禮", englishLabel: "Packaged Food", emoji: "🎁" },
];

export const MAX_FOOD_TYPES = 3;

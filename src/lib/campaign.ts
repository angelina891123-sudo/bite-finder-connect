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

/** 前台案件篩選用的食物類型；商家上架案件時選擇。 */
export const FOOD_TYPES = [
  "台式",
  "日式",
  "韓式",
  "中式",
  "西式",
  "義式",
  "東南亞",
  "火鍋",
  "燒烤",
  "甜點烘焙",
  "飲料手搖",
  "早午餐",
  "素食",
  "其他",
];

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
 * 素材審核狀態。上傳成果連結／成效截圖前，須先經管理員、再經商家兩階段審核。
 * 對應 20260817140000_material_review.sql 的 applications.material_status。
 */
export type MaterialStatus =
  | "draft"
  | "admin_pending"
  | "admin_rejected"
  | "merchant_pending"
  | "merchant_rejected"
  | "approved";

export const MATERIAL_LABEL: Record<
  MaterialStatus,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  draft: { label: "尚未送審", variant: "secondary" },
  admin_pending: { label: "平台審核中", variant: "secondary" },
  admin_rejected: { label: "平台退件", variant: "destructive" },
  merchant_pending: { label: "商家審核中", variant: "secondary" },
  merchant_rejected: { label: "商家退件", variant: "destructive" },
  approved: { label: "素材已通過", variant: "default" },
};

/** Foodie 可編輯並（重新）送審的狀態。 */
export function canEditMaterial(s: MaterialStatus) {
  return s === "draft" || s === "admin_rejected" || s === "merchant_rejected";
}

export const APPLIED_LABEL: Record<string, string> = {
  pending: "審核中",
  approved: "已核准",
  rejected: "未通過",
};

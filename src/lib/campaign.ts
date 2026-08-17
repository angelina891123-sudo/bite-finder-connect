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

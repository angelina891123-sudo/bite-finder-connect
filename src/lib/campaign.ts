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

export const APPLIED_LABEL: Record<string, string> = {
  pending: "審核中",
  approved: "已核准",
  rejected: "未通過",
};

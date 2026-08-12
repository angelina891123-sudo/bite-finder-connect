export const CITY_AREAS: Record<string, string[]> = {
  "台北市": ["中正區","大同區","中山區","松山區","大安區","萬華區","信義區","士林區","北投區","內湖區","南港區","文山區"],
  "新北市": ["板橋區","新莊區","中和區","永和區","三重區","蘆洲區","新店區","土城區","樹林區","汐止區","淡水區","三峽區","鶯歌區","林口區"],
  "桃園市": ["桃園區","中壢區","平鎮區","八德區","龜山區","蘆竹區","楊梅區","大溪區","龍潭區"],
  "台中市": ["中區","東區","南區","西區","北區","西屯區","南屯區","北屯區","豐原區","大里區","太平區","沙鹿區"],
  "台南市": ["中西區","東區","南區","北區","安平區","安南區","永康區","仁德區","歸仁區"],
  "高雄市": ["新興區","前金區","苓雅區","鹽埕區","鼓山區","三民區","左營區","楠梓區","前鎮區","小港區","鳳山區","岡山區"],
  "新竹": ["東區","北區","香山區","竹北市","竹東鎮","新豐鄉"],
  "其他": ["不限地區"],
};

export function areasOf(city: string): string[] {
  return CITY_AREAS[city] ?? ["不限地區"];
}

export type PasswordCheck = { label: string; ok: boolean };

export function passwordChecks(pw: string): PasswordCheck[] {
  return [
    { label: "至少 8 個字元", ok: pw.length >= 8 },
    { label: "包含英文字母", ok: /[A-Za-z]/.test(pw) },
    { label: "包含數字", ok: /\d/.test(pw) },
    { label: "包含符號（建議）", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export function passwordScore(pw: string) {
  const checks = passwordChecks(pw);
  const score = checks.filter((c) => c.ok).length;
  const strong = checks.slice(0, 3).every((c) => c.ok);
  return { checks, score, strong };
}

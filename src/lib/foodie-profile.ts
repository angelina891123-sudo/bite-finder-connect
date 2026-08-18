import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const FOODIE_CATEGORIES = [
  "美食探店",
  "甜點下午茶",
  "飲料手搖",
  "親子友善餐廳",
  "宵夜燒烤",
  "開箱試吃",
];
export const COLLAB_PREFS = ["免費體驗", "含現金報酬", "長期配合"];
export const GENDERS = ["女", "男", "其他"];

/** 註冊表單與個人資料管理共用的欄位形狀。 */
export type FoodieForm = {
  nickname: string;
  realName: string;
  email: string;
  phone: string;
  gender: string;
  age: string;
  region: string;
  areas: string[];
  ig: string;
  igUrl: string;
  igFollowers: string;
  reels: string;
  threads: string;
  threadsFollowers: string;
  youtube: string;
  youtubeSubs: string;
  tiktok: string;
  tiktokFollowers: string;
  otherSocial: string;
  otherSocialFollowers: string;
  portfolio: string;
  cats: string[];
  prefs: string[];
};

/** 註冊時暫存於 auth metadata 的 key，供 Email 驗證完成後補寫入資料表。 */
export const PENDING_KEY = "foodie_signup";

export function num(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

const text = (v: string) => v.trim() || null;

/** FoodieForm → foodie_profiles 的欄位。 */
export function toFoodieRow(userId: string, f: FoodieForm) {
  return {
    user_id: userId,
    nickname: f.nickname.trim(),
    real_name: text(f.realName),
    email: text(f.email),
    phone: text(f.phone),
    gender: text(f.gender),
    age: num(f.age) || null,
    region: f.region,
    area: f.areas[0] ?? null,
    areas: f.areas,
    ig_handle: text(f.ig),
    ig_url: text(f.igUrl),
    ig_followers: num(f.igFollowers),
    reels_avg_views: num(f.reels),
    threads_handle: text(f.threads),
    threads_followers: num(f.threadsFollowers),
    youtube_channel: text(f.youtube),
    youtube_subscribers: num(f.youtubeSubs),
    tiktok_handle: text(f.tiktok),
    tiktok_followers: num(f.tiktokFollowers),
    other_social_handle: text(f.otherSocial),
    other_social_followers: num(f.otherSocialFollowers),
    categories: f.cats,
    collab_preferences: f.prefs,
    portfolio_url: text(f.portfolio),
  };
}

/**
 * 寫入 foodie_profiles，並把商家後台會讀到的欄位同步回 profiles。
 * profiles.follower_count 對應 IG 粉絲數（商家後台顯示於 IG 帳號旁）。
 */
export async function saveFoodieProfile(userId: string, f: FoodieForm) {
  const { error } = await supabase
    .from("foodie_profiles")
    .upsert(toFoodieRow(userId, f), { onConflict: "user_id" });
  if (error) return error;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: f.nickname.trim(),
      phone: text(f.phone),
      instagram_handle: text(f.ig),
      region: f.region,
      follower_count: num(f.igFollowers),
    })
    .eq("id", userId);
  return profileError;
}

const synced = new Set<string>();

/**
 * 註冊當下若 Supabase 要求 Email 驗證，signUp 不會回傳 session，
 * 因此粉絲數等資料無法即時寫入。改暫存在 auth metadata，
 * 待使用者驗證完成、首次進入需登入頁面時補寫入。
 */
export async function syncPendingFoodieProfile(user: User | null | undefined) {
  if (!user || synced.has(user.id)) return;
  synced.add(user.id);

  const pending = user.user_metadata?.[PENDING_KEY] as FoodieForm | undefined;
  if (!pending?.nickname) return;

  const { data: existing } = await supabase
    .from("foodie_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  // 已有資料代表使用者後續自行更新過，不用註冊當下的舊值覆蓋。
  if (existing) return;

  await saveFoodieProfile(user.id, pending);
}

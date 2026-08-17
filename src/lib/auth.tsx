import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { syncPendingFoodieProfile } from "@/lib/foodie-profile";

export type AppRole = "admin" | "merchant" | "creator";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadRoles = async (uid: string | undefined) => {
      if (!uid) {
        if (active) setRoles([]);
        return;
      }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (active) setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);
      setTimeout(() => {
        void loadRoles(s?.user?.id);
        // 補寫入註冊時因 Email 驗證而無法寫入的 Foodie 資料。
        // 掛在這裡（而非個別路由）才能涵蓋首頁等不需登入的頁面。
        void syncPendingFoodieProfile(s?.user);
      }, 0);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadRoles(data.session?.user?.id);
      void syncPendingFoodieProfile(data.session?.user);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user,
    roles,
    loading,
    isMerchant: roles.includes("merchant"),
    isCreator: roles.includes("creator"),
    isAdmin: roles.includes("admin"),
  };
}

export const REGIONS = [
  "台北市",
  "新北市",
  "桃園市",
  "台中市",
  "台南市",
  "高雄市",
  "新竹",
  "其他",
];

export const COLLAB_TYPES = ["IG 貼文", "IG 限動", "短影音 Reels", "TikTok 短影音", "YouTube 影片", "部落格圖文", "Google 評論"];
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  ShoppingCart,
  UtensilsCrossed,
  Users2,
  Megaphone,
  Settings,
  Plus,
  LogOut,
  ImagePlus,
  X,
  Lock,
  Check,
  Crown,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, REGIONS, COLLAB_TYPES } from "@/lib/auth";
import { uploadCampaignPhotos } from "@/lib/campaign-photos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/merchant")({
  head: () => ({
    meta: [
      { title: "商家後台｜肚肚 Foodie 媒合專區" },
      { name: "description", content: "餐廳商家後台：銷售管理與 Foodie 案件媒合，一站上架與審核申請。" },
      { property: "og:title", content: "商家後台｜肚肚 Foodie 媒合專區" },
      { property: "og:description", content: "上架 Foodie 媒合案件、查看申請並核准或拒絕。" },
    ],
  }),
  component: MerchantBackoffice,
});

const MENU = [
  { key: "overview", label: "營運總覽", icon: BarChart3 },
  { key: "orders", label: "訂單管理", icon: ShoppingCart },
  { key: "menu", label: "商品／菜單", icon: UtensilsCrossed },
  { key: "members", label: "會員管理", icon: Users2 },
  { key: "foodie", label: "Foodie 案件媒合", icon: Megaphone },
  { key: "performance", label: "合作成效", icon: TrendingUp },
  { key: "settings", label: "店家設定", icon: Settings },
] as const;

type MenuKey = (typeof MENU)[number]["key"];

type Campaign = {
  id: string;
  title: string;
  description: string | null;
  restaurant_name: string | null;
  region: string;
  collab_type: string;
  reward: string;
  slots: number;
  min_followers: number;
  deadline: string | null;
  photos: string[];
  status: "draft" | "published" | "closed";
  created_at: string;
};

type Application = {
  id: string;
  campaign_id: string;
  creator_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  submission_url: string | null;
  completed: boolean;
  created_at: string;
  // 到店核銷欄位，於 20260813180000_visit_verification_code.sql 新增；
  // migration 套用前為 undefined，UI 會自動隱藏該區塊。
  visit_code?: string | null;
  visited?: boolean | null;
};

function MerchantBackoffice() {
  const { user, isMerchant, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [section, setSection] = useState<MenuKey>("foodie");
  const [open, setOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<FoodiePlan | null>(null);
  const [redeemTarget, setRedeemTarget] = useState<Application | null>(null);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["merchant-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_profiles")
        .select("store_name,foodie_subscription_status,foodie_plan")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const subscriptionStatus = profile?.foodie_subscription_status ?? "inactive";
  const hasFoodiePlan = subscriptionStatus === "active";
  const storeName = profile?.store_name?.trim() || "我的店家";

  const activateFoodiePlan = async () => {
    if (!user || !checkoutPlan) return;
    const { error } = await supabase
      .from("merchant_profiles")
      .update({ foodie_subscription_status: "active", foodie_plan: checkoutPlan.id })
      .eq("user_id", user.id);
    if (error) throw error;
    void qc.invalidateQueries({ queryKey: ["merchant-profile", user.id] });
  };

  const { data: campaigns = [] } = useQuery({
    queryKey: ["merchant-campaigns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("merchant_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["merchant-applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });

  const { data: creators = {} } = useQuery({
    queryKey: ["applicant-profiles", applications.map((a) => a.creator_id).join(",")],
    enabled: applications.length > 0,
    queryFn: async () => {
      const ids = [...new Set(applications.map((a) => a.creator_id))];
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,instagram_handle,follower_count,region")
        .in("id", ids);
      const map: Record<string, { display_name: string | null; instagram_handle: string | null; follower_count: number }> = {};
      for (const p of data ?? []) map[p.id] = p;
      return map;
    },
  });

  const redeem = async () => {
    if (!redeemTarget) return;
    const value = code.trim();
    if (!/^\d{6}$/.test(value)) {
      toast.error("請輸入 6 位數字代碼");
      return;
    }
    if (value !== redeemTarget.visit_code) {
      toast.error("代碼不正確，請確認 Foodie 出示的代碼");
      return;
    }
    setRedeeming(true);
    const { error } = await supabase
      .from("applications")
      .update({ visited: true })
      .eq("id", redeemTarget.id);
    setRedeeming(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${creators[redeemTarget.creator_id]?.display_name ?? "該 Foodie"} 到店成功`);
    setRedeemTarget(null);
    void qc.invalidateQueries({ queryKey: ["merchant-applications", user?.id] });
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { role: "merchant", redirect: undefined }, replace: true });
  };

  if (loading) return <div className="p-10 text-muted-foreground">載入中…</div>;

  if (!isMerchant) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">此帳號沒有商家權限</h1>
        <p className="mt-2 text-sm text-muted-foreground">請以餐廳商家帳號登入，或註冊新的商家帳號。</p>
        <Button className="mt-4" onClick={signOut}>
          切換帳號
        </Button>
      </div>
    );
  }

  const active = campaigns.filter((c) => c.status === "published").length;
  const pending = applications.filter((a) => a.status === "pending").length;

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background p-4 md:flex">
        <div className="mb-6 px-2 text-lg font-extrabold">
          肚肚 <span className="text-primary">店家後台</span>
        </div>
        <nav className="space-y-1">
          {MENU.map((m) => (
            <button
              key={m.key}
              onClick={() => {
                setSection(m.key);
                setShowPlans(false);
                setCheckoutPlan(null);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                section === m.key ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-accent"
              }`}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </nav>
        <Button variant="ghost" className="mt-auto justify-start" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> 登出
        </Button>
      </aside>

      <main className="flex-1 p-6">
        <div className="mb-6 flex flex-wrap gap-2 md:hidden">
          {MENU.map((m) => (
            <button
              key={m.key}
              onClick={() => {
                setSection(m.key);
                setShowPlans(false);
                setCheckoutPlan(null);
              }}
              className={`rounded-full border px-3 py-1 text-xs ${
                section === m.key ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {checkoutPlan ? (
          <FoodieCheckoutPage
            plan={checkoutPlan}
            onBack={() => setCheckoutPlan(null)}
            onSuccess={activateFoodiePlan}
            onCreateCampaign={() => {
              setCheckoutPlan(null);
              setShowPlans(false);
              setOpen(true);
            }}
            onBackToManage={() => {
              setCheckoutPlan(null);
              setShowPlans(false);
            }}
          />
        ) : showPlans ? (
          <FoodiePlansPage onBack={() => setShowPlans(false)} onSelectPlan={setCheckoutPlan} />
        ) : section === "foodie" ? (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-primary">
                  {storeName.charAt(0)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{storeName}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <FoodiePlanBadge plan={profile?.foodie_plan ?? null} status={subscriptionStatus} />
                    <p className="text-sm text-muted-foreground">
                      上架中案件 {active} 件・待審申請 {pending} 件
                    </p>
                  </div>
                </div>
              </div>
              {hasFoodiePlan ? (
                <Button onClick={() => setOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> 上架媒合案件
                </Button>
              ) : (
                <Button disabled>
                  <Lock className="mr-2 h-4 w-4" /> 上架媒合案件
                </Button>
              )}
            </div>

            {!hasFoodiePlan ? (
              <FoodiePlanUpsellCard onViewPlans={() => setShowPlans(true)} />
            ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {campaigns.length === 0 && (
                <div className="rounded-lg border border-dashed p-10 text-center lg:col-span-2">
                  <p className="font-semibold">尚未上架任何案件</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    建立你的第一個 Foodie 合作案件，開始招募適合的創作者。
                  </p>
                  <Button className="mt-4" onClick={() => setOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> 上架媒合案件
                  </Button>
                </div>
              )}
              {campaigns.map((c) => {
                const apps = applications.filter((a) => a.campaign_id === c.id);
                const photos = c.photos ?? [];
                return (
                  <Card key={c.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{c.title}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={c.status === "published" ? "default" : "secondary"}>
                            {c.status === "published" ? "上架中" : c.status === "draft" ? "草稿" : "已結束"}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => setEditingCampaign(c)}>
                            編輯
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.region}・{c.collab_type}・粉絲門檻 {c.min_followers.toLocaleString()}・名額 {c.slots}
                        {c.deadline ? `・截止 ${c.deadline}` : ""}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {photos.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto">
                          {photos.map((url) => (
                            <img
                              key={url}
                              src={url}
                              alt={c.title}
                              className="h-16 w-16 shrink-0 rounded-md border border-border object-cover"
                            />
                          ))}
                        </div>
                      )}
                      <p className="text-sm">獎勵：{c.reward}</p>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">收到的申請（{apps.length}）</p>
                        {apps.length === 0 && <p className="text-xs text-muted-foreground">尚無申請</p>}
                        {apps.map((a) => {
                          const p = creators[a.creator_id];
                          return (
                            <div key={a.id} className="rounded-md border border-border p-3 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">
                                  {p?.display_name ?? "Foodie"}{" "}
                                  <span className="text-xs text-muted-foreground">
                                    {p?.instagram_handle ?? ""} ・粉絲 {(p?.follower_count ?? 0).toLocaleString()}
                                  </span>
                                </span>
                                <Badge
                                  variant={
                                    a.status === "approved"
                                      ? "default"
                                      : a.status === "rejected"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                >
                                  {a.status === "approved" ? "已核准" : a.status === "rejected" ? "已拒絕" : "待審核"}
                                </Badge>
                              </div>
                              {a.message && <p className="mt-1 text-xs text-muted-foreground">{a.message}</p>}
                              {a.status === "approved" && a.visit_code && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {a.visited ? (
                                    <span className="text-xs font-medium text-primary">✓ 已到店</span>
                                  ) : (
                                    <>
                                      <span className="text-xs text-muted-foreground">尚未到店</span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setCode("");
                                          setRedeemTarget(a);
                                        }}
                                      >
                                        輸入到店代碼
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                              {a.status === "pending" && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  由平台審核中，結果會在此更新。
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            )}
          </>
        ) : section === "performance" ? (
          <PerformanceSection campaigns={campaigns} applications={applications} creators={creators} />
        ) : (
          <PlaceholderSection section={section} />
        )}
      </main>

      <CampaignFormDialog
        open={open || editingCampaign !== null}
        onOpenChange={(v) => {
          if (!v) {
            setOpen(false);
            setEditingCampaign(null);
          }
        }}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["merchant-campaigns", user?.id] });
        }}
        userId={user?.id ?? ""}
        campaign={editingCampaign}
      />

      <Dialog open={redeemTarget !== null} onOpenChange={(o) => !o && setRedeemTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認 Foodie 到店</DialogTitle>
            <DialogDescription>
              請輸入 {creators[redeemTarget?.creator_id ?? ""]?.display_name ?? "該 Foodie"}{" "}
              出示的 6 位數字到店代碼。
            </DialogDescription>
          </DialogHeader>
          <Input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="text-center font-mono text-2xl tracking-[0.3em]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemTarget(null)}>
              取消
            </Button>
            <Button onClick={redeem} disabled={redeeming}>
              確認到店
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FOODIE_PLAN_FEATURES = ["發布合作案件", "接收創作者申請", "查看創作者資訊", "管理合作進度"];

function FoodiePlanUpsellCard({ onViewPlans }: { onViewPlans: () => void }) {
  return (
    <div className="flex justify-center py-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">尚未開通 Foodie 媒合方案</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            開通方案後，即可建立合作案件，招募適合的 Foodie／KOL／KOC，為餐廳創造更多社群曝光。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            {FOODIE_PLAN_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
          <Button className="w-full" onClick={onViewPlans}>
            查看媒合方案
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

type FoodiePlan = {
  id: "basic" | "pro" | "enterprise";
  name: string;
  tagline: string;
  price: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

const FOODIE_PLANS: FoodiePlan[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "適合首次嘗試 Foodie 合作的店家",
    price: "NT$ X,XXX",
    features: ["可建立 5 個媒合案件", "基礎創作者媒合", "查看創作者基本資料", "案件進度管理"],
    cta: "選擇Basic方案",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "適合希望持續增加社群曝光的店家",
    price: "NT$ X,XXX",
    features: ["可建立 15 個媒合案件", "更多創作者媒合", "查看完整創作者資料", "案件進度管理", "合作成效紀錄"],
    cta: "選擇Pro方案",
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "適合有大量創作者合作需求的品牌",
    price: "NT$ X,XXX",
    features: ["更多案件額度", "大量創作者媒合", "完整創作者資料", "案件進度管理", "合作成效紀錄", "專人協助"],
    cta: "聯繫專人",
  },
];

const FOODIE_PLAN_BADGES: Record<FoodiePlan["id"], { className: string; crown?: boolean }> = {
  basic: { className: "border-transparent bg-muted text-foreground" },
  pro: { className: "border-primary bg-transparent text-primary" },
  enterprise: { className: "border-transparent bg-foreground text-background", crown: true },
};

function FoodiePlanBadge({
  plan,
  status,
}: {
  plan: FoodiePlan["id"] | null;
  status: "inactive" | "active" | "expired";
}) {
  const style = status === "active" && plan ? FOODIE_PLAN_BADGES[plan] : null;
  if (!style) {
    // Not subscribed, expired, or subscribed before foodie_plan existed.
    return (
      <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
        {status === "active" ? "已開通方案" : status === "expired" ? "方案已到期" : "尚未開通方案"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={style.className}>
      {style.crown && <Crown className="mr-1 h-3 w-3" />}
      {FOODIE_PLANS.find((p) => p.id === plan)?.name} 方案
    </Badge>
  );
}

function FoodiePlansPage({
  onBack,
  onSelectPlan,
}: {
  onBack: () => void;
  onSelectPlan: (plan: FoodiePlan) => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 返回
      </button>
      <div className="mb-10">
        <h1 className="text-2xl font-bold">選擇適合你的 Foodie 媒合方案</h1>
        <p className="mt-1 text-sm text-muted-foreground">依照你的行銷需求，選擇適合的方案開始招募創作者</p>
      </div>
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
        {FOODIE_PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={`relative flex flex-col ${plan.highlighted ? "border-primary bg-primary/5" : ""}`}
          >
            {plan.highlighted && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">推薦</Badge>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              <p className="mt-3 text-2xl font-bold">{plan.price}</p>
            </CardHeader>
            <CardContent className="flex-1 space-y-2">
              {plan.features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {f}
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={plan.highlighted ? "default" : "outline"}
                onClick={() =>
                  plan.id === "enterprise"
                    ? toast.info("已收到您的需求，專人將盡快與您聯繫")
                    : onSelectPlan(plan)
                }
              >
                {plan.cta}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FoodieCheckoutPage({
  plan,
  onBack,
  onSuccess,
  onCreateCampaign,
  onBackToManage,
}: {
  plan: FoodiePlan;
  onBack: () => void;
  onSuccess: () => Promise<void>;
  onCreateCampaign: () => void;
  onBackToManage: () => void;
}) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [payMethod, setPayMethod] = useState<"card" | "transfer">("card");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Only the "payment" itself is simulated — the resulting plan activation
    // below is a real write to merchant_profiles.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      await onSuccess();
      setStep("success");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "開通失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "success") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold">Foodie 媒合方案已開通！</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          現在可以建立第一個合作案件，開始招募適合你的創作者。
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button className="w-full max-w-xs" onClick={onCreateCampaign}>
            <Plus className="mr-2 h-4 w-4" /> 建立第一個案件
          </Button>
          <Button variant="outline" className="w-full max-w-xs" onClick={onBackToManage}>
            返回案件管理
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 返回
      </button>
      <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs text-primary">
        Demo 模式｜此頁面僅模擬付款流程，不會產生實際扣款
      </div>
      <div className="mb-8 mt-3">
        <h1 className="text-2xl font-bold">完成方案開通</h1>
        <p className="mt-1 text-sm text-muted-foreground">確認方案與付款資訊，即可開始使用 Foodie 案件媒合</p>
      </div>

      <form onSubmit={confirm} className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">付款資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>聯絡人姓名</Label>
              <Input required value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>付款方式</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPayMethod("card")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    payMethod === "card" ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  信用卡
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod("transfer")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    payMethod === "transfer" ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  銀行轉帳
                </button>
              </div>
            </div>
            {payMethod === "card" ? (
              <>
                <div className="space-y-1.5">
                  <Label>信用卡卡號</Label>
                  <Input
                    required
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>到期日</Label>
                    <Input required placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CVC</Label>
                    <Input required placeholder="123" value={cvc} onChange={(e) => setCvc(e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">此頁面僅為 Demo 畫面，卡號等資訊不會被驗證或送出。</p>
              </>
            ) : (
              <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                選擇銀行轉帳，開通後將顯示匯款資訊（Demo 模式暫不提供）。
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">訂單摘要</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold">{plan.name} 方案</p>
              <p className="text-sm text-muted-foreground">{plan.tagline}</p>
            </div>
            <ul className="space-y-1.5 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
              <span>方案價格</span>
              <span>{plan.price}</span>
            </div>
            <div className="flex items-center justify-between text-base font-bold">
              <span>合計</span>
              <span>{plan.price}</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "處理中..." : "確認付款並開通"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

function PerformanceSection({
  campaigns,
  applications,
  creators,
}: {
  campaigns: Campaign[];
  applications: Application[];
  creators: Record<string, { display_name: string | null; instagram_handle: string | null; follower_count: number }>;
}) {
  const mine = applications.filter((a) => campaigns.some((c) => c.id === a.campaign_id));
  const approved = mine.filter((a) => a.status === "approved");
  const completed = mine.filter((a) => a.completed);
  const submitted = mine.filter((a) => a.submission_url);
  const reach = approved.reduce((s, a) => s + (creators[a.creator_id]?.follower_count ?? 0), 0);
  const totals: [string, string][] = [
    ["合作 Foodie 人數", `${new Set(approved.map((a) => a.creator_id)).size} 位`],
    ["預估總觸及粉絲", reach.toLocaleString()],
    ["已交付成果", `${submitted.length} 篇`],
    ["已完成合作", `${completed.length} 件`],
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">合作成效</h1>
      <p className="mb-6 text-sm text-muted-foreground">追蹤每個案件的申請、核准與 Foodie 交付成果。</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map(([k, v]) => (
          <Card key={k}>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">{k}</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        {campaigns.length === 0 && (
          <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">尚無案件成效資料。</p>
        )}
        {campaigns.map((c) => {
          const apps = mine.filter((a) => a.campaign_id === c.id);
          const ok = apps.filter((a) => a.status === "approved");
          const done = apps.filter((a) => a.completed);
          const cReach = ok.reduce((s, a) => s + (creators[a.creator_id]?.follower_count ?? 0), 0);
          return (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">{c.title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  申請 {apps.length}・核准 {ok.length}／名額 {c.slots}・完成 {done.length}・預估觸及{" "}
                  {cReach.toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {ok.length === 0 && <p className="text-xs text-muted-foreground">尚無核准的合作。</p>}
                {ok.map((a) => {
                  const p = creators[a.creator_id];
                  return (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
                    >
                      <span>
                        {p?.display_name ?? "Foodie"}{" "}
                        <span className="text-xs text-muted-foreground">
                          {p?.instagram_handle ?? ""}・粉絲 {(p?.follower_count ?? 0).toLocaleString()}
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        {a.submission_url ? (
                          <a
                            href={a.submission_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-primary underline"
                          >
                            查看成果
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">尚未交付</span>
                        )}
                        <Badge variant={a.completed ? "default" : "secondary"}>{a.completed ? "已完成" : "進行中"}</Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PlaceholderSection({ section }: { section: MenuKey }) {
  const item = MENU.find((m) => m.key === section)!;
  const stats: Record<string, [string, string][]> = {
    overview: [
      ["今日營業額", "NT$ 38,420"],
      ["今日訂單", "126 筆"],
      ["客單價", "NT$ 305"],
      ["回頭客比例", "42%"],
    ],
    orders: [
      ["待出餐", "8 筆"],
      ["外送中", "3 筆"],
      ["今日完成", "115 筆"],
      ["取消", "2 筆"],
    ],
    menu: [
      ["上架品項", "68 項"],
      ["缺貨品項", "4 項"],
      ["本月新品", "6 項"],
      ["熱銷第一", "招牌牛肉麵"],
    ],
    members: [
      ["會員總數", "3,204"],
      ["本月新增", "148"],
      ["點數兌換", "312 次"],
      ["活躍會員", "1,027"],
    ],
    settings: [
      ["營業時間", "11:00 - 21:00"],
      ["分店數", "3 間"],
      ["付款方式", "5 種"],
      ["發票設定", "已啟用"],
    ],
  };
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{item.label}</h1>
      <p className="mb-6 text-sm text-muted-foreground">此為肚肚原有後台功能示意畫面。</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(stats[section] ?? []).map(([k, v]) => (
          <Card key={k}>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">{k}</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const MAX_PHOTOS = 6;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const DEFAULT_FORM = {
  title: "",
  restaurant_name: "",
  description: "",
  region: REGIONS[0]!,
  // Numeric fields are held as strings so the input can be cleared while typing;
  // they're converted back to numbers on submit.
  min_followers: "1000",
  collab_type: COLLAB_TYPES[0]!,
  reward: "",
  slots: "3",
  deadline: "",
  status: "published" as "published" | "draft" | "closed",
};

function campaignToForm(c: Campaign): typeof DEFAULT_FORM {
  return {
    title: c.title,
    restaurant_name: c.restaurant_name ?? "",
    description: c.description ?? "",
    region: c.region,
    min_followers: String(c.min_followers),
    collab_type: c.collab_type,
    reward: c.reward,
    slots: String(c.slots),
    deadline: c.deadline ?? "",
    status: c.status,
  };
}

function CampaignFormDialog({
  open,
  onOpenChange,
  onSaved,
  userId,
  campaign,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  userId: string;
  campaign: Campaign | null;
}) {
  const isEdit = campaign !== null;
  const [form, setForm] = useState(DEFAULT_FORM);
  // Photos already stored in Supabase Storage (edit mode) vs. files picked in this session.
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const photoCount = existingPhotos.length + photos.length;

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  useEffect(() => {
    if (open) {
      setForm(campaign ? campaignToForm(campaign) : DEFAULT_FORM);
      setExistingPhotos(campaign?.photos ?? []);
    } else {
      setPhotos([]);
    }
  }, [open, campaign]);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name} 不是圖片檔案`);
        return false;
      }
      if (f.size > MAX_PHOTO_SIZE) {
        toast.error(`${f.name} 超過 5MB 限制`);
        return false;
      }
      return true;
    });
    setPhotos((prev) => [...prev, ...incoming].slice(0, MAX_PHOTOS - existingPhotos.length));
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (index: number) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const campaignId = campaign?.id ?? crypto.randomUUID();
      const uploaded = await uploadCampaignPhotos(photos, userId, campaignId);
      const fields = {
        photos: [...existingPhotos, ...uploaded],
        title: form.title,
        restaurant_name: form.restaurant_name || null,
        description: form.description || null,
        region: form.region,
        min_followers: Number(form.min_followers),
        collab_type: form.collab_type,
        reward: form.reward,
        slots: Number(form.slots),
        deadline: form.deadline || null,
        status: form.status,
      };
      const { error } = isEdit
        ? await supabase.from("campaigns").update(fields).eq("id", campaignId)
        : await supabase.from("campaigns").insert({ id: campaignId, merchant_id: userId, ...fields });
      if (error) throw error;
      toast.success(isEdit ? "案件已更新" : "案件已上架");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上傳失敗，請稍後再試");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯 Foodie 媒合案件" : "上架 Foodie 媒合案件"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "案件上架後仍可隨時修改內容。" : "填寫案件資訊，上架後 Foodie 即可在首頁看到並申請。"}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label>案件標題</Label>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>餐廳名稱</Label>
            <Input value={form.restaurant_name} onChange={(e) => setForm({ ...form, restaurant_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>地區</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              >
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>合作類型</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.collab_type}
                onChange={(e) => setForm({ ...form, collab_type: e.target.value })}
              >
                {COLLAB_TYPES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>粉絲門檻</Label>
              <Input
                required
                type="number"
                min={0}
                placeholder="1000"
                value={form.min_followers}
                onChange={(e) => setForm({ ...form, min_followers: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>名額</Label>
              <Input
                required
                type="number"
                min={1}
                placeholder="3"
                value={form.slots}
                onChange={(e) => setForm({ ...form, slots: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>獎勵／回饋</Label>
            <Input
              required
              placeholder="例如：免費雙人套餐 + NT$1,000 稿費"
              value={form.reward}
              onChange={(e) => setForm({ ...form, reward: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>申請截止日</Label>
            <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>案件照片（最多 {MAX_PHOTOS} 張）</Label>
            <div className="flex flex-wrap gap-2">
              {existingPhotos.map((src, i) => (
                <div key={src} className="relative h-20 w-20 shrink-0">
                  <img src={src} alt="" className="h-full w-full rounded-md border border-border object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingPhoto(i)}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
                    aria-label="移除照片"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {previews.map((src, i) => (
                <div key={src} className="relative h-20 w-20 shrink-0">
                  <img src={src} alt="" className="h-full w-full rounded-md border border-border object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
                    aria-label="移除照片"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photoCount < MAX_PHOTOS && (
                <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input text-muted-foreground hover:bg-accent">
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-xs">上傳</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>案件說明</Label>
            <Textarea
              required
              rows={4}
              placeholder="說明合作內容、拍攝需求、到店時段等"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <DialogFooter>
            {campaign !== null && campaign.status !== "closed" && (
              <Button
                type="submit"
                variant="destructive"
                disabled={busy}
                onClick={() => setForm((f) => ({ ...f, status: "closed" }))}
              >
                取消上架
              </Button>
            )}
            <Button
              type="submit"
              variant="outline"
              disabled={busy}
              onClick={() => setForm((f) => ({ ...f, status: "draft" }))}
            >
              儲存草稿
            </Button>
            <Button type="submit" disabled={busy} onClick={() => setForm((f) => ({ ...f, status: "published" }))}>
              {isEdit ? "儲存變更" : "上架案件"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
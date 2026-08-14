import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, MapPin, Users, Gift, Search, AlertTriangle, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, REGIONS, COLLAB_TYPES } from "@/lib/auth";
import {
  APPLIED_LABEL,
  FOOD_TYPES,
  FOLLOWER_TIERS,
  isExpired,
  matchesTier,
  todayISO,
} from "@/lib/campaign";
import { SiteHeader } from "@/components/SiteHeader";
import { CampaignDetailDialog } from "@/components/CampaignDetailDialog";
import { TagGroup } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "肚肚 Foodie 媒合專區｜餐廳與美食創作者的業配媒合平台" },
      {
        name: "description",
        content: "瀏覽全台餐廳最新業配合作案件，Foodie 一鍵申請；餐廳可於後台上架案件並審核申請。",
      },
      { property: "og:title", content: "肚肚 Foodie 媒合專區" },
      { property: "og:description", content: "餐廳與美食創作者的業配媒合平台，一鍵申請合作機會。" },
    ],
  }),
  component: Index,
});

type Campaign = {
  id: string;
  title: string;
  description: string | null;
  restaurant_name: string | null;
  region: string;
  min_followers: number;
  collab_type: string;
  reward: string;
  slots: number;
  deadline: string | null;
  food_type: string | null;
  photos: string[];
};

/** 前台篩選：先選篩選項目，再於該項目下複選子項。 */
const FILTER_GROUPS = [
  { key: "region", label: "地區", options: REGIONS },
  { key: "food", label: "餐廳類型", options: FOOD_TYPES },
  { key: "collab", label: "合作方式", options: [...COLLAB_TYPES] },
  { key: "followers", label: "粉絲數門檻", options: FOLLOWER_TIERS.map((t) => t.label) },
] as const;

type FilterKey = (typeof FILTER_GROUPS)[number]["key"];

const EMPTY_FILTERS: Record<FilterKey, string[]> = {
  region: [],
  food: [],
  collab: [],
  followers: [],
};

function Index() {
  const { user, isCreator, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [openGroup, setOpenGroup] = useState<FilterKey | null>(null);
  const [filters, setFilters] = useState<Record<FilterKey, string[]>>(EMPTY_FILTERS);
  const [target, setTarget] = useState<Campaign | null>(null);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const today = todayISO();

  const { data: campaigns = [], isLoading, refetch } = useQuery({
    queryKey: ["public-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        // 用 * 而非列舉欄位：food_type 於 20260814140000 migration 新增，
        // 尚未套用時列舉會讓整個查詢失敗，用 * 則只是讀不到該欄位。
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  // 尚未建立 Foodie 資料時回傳 null，用來區分「沒填過」與「真的是 0」。
  const { data: myFollowers } = useQuery({
    queryKey: ["my-followers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("foodie_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!data) return null;
      return Math.max(
        data.ig_followers ?? 0,
        data.threads_followers ?? 0,
        data.youtube_subscribers ?? 0,
        data.tiktok_followers ?? 0,
        data.other_social_followers ?? 0,
      );
    },
  });

  // 已申請過的案件：campaign_id → 申請狀態
  const { data: appliedMap = {} } = useQuery({
    queryKey: ["my-applied-campaigns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("campaign_id,status")
        .eq("creator_id", user!.id);
      const map: Record<string, string> = {};
      for (const a of data ?? []) map[a.campaign_id] = a.status;
      return map;
    },
  });

  const noProfile = myFollowers === null;
  // 粉絲數尚在載入時回傳 null，避免誤判成未達標而擋下申請。
  const belowThresholdFor = (c: Campaign) =>
    myFollowers === undefined ? null : (myFollowers ?? 0) < c.min_followers;

  const toggleFilter = (key: FilterKey, value: string) =>
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));

  const activeCount = Object.values(filters).reduce((n, v) => n + v.length, 0);

  // 各篩選群組之間為 AND，同群組內的複選為 OR。
  const filtered = campaigns
    .filter(
      (c) =>
        (filters.region.length === 0 || filters.region.includes(c.region)) &&
        (filters.food.length === 0 ||
          (!!c.food_type && filters.food.includes(c.food_type))) &&
        (filters.collab.length === 0 || filters.collab.includes(c.collab_type)) &&
        (filters.followers.length === 0 ||
          filters.followers.some((t) => matchesTier(t, c.min_followers))) &&
        (keyword.trim() === "" ||
          `${c.title}${c.restaurant_name ?? ""}${c.collab_type}`.toLowerCase().includes(keyword.toLowerCase())),
    )
    // 已截止的案件仍然看得到，但排到最後且不能申請。
    .sort((a, b) => Number(isExpired(a.deadline, today)) - Number(isExpired(b.deadline, today)));

  const onApplyClick = (c: Campaign) => {
    if (loading) return;
    if (isExpired(c.deadline, today)) {
      toast.error("此案件已過截止日");
      return;
    }
    if (appliedMap[c.id]) {
      toast.error("你已經申請過這個案件了");
      return;
    }
    if (!user) {
      navigate({ to: "/auth", search: { role: "creator", redirect: "/" } });
      return;
    }
    if (!isCreator) {
      toast.error("此帳號不是 Foodie 身分，請以 Foodie 帳號登入申請");
      return;
    }
    // 粉絲數未達案件門檻者不開放申請。
    if (belowThresholdFor(c)) {
      toast.error(
        noProfile
          ? "你尚未填寫社群資料，請先到「我的申請 → 個人資料管理」填寫粉絲數"
          : `未達標準，無法申請。此案件粉絲門檻為 ${c.min_followers.toLocaleString()} 人，你目前為 ${(myFollowers ?? 0).toLocaleString()} 人`,
      );
      return;
    }
    setMessage("");
    setTarget(c);
  };

  const submitApplication = async () => {
    if (!target || !user) return;
    setBusy(true);
    const { error } = await supabase
      .from("applications")
      .insert({ campaign_id: target.id, creator_id: user.id, message });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "你已經申請過這個案件了" : error.message);
      return;
    }
    toast.success("申請已送出，等待商家審核");
    setTarget(null);
    setDetail(null);
    void qc.invalidateQueries({ queryKey: ["my-applied-campaigns", user.id] });
    void refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-gradient-to-br from-accent to-background">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <Badge className="mb-4">Foodie 媒合專區</Badge>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
            餐廳找 Foodie，<br />
            美食創作者找合作
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            肚肚協助餐飲店家與美食創作者快速媒合，上架案件、申請合作、審核進度一站完成。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <a href="#campaigns">立即探索案件</a>
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate({ to: "/merchant" })}>
              我是商家，前往後台
            </Button>
          </div>
        </div>
      </section>

      <main id="campaigns" className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold">最新合作案件</h2>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜尋餐廳或案件"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </div>

        {/* 先選篩選項目，再於下方複選子項 */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_GROUPS.map((g) => {
              const count = filters[g.key].length;
              const open = openGroup === g.key;
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setOpenGroup(open ? null : g.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${
                    open || count > 0
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                >
                  {g.label}
                  {count > 0 && (
                    <span className="rounded-full bg-primary-foreground px-1.5 text-[11px] font-bold text-primary">
                      {count}
                    </span>
                  )}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
              );
            })}
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setOpenGroup(null);
                }}
                className="text-sm text-muted-foreground underline hover:text-primary"
              >
                清除全部（{activeCount}）
              </button>
            )}
          </div>

          {openGroup && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-xs text-muted-foreground">
                {FILTER_GROUPS.find((g) => g.key === openGroup)!.label}・可複選
              </p>
              <TagGroup
                options={[...FILTER_GROUPS.find((g) => g.key === openGroup)!.options]}
                selected={filters[openGroup]}
                onToggle={(v) => toggleFilter(openGroup, v)}
              />
            </div>
          )}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">載入中…</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            目前沒有符合條件的案件，稍後再回來看看。
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => {
              const photos = c.photos ?? [];
              const expired = isExpired(c.deadline, today);
              const applied = appliedMap[c.id];
              const below = belowThresholdFor(c) === true;
              return (
              <Card key={c.id} className={`flex flex-col ${expired ? "opacity-60" : ""}`}>
                {photos[0] && (
                  <img
                    src={photos[0]}
                    alt={`${c.title} 案件照片`}
                    loading="lazy"
                    className="h-40 w-full rounded-t-xl object-cover"
                  />
                )}
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {c.region}
                    <Badge variant="secondary">{c.collab_type}</Badge>
                    {expired && <Badge variant="destructive">已截止</Badge>}
                    {applied && <Badge>已申請・{APPLIED_LABEL[applied] ?? applied}</Badge>}
                  </div>
                  <CardTitle className="text-lg">{c.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{c.restaurant_name}</p>
                </CardHeader>
                <CardContent className="flex-1 space-y-2 text-sm">
                  {c.description && <p className="line-clamp-3 text-muted-foreground">{c.description}</p>}
                  <p className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" /> {c.reward}
                  </p>
                  <p className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> 粉絲門檻 {c.min_followers.toLocaleString()} ・名額 {c.slots}
                  </p>
                  {c.deadline && (
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" /> 截止 {c.deadline}
                    </p>
                  )}
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDetail(c)}>
                    查看詳情
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={expired || !!applied || (below && !noProfile)}
                    onClick={() => onApplyClick(c)}
                  >
                    {expired
                      ? "已截止"
                      : applied
                        ? (APPLIED_LABEL[applied] ?? "已申請")
                        : noProfile
                          ? "請先填寫資料"
                          : below
                            ? "未達標準"
                            : "申請合作"}
                  </Button>
                </CardFooter>
              </Card>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © 肚肚 dudoo・Foodie 媒合專區
      </footer>

      <CampaignDetailDialog
        campaign={detail}
        onOpenChange={(o) => !o && setDetail(null)}
        expired={detail ? isExpired(detail.deadline, today) : false}
      >
        <Button variant="outline" onClick={() => setDetail(null)}>
          關閉
        </Button>
        <Button
          disabled={
            !detail ||
            isExpired(detail.deadline, today) ||
            !!appliedMap[detail.id] ||
            (belowThresholdFor(detail) === true && !noProfile)
          }
          onClick={() => {
            if (!detail) return;
            const c = detail;
            setDetail(null);
            onApplyClick(c);
          }}
        >
          {detail && isExpired(detail.deadline, today)
            ? "已截止"
            : detail && appliedMap[detail.id]
              ? (APPLIED_LABEL[appliedMap[detail.id]!] ?? "已申請")
              : noProfile
                ? "請先填寫資料"
                : detail && belowThresholdFor(detail) === true
                  ? "未達標準"
                  : "申請合作"}
        </Button>
      </CampaignDetailDialog>

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>申請「{target?.title}」</DialogTitle>
            <DialogDescription>簡單介紹你自己與合作想法，商家會收到你的申請。</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={5}
            placeholder="例如：我是專注台北美食的 IG 創作者，粉絲 1.2 萬，擅長拍攝短影音…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {noProfile && (
            <div className="flex gap-2 rounded-md border border-primary/40 bg-accent p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                你還沒有填寫社群資料，商家會看到粉絲數為 0。建議先到{" "}
                <Link to="/my-applications" className="font-medium text-primary underline">
                  我的申請 → 個人資料管理
                </Link>{" "}
                補上粉絲數。
              </span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              取消
            </Button>
            <Button onClick={submitApplication} disabled={busy}>
              送出申請
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

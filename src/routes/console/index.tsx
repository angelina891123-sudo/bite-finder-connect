import { createFileRoute } from "@tanstack/react-router";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PLANS,
  subscriptionView,
  TWD,
  useApplications,
  useCampaigns,
  useFoodies,
  useMerchants,
  useSubscriptions,
} from "./-data";

export const Route = createFileRoute("/console/")({
  component: Overview,
});

const PIE_COLORS = ["#FF8300", "#FFC894", "#EFE3D6"];
/** 對應 PIE_COLORS 的文字色：淺色色塊直接當文字會看不清楚，列印時尤其明顯。 */
const PIE_TEXT = ["#FF8300", "#E8A860", "#A08E7C"];

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="border-[#EFE3D6] bg-white">
      <CardHeader className="pb-1">
        <p className="text-xs text-[#A08E7C]">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-[#3F2E1E]">{value}</p>
        {hint && <p className="mt-1 text-xs text-[#A08E7C]">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Overview() {
  const { isAdmin } = useAuth();
  const merchants = useMerchants(isAdmin);
  const foodies = useFoodies(isAdmin);
  const campaigns = useCampaigns(isAdmin);
  const applications = useApplications(isAdmin);
  const subscriptions = useSubscriptions(isAdmin);

  const mList = merchants.data ?? [];
  const fList = foodies.data ?? [];
  const cList = campaigns.data ?? [];
  const aList = applications.data ?? [];

  const pendingReviews =
    mList.filter((m) => m.verification_status === "pending").length +
    fList.filter((f) => f.verification_status === "pending").length;

  const approved = aList.filter((a) => a.status === "approved").length;
  const completed = aList.filter((a) => a.completed).length;
  const matchRate = aList.length ? Math.round((approved / aList.length) * 100) : 0;
  const completionRate = approved ? Math.round((completed / approved) * 100) : 0;

  // 近 6 個月的申請與完成趨勢
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const trend = months.map((m) => ({
    month: m.slice(5),
    申請: aList.filter((a) => a.created_at.slice(0, 7) === m).length,
    完成: aList.filter((a) => a.completed && (a.completed_at ?? "").slice(0, 7) === m).length,
  }));

  // cacaFly 平台收益：依訂閱中的商家方案自動計算，不需要結算紀錄。
  // Basic $600、Pro $1,600；Enterprise 為單案制客製報價，無法自動估算故不計入。
  const subs = subscriptions.data ?? [];
  const views = mList.map((m) => subscriptionView(subs, m));
  const activeViews = views.filter((v) => v.status === "active");
  const planRevenue = PLANS.map((p) => {
    const list = activeViews.filter((v) => v.plan?.key === p.key);
    return {
      ...p,
      count: list.length,
      revenue: p.platformFee !== null ? p.platformFee * list.length : null,
    };
  });
  const monthlyRevenue = planRevenue.reduce((n, p) => n + (p.revenue ?? 0), 0);
  const enterpriseCount = planRevenue.find((p) => p.key === "enterprise")?.count ?? 0;

  /**
   * 近 6 個月收益估算：把訂閱時間早於該月底、且目前仍在訂閱中的商家計入該月。
   * 因為資料庫只保留目前的訂閱狀態、沒有歷史紀錄，中途退訂的商家無法回溯，
   * 所以這是估算值而非實際帳務數字。
   */
  const revenueByMonth = months.map((m) => {
    const [y, mm] = m.split("-").map(Number);
    const nextMonth = new Date(y!, mm!, 1).getTime();
    const total = PLANS.reduce((sum, p) => {
      if (p.platformFee === null) return sum;
      const n = activeViews.filter(
        (v) => v.plan?.key === p.key && (!v.since || new Date(v.since).getTime() < nextMonth),
      ).length;
      return sum + p.platformFee * n;
    }, 0);
    return { month: m, total };
  });
  const thisMonth = revenueByMonth[revenueByMonth.length - 1] ?? { month: "", total: 0 };

  const statusPie = [
    { name: "審核中", value: aList.filter((a) => a.status === "pending").length },
    { name: "已完成", value: completed },
  ].filter((d) => d.value > 0);
  // 占比以圖上呈現的項目為基準，legend 的百分比才會合計 100%
  const pieTotal = statusPie.reduce((n, d) => n + d.value, 0);

  // 依申請數排出前 3 名案件
  const topCampaigns = cList
    .map((c) => ({ title: c.title, count: aList.filter((a) => a.campaign_id === c.id).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // 熱門餐廳：把同一家餐廳的所有案件申請數加總。
  // 餐廳名優先取案件上的 restaurant_name，沒填才退回商家資料的店名。
  const storeNameOf = (merchantId: string) =>
    mList.find((m) => m.user_id === merchantId)?.store_name ?? "未命名店家";
  const restaurantCounts = new Map<string, number>();
  for (const c of cList) {
    const name = c.restaurant_name?.trim() || storeNameOf(c.merchant_id);
    const n = aList.filter((a) => a.campaign_id === c.id).length;
    if (n > 0) restaurantCounts.set(name, (restaurantCounts.get(name) ?? 0) + n);
  }
  const topRestaurants = [...restaurantCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const loading =
    merchants.isLoading || foodies.isLoading || campaigns.isLoading || applications.isLoading;
  const failed = merchants.error || foodies.error || campaigns.error || applications.error;

  /**
   * 產生成效報告的列印檢視並開啟列印對話框，於對話框選「儲存為 PDF」即可下載。
   * 刻意不使用前端 PDF 套件：那需要額外打包數 MB 的中文字型，
   * 而瀏覽器原生列印本來就能正確排版中文。
   */
  const exportPdf = () => {
    const esc = (v: unknown) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
      );

    const stamp = new Date();
    const dateStr = `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(stamp.getDate()).padStart(2, "0")}`;

    /**
     * 直接複製頁面上 recharts 已渲染的 SVG，讓報表的圖表與畫面完全一致。
     * recharts 只設 width/height 而沒有 viewBox，因此補上 viewBox 才能等比縮放到紙張寬度。
     */
    const grabChart = (containerId: string, heightMm: number) => {
      const svg = document.getElementById(containerId)?.querySelector("svg");
      if (!svg) return "";
      const clone = svg.cloneNode(true) as SVGElement;
      const w = svg.getAttribute("width");
      const h = svg.getAttribute("height");
      if (w && h && !clone.getAttribute("viewBox")) {
        clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
      }
      // 同時指定寬高並保留比例，圖形會等比縮放並置中，不會因原始長寬比而撐高
      clone.setAttribute("width", "100%");
      clone.setAttribute("height", `${heightMm}mm`);
      clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
      return clone.outerHTML;
    };

    const trendChart = grabChart("chart-trend", 33);
    // 圓餅圖所在的卡片較窄，高度跟著縮小才不會顯得比長條圖大
    const statusChart = grabChart("chart-status", 28);

    const planRevenueRows = planRevenue
      .map(
        (p) => `<tr>
          <td>${esc(p.label)}</td>
          <td class="n">${p.count}</td>
          <td class="n b">${p.revenue === null ? "客製報價" : TWD.format(p.revenue)}</td>
        </tr>`,
      )
      .join("");

    const kpi = [
      ["商家", String(mList.length)],
      ["KOC / KOL", String(fList.length)],
      ["待審核", String(pendingReviews)],
      ["案件", String(cList.length)],
      ["媒合率", `${matchRate}%`],
      ["完成率", `${completionRate}%`],
    ];

    const trendRows = trend
      .map(
        (t) => `<tr>
          <td>${esc(t.month)} 月</td>
          <td class="n">${t.申請}</td>
          <td class="n">${t.完成}</td>
        </tr>`,
      )
      .join("");

    // 圖例直接帶數字，圓餅圖旁就不需要再放一張同內容的表格
    const statusLegend = statusPie
      .map(
        (d, i) =>
          `<span style="color:${PIE_TEXT[i % PIE_TEXT.length]}"><i style="background:${
            PIE_COLORS[i % PIE_COLORS.length]
          }"></i>${esc(d.name)} ${d.value} 筆（${
            pieTotal ? Math.round((d.value / pieTotal) * 100) : 0
          }%）</span>`,
      )
      .join("");

    const statusRows = statusPie.length
      ? statusPie
          .map(
            (d) => `<tr>
              <td>${esc(d.name)}</td>
              <td class="n">${d.value}</td>
              <td class="n">${pieTotal ? Math.round((d.value / pieTotal) * 100) : 0}%</td>
            </tr>`,
          )
          .join("")
      : '<tr><td colspan="3">尚無申請資料</td></tr>';

    const restaurantRows = topRestaurants.length
      ? topRestaurants
          .map(
            (r, i) => `<tr>
              <td class="n">${i + 1}</td>
              <td class="t" title="${esc(r.name)}">${esc(r.name)}</td>
              <td class="n">${r.count}</td>
            </tr>`,
          )
          .join("")
      : '<tr><td colspan="3">尚無申請資料</td></tr>';

    const topRows = topCampaigns.length
      ? topCampaigns
          .map(
            (c, i) => `<tr>
              <td class="n">${i + 1}</td>
              <td class="t" title="${esc(c.title)}">${esc(c.title)}</td>
              <td class="n">${c.count}</td>
            </tr>`,
          )
          .join("")
      : '<tr><td colspan="3">尚無申請資料</td></tr>';

    const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>成效報告_${dateStr}</title>
<style>
  @page { size: A4 portrait; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "PingFang TC","Heiti TC","Microsoft JhengHei",sans-serif; color: #3F2E1E; margin: 0; }
  header { border-bottom: 3px solid #FF8300; padding-bottom: 10px; margin-bottom: 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 16px 0 8px; padding-left: 9px; border-left: 4px solid #FF8300; }
  .meta { font-size: 12px; color: #A08E7C; }
  .kpi { display: flex; flex-wrap: wrap; gap: 10px; }
  .kpi div { flex: 1 1 0; min-width: 0; border: 1px solid #EFE3D6; background: #FDF7F0; border-radius: 8px; padding: 9px 11px; }
  .kpi p { margin: 0; }
  .kpi .k { font-size: 11px; color: #A08E7C; }
  .kpi .v { font-size: 18px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #EFE3D6; padding: 7px 10px; text-align: left; }
  th { background: #FF8300; color: #fff; font-weight: 600; }
  tbody tr:nth-child(even) { background: #FDF7F0; }
  td.n, th.n { text-align: right; }
  /* 排行表固定欄寬並讓名稱單行截斷：長標題換行會把整份報告推到第二頁 */
  .rank table { table-layout: fixed; }
  .rank col.i { width: 9mm; }
  .rank col.c { width: 18mm; }
  .rank td.t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar { display: inline-block; height: 8px; background: #FF8300; border-radius: 4px; min-width: 2px; }
  td.b { font-weight: 700; }
  .hero { border: 2px solid #FF8300; background: #FFF4E8; border-radius: 10px; padding: 13px 17px; margin-bottom: 14px; }
  .hero .k { margin: 0; font-size: 12px; color: #B85C00; }
  .hero .v { margin: 2px 0 0; font-size: 30px; font-weight: 800; color: #B85C00; }
  .hero .sub { margin: 6px 0 0; font-size: 12px; color: #7A6555; }
  .charts { display: flex; gap: 14px; align-items: stretch; }
  .charts > div {
    min-width: 0;
    border: 1px solid #EFE3D6; border-radius: 10px; background: #fff; padding: 13px 15px;
  }
  /* 與頁面相同的 2:1 比例，圓餅圖不會被拉得跟長條圖一樣大 */
  .charts > div:first-child { flex: 2 1 0; }
  .charts > div:last-child { flex: 1 1 0; }
  .chart svg { display: block; margin: 0 auto; }
  h3 { font-size: 13px; font-weight: 700; margin: 0 0 10px; color: #3F2E1E; }
  .legend { margin: 10px 0 0; font-size: 11px; text-align: center; color: #7A6555; }
  .legend span { margin: 0 7px; font-weight: 600; white-space: nowrap; }
  .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
  footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #EFE3D6; font-size: 11px; color: #A08E7C; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } h2 { break-after: avoid; } table { break-inside: avoid; } }
</style>
</head>
<body>
<header>
  <h1>營運成效報告</h1>
  <p class="meta">Foodie 媒合平台 · 產生日期 ${dateStr}</p>
</header>

<div class="hero">
  <p class="k">本月 cacaFly 平台收益（${esc(thisMonth.month)}）</p>
  <p class="v">${TWD.format(monthlyRevenue)}</p>
  <p class="sub">依訂閱中的商家方案自動計算，Enterprise ${enterpriseCount} 家為客製報價未計入</p>
</div>

<h2>收益組成</h2>
<table>
  <thead><tr><th>方案別</th><th class="n">訂閱中家數</th><th class="n">月收益</th></tr></thead>
  <tbody>${planRevenueRows}</tbody>
</table>

<h2>整體指標</h2>
<div class="kpi">
  ${kpi.map(([k, v]) => `<div><p class="k">${esc(k)}</p><p class="v">${esc(v)}</p></div>`).join("")}
</div>

<div class="charts">
  <div>
    <h3>近 6 個月申請趨勢</h3>
    ${
      trendChart
        ? `<div class="chart">${trendChart}</div>
    <p class="legend">
      <span style="color:#E8A860"><i style="background:#FFC894"></i>申請</span>
      <span style="color:#FF8300"><i style="background:#FF8300"></i>完成</span>
    </p>`
        : `<table><thead><tr><th>月份</th><th class="n">申請</th><th class="n">完成</th></tr></thead><tbody>${trendRows}</tbody></table>`
    }
  </div>
  <div>
    <h3>媒合狀態</h3>
    ${
      statusChart
        ? `<div class="chart">${statusChart}</div>
    <p class="legend">${statusLegend}</p>`
        : `<table><thead><tr><th>狀態</th><th class="n">筆數</th><th class="n">占比</th></tr></thead><tbody>${statusRows}</tbody></table>`
    }
  </div>
</div>

<div class="charts rank" style="margin-top:18px">
  <div>
    <h3>熱門案件（前 3 名）</h3>
    <table>
      <colgroup><col class="i"><col><col class="c"></colgroup>
      <thead><tr><th class="n">#</th><th>案件標題</th><th class="n">申請數</th></tr></thead>
      <tbody>${topRows}</tbody>
    </table>
  </div>
  <div>
    <h3>熱門餐廳（前 3 名）</h3>
    <table>
      <colgroup><col class="i"><col><col class="c"></colgroup>
      <thead><tr><th class="n">#</th><th>餐廳</th><th class="n">申請數</th></tr></thead>
      <tbody>${restaurantRows}</tbody>
    </table>
  </div>
</div>
</body>
</html>`;

    // 用隱藏的 iframe 列印，而不是 window.open —— 開新視窗會被瀏覽器的
    // 彈出視窗封鎖擋掉。列印失敗時退而下載 HTML 檔，使用者可自行開啟列印。
    const downloadHtml = () => {
      const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `成效報告_${dateStr}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.info("已下載報告檔案，開啟後可用瀏覽器列印或另存為 PDF");
    };

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      downloadHtml();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const run = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        downloadHtml();
      }
      // 列印對話框是同步的，關閉後才會走到這裡；仍留緩衝時間避免過早移除
      window.setTimeout(() => iframe.remove(), 1000);
    };

    if (doc.readyState === "complete") {
      window.setTimeout(run, 50);
    } else {
      iframe.onload = run;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#3F2E1E]">營運總覽</h1>
          <p className="mt-1 text-sm text-[#A08E7C]">平台整體媒合成效與待辦事項</p>
        </div>
        <Button
          className="bg-[#FF8300] text-white hover:bg-[#E67600]"
          onClick={exportPdf}
          disabled={loading}
        >
          <FileDown className="mr-2 h-4 w-4" />
          匯出成效報告 PDF
        </Button>
      </div>

      {failed && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">
            資料載入失敗：{(failed as Error).message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#FF8300] bg-[#FFF4E8]">
          <CardHeader className="pb-1">
            <p className="text-xs text-[#B85C00]">本月平台收益（{thisMonth.month}）</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-[#B85C00]">
              {TWD.format(monthlyRevenue)}
            </p>
            <p className="mt-1 text-xs text-[#A08E7C]">依訂閱中的方案自動計算</p>
          </CardContent>
        </Card>
        {planRevenue
          .filter((p) => p.platformFee !== null)
          .map((p) => (
            <Stat
              key={p.key}
              label={`${p.label} 訂閱中`}
              value={TWD.format(p.revenue ?? 0)}
              hint={`${p.count} 家 × ${TWD.format(p.platformFee ?? 0)}`}
            />
          ))}
        <Stat
          label="Enterprise 訂閱中"
          value={`${enterpriseCount} 家`}
          hint="單案制客製報價，未計入"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="商家" value={loading ? "—" : mList.length} />
        <Stat label="Foodie" value={loading ? "—" : fList.length} />
        <Stat label="待審核" value={loading ? "—" : pendingReviews} hint="商家 + Foodie" />
        <Stat label="案件" value={loading ? "—" : cList.length} />
        <Stat label="媒合率" value={loading ? "—" : `${matchRate}%`} hint="核准 / 申請" />
        <Stat label="完成率" value={loading ? "—" : `${completionRate}%`} hint="完成 / 核准" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-[#EFE3D6] bg-white lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">近 6 個月申請趨勢</CardTitle>
          </CardHeader>
          <CardContent className="h-72" id="chart-trend">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE3D6" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="申請" fill="#FFC894" radius={[4, 4, 0, 0]} />
                <Bar dataKey="完成" fill="#FF8300" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-[#EFE3D6] bg-white">
          <CardHeader>
            <CardTitle className="text-base">媒合狀態</CardTitle>
          </CardHeader>
          <CardContent className="h-72" id="chart-status">
            {statusPie.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-[#A08E7C]">
                尚無申請資料
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {statusPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#EFE3D6] bg-white">
        <CardHeader>
          <CardTitle className="text-base">熱門案件（依申請數）</CardTitle>
        </CardHeader>
        <CardContent>
          {topCampaigns.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#A08E7C]">尚無申請資料</p>
          ) : (
            <ul className="space-y-3">
              {topCampaigns.map((c) => {
                const max = topCampaigns[0]?.count || 1;
                return (
                  <li key={c.title} className="flex items-center gap-3">
                    <span className="w-48 shrink-0 truncate text-sm text-[#5C4630]">{c.title}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#F5EBE0]">
                      <span
                        className="block h-full rounded-full bg-[#FF8300]"
                        style={{ width: `${(c.count / max) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 text-right text-sm tabular-nums text-[#A08E7C]">
                      {c.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
  TWD,
  useApplications,
  useCampaigns,
  useFoodies,
  useMerchants,
  useSettlements,
} from "./-data";

export const Route = createFileRoute("/console/")({
  component: Overview,
});

const PIE_COLORS = ["#FF8300", "#FFC894", "#EFE3D6"];

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
  const settlements = useSettlements(isAdmin);

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

  // cacaFly 平台收益：以結算紀錄的服務費按對帳期間彙總。
  // 作廢（void）不計入；已付款為已入帳，待對帳與已請款為待收款。
  const sList = settlements.data ?? [];
  const revenueByMonth = months.map((m) => {
    const rows = sList.filter((s) => s.period === m);
    const sum = (states: string[]) =>
      rows.filter((r) => states.includes(r.status)).reduce((n, r) => n + Number(r.platform_fee), 0);
    return {
      month: m,
      paid: sum(["paid"]),
      due: sum(["pending", "invoiced"]),
      total: sum(["paid", "pending", "invoiced"]),
    };
  });
  const thisMonth = revenueByMonth[revenueByMonth.length - 1] ?? {
    month: "",
    paid: 0,
    due: 0,
    total: 0,
  };

  const statusPie = [
    { name: "已核准", value: approved },
    { name: "審核中", value: aList.filter((a) => a.status === "pending").length },
    { name: "已拒絕", value: aList.filter((a) => a.status === "rejected").length },
  ].filter((d) => d.value > 0);

  // 依申請數排出前 5 名案件
  const topCampaigns = cList
    .map((c) => ({ title: c.title, count: aList.filter((a) => a.campaign_id === c.id).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

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
    const grabChart = (containerId: string) => {
      const svg = document.getElementById(containerId)?.querySelector("svg");
      if (!svg) return "";
      const clone = svg.cloneNode(true) as SVGElement;
      const w = svg.getAttribute("width");
      const h = svg.getAttribute("height");
      if (w && h && !clone.getAttribute("viewBox")) {
        clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
      }
      clone.setAttribute("width", "100%");
      clone.removeAttribute("height");
      clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
      return clone.outerHTML;
    };

    const trendChart = grabChart("chart-trend");
    const statusChart = grabChart("chart-status");

    const revenueRows = revenueByMonth
      .map(
        (r) => `<tr>
          <td>${esc(r.month)}</td>
          <td class="n">${TWD.format(r.paid)}</td>
          <td class="n">${TWD.format(r.due)}</td>
          <td class="n b">${TWD.format(r.total)}</td>
        </tr>`,
      )
      .join("");
    const revenueTotal = revenueByMonth.reduce((n, r) => n + r.total, 0);

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

    const statusRows = statusPie.length
      ? statusPie
          .map(
            (d) => `<tr>
              <td>${esc(d.name)}</td>
              <td class="n">${d.value}</td>
              <td class="n">${aList.length ? Math.round((d.value / aList.length) * 100) : 0}%</td>
            </tr>`,
          )
          .join("")
      : '<tr><td colspan="3">尚無申請資料</td></tr>';

    const topRows = topCampaigns.length
      ? topCampaigns
          .map(
            (c, i) => `<tr>
              <td class="n">${i + 1}</td>
              <td>${esc(c.title)}</td>
              <td class="n">${c.count}</td>
            </tr>`,
          )
          .join("")
      : '<tr><td colspan="3">尚無申請資料</td></tr>';

    const planRows = [
      ...PLANS.map((p) => ({
        name: p.key,
        count: mList.filter((m) => (m as { plan?: string | null }).plan === p.key).length,
      })),
      { name: "未設定", count: mList.filter((m) => !(m as { plan?: string | null }).plan).length },
    ]
      .map((r) => `<tr><td>${esc(r.name)}</td><td class="n">${r.count}</td></tr>`)
      .join("");

    const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>成效報告_${dateStr}</title>
<style>
  @page { size: A4 portrait; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "PingFang TC","Heiti TC","Microsoft JhengHei",sans-serif; color: #3F2E1E; margin: 0; }
  header { border-bottom: 3px solid #FF8300; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 22px 0 8px; padding-left: 8px; border-left: 4px solid #FF8300; }
  .meta { font-size: 12px; color: #A08E7C; }
  .kpi { display: flex; flex-wrap: wrap; gap: 8px; }
  .kpi div { flex: 1 1 30%; border: 1px solid #EFE3D6; background: #FDF7F0; border-radius: 8px; padding: 8px 12px; }
  .kpi p { margin: 0; }
  .kpi .k { font-size: 11px; color: #A08E7C; }
  .kpi .v { font-size: 20px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #EFE3D6; padding: 6px 8px; text-align: left; }
  th { background: #FF8300; color: #fff; font-weight: 600; }
  tbody tr:nth-child(even) { background: #FDF7F0; }
  td.n, th.n { text-align: right; }
  .bar { display: inline-block; height: 8px; background: #FF8300; border-radius: 4px; min-width: 2px; }
  td.b { font-weight: 700; }
  .hero { border: 2px solid #FF8300; background: #FFF4E8; border-radius: 10px; padding: 12px 16px; margin-bottom: 14px; }
  .hero .k { margin: 0; font-size: 12px; color: #B85C00; }
  .hero .v { margin: 2px 0 0; font-size: 30px; font-weight: 800; color: #B85C00; }
  .hero .sub { margin: 6px 0 0; font-size: 12px; color: #7A6555; }
  .chart { border: 1px solid #EFE3D6; border-radius: 8px; background: #fff; padding: 6px; }
  .chart svg { display: block; }
  .legend { margin: 6px 0 0; font-size: 11px; color: #7A6555; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin: 0 4px 0 12px; vertical-align: middle; }
  .legend i:first-child { margin-left: 0; }
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
  <p class="v">${TWD.format(thisMonth.total)}</p>
  <p class="sub">已入帳 ${TWD.format(thisMonth.paid)} · 待收款 ${TWD.format(thisMonth.due)}</p>
</div>

<h2>近 6 個月平台收益</h2>
<table>
  <thead><tr><th>對帳期間</th><th class="n">已入帳</th><th class="n">待收款</th><th class="n">合計</th></tr></thead>
  <tbody>${revenueRows}</tbody>
  <tfoot><tr><td>六個月合計</td><td class="n"></td><td class="n"></td><td class="n b">${TWD.format(revenueTotal)}</td></tr></tfoot>
</table>

<h2>整體指標</h2>
<div class="kpi">
  ${kpi.map(([k, v]) => `<div><p class="k">${esc(k)}</p><p class="v">${esc(v)}</p></div>`).join("")}
</div>

<h2>近 6 個月申請與完成趨勢</h2>
${trendChart ? `<div class="chart">${trendChart}</div><p class="legend"><i style="background:#FFC894"></i>申請<i style="background:#FF8300"></i>完成</p>` : ""}
<table style="margin-top:8px">
  <thead><tr><th>月份</th><th class="n">申請</th><th class="n">完成</th></tr></thead>
  <tbody>${trendRows}</tbody>
</table>

<h2>申請狀態分布</h2>
${statusChart ? `<div class="chart">${statusChart}</div><p class="legend">${statusPie.map((d, i) => `<i style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></i>${esc(d.name)}`).join("")}</p>` : ""}
<table style="margin-top:8px">
  <thead><tr><th>狀態</th><th class="n">筆數</th><th class="n">占比</th></tr></thead>
  <tbody>${statusRows}</tbody>
</table>

<h2>熱門案件（依申請數前 5 名）</h2>
<table>
  <thead><tr><th class="n">#</th><th>案件標題</th><th class="n">申請數</th></tr></thead>
  <tbody>${topRows}</tbody>
</table>

<h2>商家方案分布</h2>
<table>
  <thead><tr><th>方案別</th><th class="n">商家數</th></tr></thead>
  <tbody>${planRows}</tbody>
</table>

<footer>
  申請總數 ${aList.length} 筆 · 已核准 ${approved} 筆 · 已完成 ${completed} 筆
</footer>
</body>
</html>`;

    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) {
      toast.error("瀏覽器阻擋了新視窗，請允許此網站開啟彈出視窗後再試");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-[#FF8300] bg-[#FFF4E8]">
          <CardHeader className="pb-1">
            <p className="text-xs text-[#B85C00]">本月平台收益（{thisMonth.month}）</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-[#B85C00]">
              {TWD.format(thisMonth.total)}
            </p>
            <p className="mt-1 text-xs text-[#A08E7C]">cacaFly 服務費合計</p>
          </CardContent>
        </Card>
        <Stat label="已入帳" value={TWD.format(thisMonth.paid)} hint="結算狀態為已付款" />
        <Stat label="待收款" value={TWD.format(thisMonth.due)} hint="待對帳與已請款" />
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
            <CardTitle className="text-base">申請狀態分布</CardTitle>
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

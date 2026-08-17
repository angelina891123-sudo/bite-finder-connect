import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import {
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Receipt,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/console")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "營運後台｜Foodie 媒合平台" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/console/login", search: { redirect: location.pathname } });
    }
    return { user: data.user };
  },
  component: ConsoleLayout,
});

const NAV = [
  { to: "/console", label: "營運總覽", icon: LayoutDashboard, exact: true },
  { to: "/console/creators", label: "Foodie 管理", icon: Users, exact: false },
  { to: "/console/merchants", label: "商家管理", icon: Store, exact: false },
  { to: "/console/reviews", label: "資格審核", icon: ShieldCheck, exact: false },
  { to: "/console/submissions", label: "Foodie 案件審核", icon: FileCheck2, exact: false },
  { to: "/console/campaigns", label: "案件與申請", icon: ClipboardList, exact: false },
  { to: "/console/settlements", label: "結算對帳", icon: Receipt, exact: false },
] as const;

function ConsoleLayout() {
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/console/login", search: { redirect: undefined }, replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF7F0] text-sm text-[#A08E7C]">
        載入中…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF7F0] px-4">
        <div className="w-full max-w-sm rounded-xl border border-[#EFE3D6] bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-[#3F2E1E]">沒有營運後台權限</h1>
          <p className="mt-2 text-sm text-[#A08E7C]">
            此系統僅開放平台管理員使用。目前登入的帳號為 {user?.email ?? "未知"}。
          </p>
          <Button
            className="mt-6 w-full bg-[#FF8300] text-white hover:bg-[#E67600]"
            onClick={signOut}
          >
            切換帳號
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FDF7F0]">
      <aside className="hidden w-60 shrink-0 flex-col bg-[#FF8300] text-white md:flex">
        <div className="border-b border-white/25 px-5 py-5">
          <p className="text-base font-semibold">營運後台</p>
          <p className="mt-0.5 text-xs text-white/80">Foodie 媒合平台 · 第三方管理</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "bg-white text-[#B85C00] font-semibold hover:bg-white" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/15"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/25 p-3">
          <p className="truncate px-3 pb-2 text-xs text-white/70">{user?.email}</p>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/15"
          >
            <LogOut className="h-4 w-4" />
            登出
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 bg-[#FF8300] px-4 py-3 text-white md:hidden">
          <span className="text-sm font-semibold">營運後台</span>
          <Button
            size="sm"
            variant="outline"
            className="border-white/60 bg-transparent text-white hover:bg-white/15 hover:text-white"
            onClick={signOut}
          >
            登出
          </Button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-[#EFE3D6] bg-white px-2 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "bg-[#FF8300] text-white" }}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-[#7A6555]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

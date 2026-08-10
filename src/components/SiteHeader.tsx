import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, ChevronDown, Compass, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { label: "產品功能", to: "/" },
  { label: "最新消息", to: "/" },
  { label: "肚肚商城", to: "/" },
  { label: "媒體報導", to: "/" },
  { label: "專欄文章", to: "/" },
  { label: "聯絡我們", to: "/" },
  { label: "客訴專區", to: "/" },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg">
        🍽
      </span>
      <span className="text-2xl font-extrabold tracking-tight text-foreground">
        肚肚 <span className="text-primary">dudoo</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  const foodieMenu = (
    <div className="w-72 overflow-hidden rounded-xl border border-border bg-popover p-2 shadow-lg">
      <Link
        to="/"
        hash="campaigns"
        className="flex gap-3 rounded-lg p-3 transition-colors hover:bg-accent"
      >
        <Compass className="mt-0.5 h-5 w-5 text-primary" />
        <span>
          <span className="block text-sm font-semibold text-foreground">探索案件</span>
          <span className="block text-xs text-muted-foreground">瀏覽全台餐廳最新的業配合作機會</span>
        </span>
      </Link>
      <Link
        to="/my-applications"
        className="flex gap-3 rounded-lg p-3 transition-colors hover:bg-accent"
      >
        <ClipboardList className="mt-0.5 h-5 w-5 text-primary" />
        <span>
          <span className="block text-sm font-semibold text-foreground">我的申請</span>
          <span className="block text-xs text-muted-foreground">Foodie 登入後查看申請進度與審核結果</span>
        </span>
      </Link>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Logo />

        <nav className="hidden items-center gap-5 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}

          <div className="group relative">
            <button className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground transition-colors group-hover:text-primary">
              Foodie媒合專區
              <ChevronDown className="h-4 w-4" />
            </button>
            <div className="pointer-events-none absolute right-0 top-full pt-3 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
              {foodieMenu}
            </div>
          </div>

          <Link
            to="/merchant"
            className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
          >
            店家後台
          </Link>
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="開啟選單"
          onClick={() => setOpen((v) => !v)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-4 py-3 lg:hidden">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {NAV.map((item) => (
              <Link key={item.label} to={item.to} className="text-sm text-foreground/80">
                {item.label}
              </Link>
            ))}
            <Link to="/merchant" className="text-sm text-foreground/80">
              店家後台
            </Link>
          </div>
          <div className="mt-3">{foodieMenu}</div>
        </div>
      )}
    </header>
  );
}
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-items";
import { NavIcon } from "./NavIcon";

function Logo() {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-inset ring-cyan-400/40">
        <div className="h-3 w-3 rounded-sm bg-cyan-400" />
      </div>
      <span className="text-lg font-semibold tracking-tight text-white">oreX</span>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-2">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-white"
                : "text-navy-600 text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <span className="flex items-center gap-3">
              <NavIcon href={item.href} className={cn("h-4 w-4", active ? "text-cyan-400" : "text-slate-500")} />
              {item.label}
            </span>
            {item.comingSoon && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                Soon
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-white/5 bg-navy-900 px-4 py-3 md:hidden">
        <Logo />
        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setMobileOpen((open) => !open)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/5"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5">
            {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="border-b border-white/5 bg-navy-900 pb-4 md:hidden">
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </div>
      )}

      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-white/5 bg-navy-900 py-6 md:flex">
        <Logo />
        <p className="px-4 text-xs leading-relaxed text-slate-400">
          Catch scope creep before it becomes free work.
        </p>
        <NavLinks />
      </aside>
    </>
  );
}

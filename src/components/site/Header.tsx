"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ScanLine, ShieldCheck, LogOut, LayoutGrid } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { officer, logout } = useAuth();

  const linkCls = (active: boolean) =>
    `rounded-md px-2.5 py-1.5 text-sm font-semibold transition-colors ${
      active ? "bg-white/10 text-orange-400" : "text-neutral-300 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink text-white">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
              <ScanLine className="h-4.5 w-4.5" strokeWidth={2.4} />
            </span>
            <span className="font-mono-scan text-sm font-bold tracking-tight">
              LabelScan<span className="text-accent">.CV</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link href="/scan" className={linkCls(pathname.startsWith("/scan"))}>
              Scan a label
            </Link>
            <Link href="/dashboard" className={linkCls(pathname.startsWith("/dashboard"))}>
              Dashboard
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {officer ? (
            <>
              <span className="hidden items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-xs font-semibold text-neutral-200 md:flex">
                <ShieldCheck className="h-3.5 w-3.5 text-orange-400" />
                {officer.badge}
              </span>
              <Link
                href="/dashboard"
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                title="Dashboard"
              >
                <LayoutGrid className="h-4 w-4" />
              </Link>
              <button
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-bold text-neutral-200 transition-colors hover:border-white/25 hover:text-white"
            >
              Officer sign-in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

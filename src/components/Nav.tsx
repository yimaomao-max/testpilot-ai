"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "总览" },
  { href: "/tests", label: "测试用例" },
  { href: "/generate", label: "生成器" },
];

export default function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="mb-8 flex items-center justify-between border-b border-slate-800 pb-4">
      <div className="flex items-center gap-10">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span>✈️</span>
          <span>
            TestPilot <span className="text-sky-400">AI</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-slate-800 font-medium text-sky-300"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <span className="text-xs text-slate-500">MVP v0.1</span>
    </header>
  );
}

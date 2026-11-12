"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { deviceHref } from "@/lib/device-url";

export function DeviceTabs({ uid }: { uid: string }) {
  const pathname = usePathname();

  const onSettings = pathname.endsWith("/settings");
  const tabs = [
    { label: "Dashboard", href: deviceHref(uid, "dashboard"), active: !onSettings },
    { label: "Settings", href: deviceHref(uid, "settings"), active: onSettings },
  ];

  return (
    <nav className="flex items-center gap-1" aria-label="Device">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={[
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            tab.active
              ? "bg-primary text-[var(--primary-contrast)]"
              : "text-muted hover:bg-surface-alt hover:text-ink",
          ].join(" ")}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

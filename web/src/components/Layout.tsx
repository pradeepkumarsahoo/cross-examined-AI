import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CloudUpload,
  FileOutput,
  Gauge,
  Gavel,
  type LucideIcon,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { toast } from "sonner";
import { api } from "../lib/api";
import { cn, initials } from "../lib/format";
import { ROLE_LABELS, setIdentity, useIdentity } from "../lib/identity";
import { ATTENTION } from "../lib/status";
import { THEMES, type ThemeKey, themeForPath } from "../lib/themes";
import type { Role } from "../lib/types";
import { PageThemeContext } from "./ui";

const NAV: { to: string; label: string; icon: LucideIcon; theme: ThemeKey; end?: boolean }[] = [
  { to: "/", label: "Overview", icon: Sparkles, theme: "aurora", end: true },
  { to: "/upload", label: "Upload", icon: CloudUpload, theme: "orchid" },
  { to: "/batches", label: "Live batches", icon: Activity, theme: "ocean" },
  { to: "/review", label: "Review queue", icon: Gavel, theme: "sunset" },
  { to: "/export", label: "Export to ERP", icon: FileOutput, theme: "lagoon" },
  { to: "/monitoring", label: "Monitoring", icon: Gauge, theme: "nebula" },
];

export function useAttentionCount() {
  return useQuery({
    queryKey: ["packs", ATTENTION],
    queryFn: () => api.packs(ATTENTION),
    refetchInterval: 15_000,
    select: (packs) => packs.length,
  }).data;
}

// ------------------------------------------------------------------ layout
export function Layout() {
  const { pathname } = useLocation();
  const theme = THEMES[themeForPath(pathname)];
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <PageThemeContext.Provider value={theme}>
      <div className="relative z-10 flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-[15.5rem] shrink-0 lg:block">
          <SidebarContent />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar onMenu={() => setMenuOpen(true)} />
          <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-6 pb-20 sm:px-6 lg:px-10 lg:pt-8">
            <motion.div
              key={pathname.split("/")[1] ?? ""}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[15.5rem] lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <SidebarContent onClose={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </PageThemeContext.Provider>
  );
}

// ------------------------------------------------------------------ sidebar
function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-9 rounded-md" />
      <span>
        <span className="block text-[17px] leading-tight font-semibold tracking-tight text-white">CrossExam</span>
        <span className="block text-[11.5px] leading-tight text-slate-400">Accounts payable, cross-examined</span>
      </span>
    </Link>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const attention = useAttentionCount();
  return (
    <div className="flex h-full flex-col bg-[#0f1b2d] px-3 py-4">
      <div className="flex items-center justify-between px-2 pt-1">
        <Logo />
        {onClose && (
          <button onClick={onClose} className="grid size-9 place-items-center rounded-md text-slate-300 hover:bg-white/10" aria-label="Close menu">
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav className="mt-8 space-y-0.5" aria-label="Main">
        <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">Workspace</p>
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} badge={item.to === "/review" ? attention : undefined} />
        ))}
      </nav>

      <div className="mt-auto">
        <IdentityCard />
      </div>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  badge,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  theme: ThemeKey;
  end?: boolean;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors",
          isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-blue-400" />}
          <Icon className={cn("size-[18px]", isActive ? "text-blue-300" : "text-slate-400")} strokeWidth={2} />
          <span className="flex-1">{label}</span>
          {!!badge && <span className="grid h-5 min-w-5 place-items-center rounded-md bg-amber-500 px-1.5 text-[11px] font-bold text-slate-900">{badge}</span>}
        </>
      )}
    </NavLink>
  );
}

function IdentityCard() {
  const { name, role } = useIdentity();
  const roles: [Role, string][] = [["ap_executive", "AP executive"], ["finance_manager", "Finance manager"]];
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">{initials(name || "?")}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold tracking-[0.1em] text-slate-500 uppercase">Signed in as</p>
          <input
            value={name}
            onChange={(e) => setIdentity({ name: e.target.value })}
            aria-label="Your name"
            className="w-full truncate bg-transparent text-sm font-medium text-white outline-none"
          />
        </div>
      </div>
      <div role="radiogroup" aria-label="Role" className="mt-3 flex gap-0.5 rounded-md bg-black/25 p-0.5">
        {roles.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={role === value}
            onClick={() => {
              setIdentity({ role: value });
              toast.success(`Now acting as ${ROLE_LABELS[value]}`);
            }}
            className={cn("h-7 flex-1 rounded text-xs font-medium transition-colors", role === value ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white")}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-[11px] leading-snug text-slate-500">Demo sign-in. On Google Cloud, Identity-Aware Proxy supplies the real identity.</p>
    </div>
  );
}

function MobileBar({ onMenu }: { onMenu: () => void }) {
  const attention = useAttentionCount();
  return (
    <div className="sticky top-0 z-30 lg:hidden">
      <div className="flex items-center justify-between bg-[#0f1b2d] px-3 py-2">
        <Logo />
        <div className="flex items-center gap-2">
          {!!attention && (
            <Link
              to="/review"
              className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold text-slate-900"
            >
              {attention} to review
            </Link>
          )}
          <button onClick={onMenu} className="grid size-10 place-items-center rounded-md text-white hover:bg-white/10" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ page header
/** Kept so titles can still mark a word; in the formal design it is plain ink. */
export function Hl({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  icon: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-blue-700 uppercase">
          <Icon className="size-3.5" strokeWidth={2.2} />
          {eyebrow}
        </p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-[14.5px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

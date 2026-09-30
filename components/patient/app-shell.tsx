"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bell,
  CalendarClock,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  Home,
  LogOut,
  Map,
  Menu,
  MessageSquare,
  Plus,
  UserRound,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/dashboard", label: "Обзор", icon: Home, group: "Здоровье" },
  { href: "/health-map", label: "Карта здоровья", icon: HeartPulse, group: "Здоровье" },
  { href: "/analyses", label: "Анализы", icon: FlaskConical, group: "Здоровье" },
  { href: "/checkup", label: "Новый чекап", icon: Plus, group: "Чекапы" },
  { href: "/encounters", label: "Мои обращения", icon: ClipboardList, group: "Чекапы" },
  { href: "/route", label: "Маршруты", icon: Map, group: "Чекапы" },
  { href: "/reminders", label: "Напоминания", icon: CalendarClock, group: "Сервис" },
  { href: "/feedback", label: "Обратная связь", icon: MessageSquare, group: "Сервис" },
] as const

const MOBILE = [
  { href: "/dashboard", label: "Главная", icon: Home },
  { href: "/checkup", label: "Чекап", icon: Plus },
  { href: "/health-map", label: "Здоровье", icon: HeartPulse },
  { href: "/encounters", label: "Обращения", icon: ClipboardList },
  { href: "/profile", label: "Профиль", icon: UserRound },
] as const

function NavLink({
  href,
  label,
  icon: Icon,
  compact,
  onClick,
}: {
  href: string
  label: string
  icon: typeof Home
  compact?: boolean
  onClick?: () => void
}) {
  const path = usePathname()
  const active = path === href || path.startsWith(`${href}/`)
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        compact
          ? "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px]"
          : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className={compact ? "truncate" : ""}>{label}</span>
    </Link>
  )
}

function SidebarContent({ close }: { close?: () => void }) {
  const groups = ["Здоровье", "Чекапы", "Сервис"] as const
  return (
    <>
      <Link href="/dashboard" onClick={close} className="flex items-center gap-2 px-3 py-2">
        <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
          <HeartPulse className="size-4" />
        </span>
        <span className="font-semibold">Medhub</span>
      </Link>
      <Separator className="my-4" />
      <nav className="space-y-5" aria-label="Основная навигация">
        {groups.map((group) => (
          <div key={group} className="space-y-1">
            <p className="px-3 text-xs font-medium text-muted-foreground">{group}</p>
            {NAV.filter((item) => item.group === group).map((item) => (
              <NavLink key={item.href} {...item} onClick={close} />
            ))}
          </div>
        ))}
      </nav>
    </>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading, signOutUser } = useAuth()
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace("/login")
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="mx-auto grid min-h-svh max-w-7xl gap-6 p-6 md:grid-cols-[240px_1fr]">
        <Skeleton className="hidden h-full md:block" />
        <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-muted/25">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-background p-4 md:block">
        <SidebarContent />
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-8">
          <Sheet open={menu} onOpenChange={setMenu}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="md:hidden" aria-label="Открыть меню">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SidebarContent close={() => setMenu(false)} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.email}</p>
            <p className="text-xs text-muted-foreground">Личный кабинет пациента</p>
          </div>
          <Button size="icon" variant="ghost" aria-label="Уведомления"><Bell /></Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Выйти"
            onClick={() => void signOutUser().then(() => router.replace("/"))}
          >
            <LogOut />
          </Button>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 md:px-8 md:pb-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background md:hidden" aria-label="Мобильная навигация">
        {MOBILE.map((item) => <NavLink key={item.href} {...item} compact />)}
      </nav>
    </div>
  )
}

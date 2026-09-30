"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, Minus, Plus, TerminalSquare, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/auth-provider"
import { loadIntake, loadStory, saveCheckupRequest } from "@/lib/account"
import {
  formatPriceKzt,
  indicativePriceKzt,
  isRecommendationEvent,
  type CheckPriority,
  type CheckupRecommendation,
  type RecommendationEvent,
  type ToolStep,
} from "@/lib/recommendation"

const TOOL_LABEL: Record<string, string> = {
  uptodate_search: "UpToDate · поиск",
  uptodate_get_topic: "UpToDate · тема",
  kzprotocols_search: "Протоколы МЗ РК · поиск",
  kzprotocols_get: "Протоколы МЗ РК · текст",
}

const PRIORITY_LABEL = {
  routine: "Планово",
  priority: "В ближайшее время",
  urgent: "Срочно",
} as const

const URGENCY_LABEL = {
  routine: "Планово",
  priority: "В ближайшее время",
  urgent: "Нужна быстрая оценка",
  emergency: "Может понадобиться экстренная помощь",
} as const

const SOURCE_LABEL: Record<string, string> = {
  "Clinical protocol MCP": "Клинический протокол",
  "UpToDate MCP": "UpToDate",
}

function toolLabel(name: string) {
  return TOOL_LABEL[name] ?? name
}

function formatArgs(args?: Record<string, unknown>) {
  if (!args || Object.keys(args).length === 0) return ""
  try {
    return JSON.stringify(args, null, 2)
  } catch {
    return ""
  }
}

function ToolStepCard({ step, openByDefault }: { step: ToolStep; openByDefault: boolean }) {
  const [open, setOpen] = useState(openByDefault || step.status === "running")
  const argsText = formatArgs(step.args)
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        {step.status === "running" ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
        ) : step.status === "error" ? (
          <XCircle className="size-3.5 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
        )}
        <TerminalSquare className="text-muted-foreground size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">{toolLabel(step.name)}</span>
        <span className="text-muted-foreground shrink-0 text-[10px] tracking-wide uppercase">
          {step.status === "running" ? "Идёт" : step.status === "error" ? "Ошибка" : "Готово"}
        </span>
        {open ? (
          <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
        )}
      </button>
      {open && (argsText || step.summary) ? (
        <div className="bg-muted/40 space-y-2 border-t px-2.5 py-2">
          {argsText ? (
            <pre className="text-muted-foreground max-h-32 overflow-auto font-mono text-[11px] whitespace-pre-wrap">
              {argsText}
            </pre>
          ) : null}
          {step.summary ? <p className="text-muted-foreground leading-relaxed">{step.summary}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

type CatalogItem = {
  id: string
  name: string
  why: string
  priceKzt: number
  priority?: CheckPriority
}

function itemId(name: string, why: string) {
  return `${name}::${why}`
}

function ExamCard({
  item,
  selected,
  onToggle,
}: {
  item: CatalogItem
  selected: boolean
  onToggle: () => void
}) {
  return (
    <li className={`rounded-lg border px-3 py-2.5 ${selected ? "border-foreground/20 bg-muted/30" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">{item.name}</p>
            {item.priority ? (
              <span className="text-muted-foreground shrink-0 text-xs">{PRIORITY_LABEL[item.priority]}</span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1">{item.why}</p>
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Условная стоимость</span>{" "}
            <span className="font-medium">{formatPriceKzt(item.priceKzt)}</span>
          </p>
        </div>
        <Button
          type="button"
          variant={selected ? "outline" : "default"}
          size="icon"
          aria-pressed={selected}
          aria-label={selected ? `Убрать ${item.name}` : `Добавить ${item.name}`}
          onClick={onToggle}
        >
          {selected ? <Minus /> : <Plus />}
        </Button>
      </div>
    </li>
  )
}

function Answer({ recommendation, uid }: { recommendation: CheckupRecommendation; uid: string }) {
  const router = useRouter()
  const recommended = recommendation.recommended_checkup.map((item) => ({
    id: itemId(item.name, item.why),
    name: item.name,
    why: item.why,
    priceKzt: indicativePriceKzt(item.name),
    priority: item.priority,
  }))
  const optional = recommendation.optional_tests.map((item) => ({
    id: itemId(item.name, item.why),
    name: item.name,
    why: item.why,
    priceKzt: indicativePriceKzt(item.name),
  }))
  const [selected, setSelected] = useState<string[]>(() => recommended.map((item) => item.id))
  const [step, setStep] = useState<"cart" | "phone">("cart")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const catalog = [...recommended, ...optional]
  const cart = catalog.filter((item) => selected.includes(item.id))
  const total = cart.reduce((sum, item) => sum + item.priceKzt, 0)
  const sources = recommendation.source_basis
    .map((item) => SOURCE_LABEL[item] ?? item)
    .filter((item, index, list) => list.indexOf(item) === index)

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
    setError("")
  }

  async function send() {
    if (cart.length === 0) {
      setError("Добавьте хотя бы одно обследование.")
      return
    }
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 10 || digits.length > 15) {
      setError("Введите номер телефона.")
      return
    }
    setPending(true)
    setError("")
    try {
      await saveCheckupRequest(
        uid,
        {
          title: "Профилактический чекап",
          complaints: recommendation.summary,
          status: "active",
          recommendation,
          studies: cart.map((item) => ({
            id: item.id,
            name: item.name,
            why: item.why,
            priceKzt: item.priceKzt,
            status: "recommended",
          })),
        },
        {
          tests: cart.map((item) => ({ name: item.name, priceKzt: item.priceKzt })),
          totalKzt: total,
          phone: `+${digits}`,
        },
      )
      router.push("/dashboard")
    } catch {
      setError("Не удалось отправить заявку.")
    } finally {
      setPending(false)
    }
  }

  if (step === "phone") {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Шаг 2 из 2</CardDescription>
          <CardTitle>Заявка</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="space-y-2">
            {cart.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <span>{item.name}</span>
                <span className="text-muted-foreground shrink-0">{formatPriceKzt(item.priceKzt)}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm font-medium">Итого {formatPriceKzt(total)}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" aria-hidden>
              +
            </span>
            <Input
              inputMode="tel"
              autoComplete="tel-national"
              aria-label="Номер телефона"
              placeholder="7 700 000 00 00"
              value={phone}
              disabled={pending}
              onChange={(event) => {
                setPhone(event.target.value.replace(/[^\d\s()-]/g, ""))
                setError("")
              }}
            />
          </div>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button type="button" disabled={pending} onClick={() => void send()}>
              {pending ? "Отправляем…" : "Отправить заявку"}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setStep("cart")}>
              Назад
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>Шаг 1 из 2</CardDescription>
        <CardTitle>Что пройти</CardTitle>
        <CardDescription>{recommendation.summary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">
          <span className="font-medium">{URGENCY_LABEL[recommendation.urgency.level]}.</span>
          {recommendation.urgency.reason ? ` ${recommendation.urgency.reason}` : ""}
        </p>

        {recommended.length === 0 ? (
          <p className="text-muted-foreground text-sm">Сейчас отдельный список обследований не нужен.</p>
        ) : (
          <ul className="space-y-2">
            {recommended.map((item) => (
              <ExamCard
                key={item.id}
                item={item}
                selected={selected.includes(item.id)}
                onToggle={() => toggle(item.id)}
              />
            ))}
          </ul>
        )}

        {optional.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-medium">Можно обсудить позже</h2>
            <ul className="space-y-2">
              {optional.map((item) => (
                <ExamCard
                  key={item.id}
                  item={item}
                  selected={selected.includes(item.id)}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {recommendation.doctor_visit.recommended ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {recommendation.doctor_visit.reason || "Лучше сначала показаться врачу."}
          </p>
        ) : null}

        <div className="space-y-3 border-t pt-4">
          <p className="text-sm">
            <span className="text-muted-foreground">Выбрано · {cart.length}</span>
            <span className="ml-2 font-medium">{formatPriceKzt(total)}</span>
          </p>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              if (cart.length === 0) {
                setError("Добавьте хотя бы одно обследование.")
                return
              }
              setError("")
              setStep("phone")
            }}
          >
            Дальше
          </Button>
        </div>

        {sources.length > 0 ? (
          <p className="text-muted-foreground text-xs">Опора: {sources.join(", ")}</p>
        ) : null}
        <p className="text-muted-foreground text-xs">Это не диагноз и не назначение. Решение принимает врач.</p>
      </CardContent>
    </Card>
  )
}

async function readStream(
  response: Response,
  handlers: {
    onSteps: (steps: ToolStep[]) => void
    onResult: (recommendation: CheckupRecommendation) => void
    onError: (message: string) => void
  },
) {
  const reader = response.body?.getReader()
  if (!reader) {
    handlers.onError("Нет связи с сервером. Повторите запрос.")
    return
  }
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split("\n\n")
    buffer = chunks.pop() ?? ""
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((item) => item.startsWith("data: "))
      if (!line) continue
      let event: RecommendationEvent
      try {
        const parsed: unknown = JSON.parse(line.slice(6))
        if (!isRecommendationEvent(parsed)) throw new Error("Invalid event")
        event = parsed
      } catch {
        handlers.onError("Ответ не получилось разобрать.")
        return
      }
      if (event.type === "steps") handlers.onSteps(event.steps)
      if (event.type === "result") handlers.onResult(event.recommendation)
      if (event.type === "error") handlers.onError(event.error)
    }
  }
}

export function RecommendationView() {
  const router = useRouter()
  const { user, loading, configured } = useAuth()
  const [steps, setSteps] = useState<ToolStep[]>([])
  const [result, setResult] = useState<CheckupRecommendation | null>(null)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [missing, setMissing] = useState("")
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login")
    }
  }, [loading, user, router])

  useEffect(() => {
    if (loading || !user) return
    let cancelled = false
    Promise.resolve()
      .then(() => {
        if (cancelled) return Promise.reject(new Error("cancelled"))
        setPending(true)
        setError("")
        setResult(null)
        setSteps([])
        setMissing("")
        return Promise.all([loadIntake(user.uid), loadStory(user.uid)])
      })
      .then(async ([intake, story]) => {
        if (cancelled) return
        if (!intake) {
          setMissing("Сначала заполните возраст, пол, вес и рост.")
          return
        }
        if (story.complaints.trim().length < 3) {
          setMissing("Сначала опишите жалобы.")
          return
        }
        const token = await user.getIdToken()
        const response = await fetch("/api/recommendation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sex: intake.sex,
            age: intake.age,
            weightKg: intake.weightKg,
            heightCm: intake.heightCm,
            complaints: story.complaints,
            diseaseHistory: story.diseaseHistory,
            lifeHistory: story.lifeHistory,
          }),
        })
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null
          setError(data?.error || "Не удалось получить ответ.")
          return
        }
        let settled = false
        await readStream(response, {
          onSteps: (next) => {
            if (!cancelled) setSteps(next)
          },
          onResult: (recommendation) => {
            settled = true
            if (!cancelled) setResult(recommendation)
          },
          onError: (message) => {
            settled = true
            if (!cancelled) setError(message)
          },
        })
        if (!cancelled && !settled) setError("Ответ не пришёл. Повторите запрос.")
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось открыть анкету.")
      })
      .finally(() => {
        if (!cancelled) setPending(false)
      })

    return () => {
      cancelled = true
    }
  }, [loading, user, runId])

  if (!configured) {
    return <p className="text-muted-foreground text-sm">Firebase не настроен.</p>
  }
  if (loading || !user) {
    return <p className="text-muted-foreground text-sm">Открываем подбор…</p>
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Обследования</h1>
        <p className="text-muted-foreground text-sm">
          Сначала сверяем жалобы с протоколом и UpToDate, потом остаётся короткий список.
        </p>
      </div>

      {missing ? (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">{missing}</p>
            <Button asChild>
              <Link href={missing.includes("жалоб") ? "/story" : "/questionnaire"}>
                Вернуться к анкете
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {pending || steps.length > 0 ? (
        <div className="space-y-1.5 rounded-xl border p-3">
          {pending && steps.length === 0 ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-3.5 animate-spin" />
              Ищу в протоколах и UpToDate…
            </p>
          ) : (
            steps.map((step, index) => (
              <ToolStepCard
                key={`${step.name}-${index}-${step.status}`}
                step={step}
                openByDefault={step.status === "running" || (pending && index === steps.length - 1)}
              />
            ))
          )}
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
          <Button type="button" variant="outline" onClick={() => setRunId((value) => value + 1)}>
            Повторить
          </Button>
        </div>
      ) : null}

      {result ? <Answer recommendation={result} uid={user.uid} /> : null}
    </div>
  )
}

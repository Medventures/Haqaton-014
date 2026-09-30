"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { CalendarClock, ClipboardList, Download, FlaskConical, HeartPulse, Plus } from "lucide-react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { loadIntake, loadStory } from "@/lib/account"
import {
  CATEGORY_LABELS,
  observationStatus,
  type Encounter,
  type Observation,
  type Reminder,
} from "@/lib/domain/patient"
import {
  categoryForStudy,
  isDoneStatus,
  latestObservation,
  STUDY_STATUS_LABEL,
} from "@/lib/domain/study-map"
import {
  listEncounters,
  listObservations,
  listReminders,
  saveFeedback,
  saveObservation,
  saveReminder,
  saveStudyResult,
} from "@/lib/repositories/patient-repository"

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </header>
  )
}

function EmptyState({
  icon: Icon,
  title,
  text,
  href,
  action,
}: {
  icon: typeof HeartPulse
  title: string
  text: string
  href?: string
  action?: string
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-44 flex-col items-center justify-center text-center">
        <span className="mb-3 grid size-10 place-items-center rounded-full bg-muted">
          <Icon className="size-5" />
        </span>
        <p className="font-medium">{title}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
        {href && action ? (
          <Button asChild className="mt-4">
            <Link href={href}>{action}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function usePatientData() {
  const { user } = useAuth()
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([
      listEncounters(user.uid).catch(() => []),
      listObservations(user.uid).catch(() => []),
      listReminders(user.uid).catch(() => []),
    ]).then(([nextEncounters, nextObservations, nextReminders]) => {
      if (cancelled) return
      setEncounters(nextEncounters)
      setObservations(nextObservations)
      setReminders(nextReminders)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [user])
  return { user, encounters, observations, reminders, loading, setEncounters, setObservations, setReminders }
}

function studyProgress(encounter?: Encounter) {
  const total = encounter?.studies.length ?? 0
  const done = encounter?.studies.filter((item) => isDoneStatus(item.status)).length ?? 0
  return { total, done, value: total ? Math.round((done / total) * 100) : 0 }
}

function exportCsv(observations: Observation[], encounters: Encounter[]) {
  const rows = [
    ["Дата", "Показатель", "Значение", "Единица", "Источник", "Обращение"],
    ...observations.map((item) => [
      item.observedAt.toLocaleDateString("ru-RU"),
      item.name,
      String(item.value),
      item.unit ?? "",
      item.provenance,
      encounters.find((entry) => entry.id === item.encounterId)?.title ?? "",
    ]),
  ]
  if (observations.length === 0) {
    rows.push(
      ...encounters.flatMap((encounter) =>
        encounter.studies.map((study) => [
          encounter.createdAt.toLocaleDateString("ru-RU"),
          study.name,
          "",
          "",
          STUDY_STATUS_LABEL[study.status],
          encounter.title,
        ]),
      ),
    )
  }
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(";")).join("\n")
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "medhub-nablyudenie.csv"
  link.click()
  URL.revokeObjectURL(url)
}

function Timeline({ encounter }: { encounter: Encounter }) {
  return (
    <ol className="space-y-3">
      <li className="flex gap-3">
        <span className="mt-1 size-2.5 shrink-0 rounded-full bg-primary" />
        <div>
          <p className="font-medium">Чекап создан</p>
          <p className="text-sm text-muted-foreground">{encounter.createdAt.toLocaleDateString("ru-RU")}</p>
        </div>
      </li>
      {encounter.studies.map((study) => (
        <li key={study.id} className="flex gap-3">
          <span className={`mt-1 size-2.5 shrink-0 rounded-full ${isDoneStatus(study.status) ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{study.name}</p>
              <Badge variant="outline">{STUDY_STATUS_LABEL[study.status]}</Badge>
            </div>
            {study.why ? <p className="mt-1 text-sm text-muted-foreground">{study.why}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function DashboardPage() {
  const { encounters, observations, reminders, loading } = usePatientData()
  const active = encounters.find((item) => item.status === "active") ?? encounters[0]
  const progress = studyProgress(active)
  const nextStudy = active?.studies.find((item) => !isDoneStatus(item.status))
  return (
    <>
      <PageHeader
        title="Добрый день"
        description="Шаги чекапа, карта здоровья и наблюдение строятся из выбранных обследований."
        action={
          <Button asChild>
            <Link href="/checkup">
              <Plus />
              Новый чекап
            </Link>
          </Button>
        }
      />
      {loading ? (
        <Progress value={35} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <Card>
              <CardHeader>
                <CardDescription>Активный чекап</CardDescription>
                <CardTitle>
                  {active
                    ? `${progress.done} из ${progress.total} шагов выполнено`
                    : "Нет активного обращения"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progress.value} />
                {active && progress.total === 0 ? (
                  <p className="text-sm text-muted-foreground">В обращении пока нет исследований. Соберите корзину в подборе.</p>
                ) : null}
                {active ? <Timeline encounter={active} /> : null}
                <Button asChild>
                  <Link href={active ? `/encounters/${active.id}` : "/checkup"}>
                    {active ? "Открыть обращение" : "Создать чекап"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardDescription>Карта здоровья</CardDescription>
                  <CardTitle>
                    {active?.studies.length
                      ? `${new Set(active.studies.map((item) => categoryForStudy(item.name))).size} направлений`
                      : `${observations.length} показателей`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link href="/health-map">Открыть</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Мои обращения</CardDescription>
                  <CardTitle>{encounters.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link href="/encounters">Посмотреть</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="space-y-4 lg:col-span-4">
            <Card>
              <CardHeader>
                <CardDescription>Следующий шаг</CardDescription>
                <CardTitle>{nextStudy?.name ?? "Все выбранные шаги закрыты"}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/analyses">Внести результат</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Напоминания</CardDescription>
                <CardTitle>{reminders.filter((item) => item.status === "active").length} активных</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/reminders">Все напоминания</Link>
                </Button>
              </CardContent>
            </Card>
            <Button variant="outline" className="w-full" onClick={() => exportCsv(observations, encounters)}>
              <Download />
              Экспорт наблюдения
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

function EncounterCard({ encounter }: { encounter: Encounter }) {
  const progress = studyProgress(encounter)
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between gap-3">
          <div>
            <CardTitle>{encounter.title}</CardTitle>
            <CardDescription>{encounter.createdAt.toLocaleDateString("ru-RU")}</CardDescription>
          </div>
          <Badge variant="outline">
            {encounter.status === "completed" ? "Завершено" : encounter.status === "draft" ? "Черновик" : "Активно"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{encounter.complaints || "Жалобы не указаны"}</p>
        <p className="text-sm text-muted-foreground">
          {progress.done} из {progress.total} шагов выполнено
        </p>
        <Progress value={progress.value} />
        <Button asChild variant="outline">
          <Link href={`/encounters/${encounter.id}`}>Открыть</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function EncountersPage() {
  const { encounters, loading } = usePatientData()
  const filtered = (status?: Encounter["status"]) => encounters.filter((item) => !status || item.status === status)
  return (
    <>
      <PageHeader
        title="Мои обращения"
        description="Каждый чекап становится набором шагов, результатов и карты здоровья."
        action={
          <Button asChild>
            <Link href="/checkup">
              <Plus />
              Новое обращение
            </Link>
          </Button>
        }
      />
      {loading ? (
        <Progress value={45} />
      ) : encounters.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Обращений пока нет"
          text="После заявки из подбора здесь появится чекап и его шаги."
          href="/checkup"
          action="Новый чекап"
        />
      ) : (
        <Tabs defaultValue="all">
          <div className="max-w-full overflow-x-auto pb-1">
            <TabsList>
              <TabsTrigger value="all">Все</TabsTrigger>
              <TabsTrigger value="active">Активные</TabsTrigger>
              <TabsTrigger value="completed">Завершённые</TabsTrigger>
              <TabsTrigger value="draft">Черновики</TabsTrigger>
            </TabsList>
          </div>
          {(["all", "active", "completed", "draft"] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="grid gap-4 md:grid-cols-2">
              {filtered(tab === "all" ? undefined : tab).map((item) => (
                <EncounterCard key={item.id} encounter={item} />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  )
}

export function EncounterDetailPage() {
  const params = useParams<{ id: string }>()
  const { encounters, observations, loading } = usePatientData()
  const encounter = encounters.find((item) => item.id === params.id)
  if (loading) return <Progress value={40} />
  if (!encounter) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Обращение не найдено"
        text="Вернитесь к списку обращений."
        href="/encounters"
        action="К обращениям"
      />
    )
  }
  const progress = studyProgress(encounter)
  return (
    <>
      <PageHeader
        title={encounter.title}
        description={encounter.createdAt.toLocaleDateString("ru-RU")}
        action={
          <Button asChild variant="outline">
            <Link href="/analyses">Внести результаты</Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Ваш маршрут чекапа</CardTitle>
            <CardDescription>
              {progress.done} из {progress.total} шагов
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Timeline encounter={encounter} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Связанные результаты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {observations.filter((item) => item.encounterId === encounter.id).length === 0 ? (
              <p className="text-sm text-muted-foreground">Результаты появятся после внесения значений по шагам.</p>
            ) : (
              observations
                .filter((item) => item.encounterId === encounter.id)
                .map((item) => (
                  <p key={item.id} className="text-sm">
                    {item.name}: <strong>{item.value} {item.unit}</strong>
                  </p>
                ))
            )}
            <Button asChild className="mt-2 w-full" variant="outline">
              <Link href="/health-map">Карта здоровья</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export function HealthMapPage() {
  const { encounters, observations, loading } = usePatientData()
  const studies = encounters.flatMap((item) => item.studies)
  const grouped = useMemo(() => {
    const map = new Map<Observation["category"], { names: string[]; values: Observation[] }>()
    for (const study of studies) {
      const category = categoryForStudy(study.name)
      const current = map.get(category) ?? { names: [], values: [] }
      if (!current.names.includes(study.name)) current.names.push(study.name)
      map.set(category, current)
    }
    for (const item of observations) {
      const current = map.get(item.category) ?? { names: [], values: [] }
      if (!current.names.includes(item.name)) current.names.push(item.name)
      current.values.push(item)
      map.set(item.category, current)
    }
    return map
  }, [studies, observations])

  return (
    <>
      <PageHeader
        title="Карта здоровья"
        description="Направления собираются из обследований чекапа. Числа появляются только после результата."
        action={
          <Button asChild>
            <Link href="/analyses">
              <Plus />
              Добавить результат
            </Link>
          </Button>
        }
      />
      {loading ? (
        <Progress value={50} />
      ) : grouped.size === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title="Карта ещё не собрана"
          text="После персонального чекапа здесь появятся направления по выбранным исследованиям."
          href="/checkup"
          action="Собрать чекап"
        />
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader>
              <CardDescription>Общая картина</CardDescription>
              <CardTitle>
                {observations.some((item) => observationStatus(item) === "Требует внимания")
                  ? "Есть показатели, требующие внимания"
                  : observations.length
                    ? "Есть сохранённые результаты"
                    : `${studies.length} шагов наблюдения без числовых результатов`}
              </CardTitle>
            </CardHeader>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...grouped.entries()].map(([category, group]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{CATEGORY_LABELS[category]}</CardTitle>
                  <Badge variant="outline">
                    {group.values.some((item) => observationStatus(item) === "Требует внимания")
                      ? "Требует внимания"
                      : group.values.length
                        ? "Есть данные"
                        : "По плану чекапа"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.names.map((name) => {
                    const value = latestObservation(name, group.values)
                    return (
                      <div key={name} className="flex justify-between gap-3 text-sm">
                        <span>{name}</span>
                        <strong>{value ? `${value.value} ${value.unit ?? ""}` : "ожидает результат"}</strong>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export function AnalysesPage() {
  const { user, encounters, observations, loading, setEncounters, setObservations } = usePatientData()
  const [selected, setSelected] = useState("")
  const [value, setValue] = useState("")
  const [unit, setUnit] = useState("")
  const studies = encounters.flatMap((encounter) =>
    encounter.studies.map((study) => ({ ...study, encounter })),
  )
  const current = studies.find((item) => item.id === selected) ?? studies.find((item) => !isDoneStatus(item.status)) ?? studies[0]
  const history = observations
    .filter((item) => current && item.name.toLowerCase() === current.name.toLowerCase())
    .slice()
    .reverse()
    .map((item) => ({ date: item.observedAt.toLocaleDateString("ru-RU"), value: item.value }))

  async function add() {
    if (!user || !current) return
    const number = Number(value.replace(",", "."))
    if (!Number.isFinite(number)) {
      toast.error("Укажите число из бланка.")
      return
    }
    try {
      const studiesNext = await saveStudyResult(user.uid, current.encounter, current.id, number, unit || undefined)
      setEncounters((items) =>
        items.map((item) => (item.id === current.encounter.id ? { ...item, studies: studiesNext } : item)),
      )
      setObservations((items) => [
        {
          id: crypto.randomUUID(),
          encounterId: current.encounter.id,
          name: current.name,
          category: categoryForStudy(current.name),
          value: number,
          unit: unit || undefined,
          observedAt: new Date(),
          provenance: "patient",
          verification: "self_reported",
        },
        ...items,
      ])
      setValue("")
      toast.success("Результат добавлен в наблюдение и карту здоровья.")
    } catch {
      const next: Omit<Observation, "id"> = {
        name: current.name,
        category: categoryForStudy(current.name),
        value: number,
        unit: unit || undefined,
        observedAt: new Date(),
        provenance: "patient",
        verification: "self_reported",
      }
      await saveObservation(user.uid, next)
      setObservations((items) => [{ ...next, id: crypto.randomUUID() }, ...items])
      toast.success("Результат сохранён как введённый пациентом.")
    }
  }

  return (
    <>
      <PageHeader
        title="Мои анализы"
        description="Список строится из шагов чекапа. Динамика появляется после нескольких результатов одного показателя."
        action={
          <Button variant="outline" onClick={() => exportCsv(observations, encounters)}>
            <Download />
            Экспорт
          </Button>
        }
      />
      {loading ? (
        <Progress value={45} />
      ) : studies.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Пока нет плана анализов"
          text="Сначала соберите обследования в чекапе. Тогда здесь появятся шаги наблюдения."
          href="/checkup"
          action="Собрать чекап"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {history.length > 1 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Динамика: {current?.name}</CardTitle>
                </CardHeader>
                <CardContent className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line dataKey="value" stroke="currentColor" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : null}
            {studies.map((study) => {
              const result = latestObservation(study.name, observations)
              return (
                <Card key={`${study.encounter.id}-${study.id}`} className={current?.id === study.id ? "border-primary" : ""}>
                  <CardContent className="flex items-start justify-between gap-3 pt-4">
                    <button type="button" className="min-w-0 text-left" onClick={() => setSelected(study.id)}>
                      <p className="font-medium">{study.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {study.encounter.title} · {STUDY_STATUS_LABEL[study.status]}
                      </p>
                      {result ? (
                        <p className="mt-1 text-sm">
                          {result.value} {result.unit} · {result.observedAt.toLocaleDateString("ru-RU")}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">Результат ещё не внесён</p>
                      )}
                    </button>
                    <Badge variant="outline">{CATEGORY_LABELS[categoryForStudy(study.name)]}</Badge>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Результат шага</CardTitle>
              <CardDescription>{current?.name ?? "Выберите исследование"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="analysis-value">Значение</Label>
              <Input id="analysis-value" inputMode="decimal" placeholder="Число из бланка" value={value} onChange={(event) => setValue(event.target.value)} />
              <Label htmlFor="analysis-unit">Единица</Label>
              <Input id="analysis-unit" placeholder="например, нг/мл" value={unit} onChange={(event) => setUnit(event.target.value)} />
              <Button className="w-full" disabled={!current} onClick={() => void add()}>
                Сохранить в наблюдение
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

export function RemindersPage() {
  const { user, reminders, setReminders } = usePatientData()
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  async function add() {
    if (!user || !title.trim() || !date) return
    const next: Omit<Reminder, "id"> = {
      title: title.trim(),
      reason: "Создано пациентом",
      dueAt: new Date(`${date}T09:00`),
      status: "active",
      channel: "push",
    }
    await saveReminder(user.uid, next)
    setReminders((current) => [...current, { ...next, id: crypto.randomUUID() }])
    setTitle("")
    setDate("")
    toast.success("Напоминание сохранено")
  }
  return (
    <>
      <PageHeader title="Напоминания" description="Каждое напоминание связано с понятной причиной." />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {reminders.length ? (
            reminders.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>
                    {item.dueAt.toLocaleDateString("ru-RU")} · {item.reason}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))
          ) : (
            <EmptyState icon={CalendarClock} title="Напоминаний пока нет" text="Создайте напоминание о повторном анализе или посещении." />
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Новое напоминание</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="reminder-title">Анализ или действие</Label>
            <Input id="reminder-title" placeholder="Например, повторить ферритин" value={title} onChange={(event) => setTitle(event.target.value)} />
            <Label htmlFor="reminder-date">Дата</Label>
            <Input id="reminder-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            <Button className="w-full" onClick={() => void add()}>
              Сохранить
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export function ProfilePage() {
  const { user } = useAuth()
  const [details, setDetails] = useState("Загружаем…")
  useEffect(() => {
    if (user) {
      void Promise.all([loadIntake(user.uid), loadStory(user.uid)]).then(([intake, story]) =>
        setDetails(
          intake
            ? `${intake.age} лет · ${intake.sex === "female" ? "Женский" : "Мужской"} · ${intake.weightKg} кг · ${intake.heightCm} см\n${story.lifeHistory || "История жизни не заполнена"}`
            : "Анкета не заполнена",
        ),
      )
    }
  }, [user])
  return (
    <>
      <PageHeader title="Профиль" description="Данные, используемые для персонализации чекапа." />
      <Card>
        <CardHeader>
          <CardTitle>{user?.email}</CardTitle>
          <CardDescription className="whitespace-pre-line">{details}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/questionnaire">Изменить анкету</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  )
}

export function FeedbackPage() {
  const { user } = useAuth()
  const [message, setMessage] = useState("")
  async function send() {
    if (!user || !message.trim()) return
    try {
      await saveFeedback(user.uid, message)
      setMessage("")
      toast.success("Спасибо. Сообщение отправлено.")
    } catch {
      toast.error("Не удалось отправить сообщение.")
    }
  }
  return (
    <>
      <PageHeader title="Обратная связь" description="Сообщите об ошибке или предложите улучшение." />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Написать нам</CardTitle>
          <CardDescription>Не используйте эту форму для срочной медицинской помощи.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="feedback-message">Сообщение</Label>
          <Textarea id="feedback-message" placeholder="Опишите проблему или предложение" value={message} onChange={(event) => setMessage(event.target.value)} />
          <Button onClick={() => void send()}>Отправить</Button>
        </CardContent>
      </Card>
    </>
  )
}

export function CheckupPage() {
  const { encounters } = usePatientData()
  const active = encounters.find((item) => item.status === "active") ?? encounters[0]
  const progress = studyProgress(active)
  return (
    <>
      <PageHeader title="Новый чекап" description="Пройдите анкету, получите список и соберите заявку. Шаги сразу попадут в карту здоровья и анализы." />
      {active && progress.total > 0 ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Текущие шаги</CardTitle>
            <CardDescription>
              {progress.done} из {progress.total}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Timeline encounter={active} />
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["1", "Паспортные данные", "Возраст, пол, вес и рост", "/questionnaire"],
          ["2", "История здоровья", "Жалобы, история болезни и жизни", "/story"],
          ["3", "Персональный список", "Протоколы и UpToDate с видимыми шагами", "/recommendation"],
        ].map(([step, title, text, href]) => (
          <Card key={step}>
            <CardHeader>
              <Badge className="w-fit">{step}</Badge>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{text}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href={href}>Открыть</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

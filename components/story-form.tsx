"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/components/auth-provider"
import { loadStory, saveStory, type Story } from "@/lib/account"

const STEPS = [
  {
    key: "complaints",
    title: "Жалобы",
    hint: "",
    placeholder: "Опишите, что беспокоит сейчас",
  },
  {
    key: "diseaseHistory",
    title: "История заболевания",
    hint: "",
    placeholder:
      "Когда началось. Как началось и как менялось. Что усиливает и что облегчает. Было ли раньше. Чем уже лечились и помогло ли.",
  },
  {
    key: "lifeHistory",
    title: "История жизни",
    hint: "Напишите кратко: хронические болезни, операции и травмы, аллергии, постоянные лекарства, привычки, болезни у близких родственников.",
    placeholder: "Кратко, своими словами",
  },
] as const

type StoryKey = (typeof STEPS)[number]["key"]

const EMPTY: Story = { complaints: "", diseaseHistory: "", lifeHistory: "" }

export function StoryForm() {
  const router = useRouter()
  const { user, loading, configured } = useAuth()
  const [story, setStory] = useState<Story>(EMPTY)
  const [step, setStep] = useState(0)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login")
      return
    }
    let cancelled = false
    loadStory(user.uid)
      .then((saved) => {
        if (cancelled) return
        setStory(saved)
        const firstEmpty = STEPS.findIndex((item) => saved[item.key].trim() === "")
        setStep(firstEmpty === -1 ? STEPS.length - 1 : firstEmpty)
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось открыть сохранённые ответы.")
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [loading, user, router])

  const current = STEPS[step]
  const value = story[current.key]

  function update(key: StoryKey, next: string) {
    setStory((prev) => ({ ...prev, [key]: next }))
    setDone(false)
  }

  async function onFilled() {
    if (!user) return
    if (value.trim() === "") {
      setError("Сначала заполните поле.")
      return
    }
    setPending(true)
    setError("")
    const nextStory = { ...story, [current.key]: value.trim() }
    try {
      await saveStory(user.uid, user.email, nextStory)
      setStory(nextStory)
      if (step < STEPS.length - 1) {
        setStep(step + 1)
      } else {
        setDone(true)
        router.push("/recommendation")
      }
    } catch {
      setError("Не удалось сохранить ответ. Попробуйте ещё раз.")
    } finally {
      setPending(false)
    }
  }

  if (!configured) {
    return <p className="text-sm text-muted-foreground">Firebase не настроен.</p>
  }
  if (loading || !user || !ready) {
    return <p className="text-sm text-muted-foreground">Открываем вопросы…</p>
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardDescription>
          Шаг {step + 1} из {STEPS.length}
        </CardDescription>
        <CardTitle>{current.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {current.hint ? <p className="text-sm text-muted-foreground">{current.hint}</p> : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor={current.key} className="sr-only">
            {current.title}
          </Label>
          <Textarea
            id={current.key}
            value={value}
            placeholder={current.placeholder}
            onChange={(event) => update(current.key, event.target.value)}
            className="min-h-36"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {done ? (
          <p role="status" className="text-sm text-muted-foreground">
            Ответы сохранены. Это не диагноз.
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={pending}>
                Назад
              </Button>
            ) : null}
            <Button type="button" onClick={() => void onFilled()} disabled={pending}>
              {pending ? "Сохраняем…" : "Заполнил"}
            </Button>
          </div>
          {STEPS.every((item) => story[item.key].trim() !== "") ? (
            <Button type="button" variant="outline" onClick={() => router.push("/recommendation")}>
              Подобрать обследования
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

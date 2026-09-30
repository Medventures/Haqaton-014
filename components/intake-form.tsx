"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth-provider"
import { loadIntake, saveIntake } from "@/lib/account"
import { parseIntake, type Sex } from "@/lib/intake"
import { cn } from "@/lib/utils"

export function IntakeForm() {
  const router = useRouter()
  const { user, loading, configured, signOutUser } = useAuth()
  const [age, setAge] = useState("")
  const [sex, setSex] = useState<Sex | "">("")
  const [weightKg, setWeightKg] = useState("")
  const [heightCm, setHeightCm] = useState("")
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login")
      return
    }
    let cancelled = false
    loadIntake(user.uid)
      .then((intake) => {
        if (cancelled || !intake) return
        setAge(String(intake.age))
        setSex(intake.sex)
        setWeightKg(String(intake.weightKg))
        setHeightCm(String(intake.heightCm))
        setSaved(true)
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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    const parsed = parseIntake({ age, sex, weightKg, heightCm })
    if (!parsed.ok) {
      setSaved(false)
      setError(parsed.error)
      return
    }
    setPending(true)
    setError("")
    try {
      await saveIntake(user.uid, user.email, parsed.value)
      router.push("/story")
    } catch {
      setError("Не удалось сохранить ответы. Попробуйте ещё раз.")
    } finally {
      setPending(false)
    }
  }

  if (!configured) {
    return <p className="text-sm text-muted-foreground">Firebase не настроен.</p>
  }
  if (loading || !user || !ready) {
    return <p className="text-sm text-muted-foreground">Открываем опросник…</p>
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Опросник</CardTitle>
        <CardDescription>Возраст, пол, вес и рост. Эти данные не являются диагнозом.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="age">Возраст</Label>
            <Input
              id="age"
              inputMode="numeric"
              required
              value={age}
              onChange={(event) => setAge(event.target.value)}
              placeholder="Например, 34"
            />
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Пол</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ["female", "Женский"],
                  ["male", "Мужской"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={cn(
                    "cursor-pointer rounded-lg border px-3 py-3 text-sm",
                    sex === value ? "border-primary bg-muted" : "border-border",
                  )}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="sex"
                    value={value}
                    checked={sex === value}
                    onChange={() => setSex(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-2">
            <Label htmlFor="weight">Вес, кг</Label>
            <Input
              id="weight"
              inputMode="decimal"
              required
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
              placeholder="Например, 72.5"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="height">Рост, см</Label>
            <Input
              id="height"
              inputMode="decimal"
              required
              value={heightCm}
              onChange={(event) => setHeightCm(event.target.value)}
              placeholder="Например, 168"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {saved && !error ? (
            <p role="status" className="text-sm text-muted-foreground">
              Ответы сохранены.
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Сохраняем…" : "Дальше"}
          </Button>
          {saved ? (
            <Button type="button" variant="outline" onClick={() => router.push("/story")}>
              К жалобам
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              void signOutUser().then(() => router.push("/login"))
            }}
          >
            Выйти
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

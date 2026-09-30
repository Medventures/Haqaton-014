"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth-provider"
import { ensureUserDoc } from "@/lib/account"
import { auth } from "@/lib/firebase"

function authErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
  if (code === "auth/email-already-in-use") return "Этот email уже зарегистрирован. Войдите."
  if (code === "auth/invalid-email") return "Проверьте адрес email."
  if (code === "auth/weak-password") return "Пароль должен быть не короче 6 символов."
  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  ) {
    return "Неверный email или пароль."
  }
  if (code === "auth/too-many-requests") return "Слишком много попыток. Подождите и попробуйте снова."
  return "Не удалось выполнить запрос. Проверьте сеть и попробуйте ещё раз."
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter()
  const { configured } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const isRegister = mode === "register"

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (!configured) {
      setError("Firebase не настроен.")
      return
    }
    if (isRegister && password !== confirm) {
      setError("Пароли не совпадают.")
      return
    }
    if (password.length < 6) {
      setError("Пароль должен быть не короче 6 символов.")
      return
    }
    setPending(true)
    try {
      const credential = isRegister
        ? await createUserWithEmailAndPassword(auth(), email.trim(), password)
        : await signInWithEmailAndPassword(auth(), email.trim(), password)
      await ensureUserDoc(credential.user.uid, credential.user.email)
      router.push(isRegister ? "/questionnaire" : "/dashboard")
    } catch (caught) {
      setError(authErrorMessage(caught))
      setPending(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isRegister ? "Регистрация" : "Вход"}</CardTitle>
        <CardDescription>
          {isRegister
            ? "После аккаунта откроется короткий опросник."
            : "Войдите, чтобы открыть личный кабинет."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {isRegister ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm">Пароль ещё раз</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Сохраняем…" : isRegister ? "Создать аккаунт" : "Войти"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isRegister ? (
              <>
                Уже есть аккаунт?{" "}
                <Link href="/login" className="text-foreground underline">
                  Войти
                </Link>
              </>
            ) : (
              <>
                Нет аккаунта?{" "}
                <Link href="/register" className="text-foreground underline">
                  Зарегистрироваться
                </Link>
              </>
            )}
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

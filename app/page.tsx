import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-4">
        <h1 className="text-2xl font-medium">Анкета</h1>
        <p className="text-sm text-muted-foreground">
          Создайте аккаунт, затем укажите возраст, пол, вес и рост.
        </p>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/register">Регистрация</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Войти</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

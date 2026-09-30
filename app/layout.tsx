import type { Metadata } from "next"
import { Manrope } from "next/font/google"

import "./globals.css"
import { AuthProvider } from "@/components/auth-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

const sans = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Medhub — персональный чекап",
  description: "Персональный чекап, результаты, напоминания и маршрут обследований.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" suppressHydrationWarning className={cn("antialiased font-sans", sans.variable)}>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

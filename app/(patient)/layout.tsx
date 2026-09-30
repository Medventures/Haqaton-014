import { AppShell } from "@/components/patient/app-shell"

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

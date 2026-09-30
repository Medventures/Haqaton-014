export type Sex = "female" | "male"

export type Intake = {
  age: number
  sex: Sex
  weightKg: number
  heightCm: number
}

export type IntakeInput = {
  age: string
  sex: string
  weightKg: string
  heightCm: string
}

function numberInRange(raw: string, min: number, max: number, decimals: number): number | null {
  const trimmed = raw.trim().replace(",", ".")
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  const factor = 10 ** decimals
  const rounded = Math.round(value * factor) / factor
  if (rounded < min || rounded > max) return null
  if (decimals === 0 && !Number.isInteger(rounded)) return null
  return rounded
}

export function parseIntake(
  input: IntakeInput,
): { ok: true; value: Intake } | { ok: false; error: string } {
  const age = numberInRange(input.age, 1, 120, 0)
  if (age == null) return { ok: false, error: "Укажите возраст от 1 до 120 лет." }
  if (input.sex !== "female" && input.sex !== "male") {
    return { ok: false, error: "Выберите пол." }
  }
  const weightKg = numberInRange(input.weightKg, 2, 400, 1)
  if (weightKg == null) return { ok: false, error: "Укажите вес от 2 до 400 кг." }
  const heightCm = numberInRange(input.heightCm, 40, 250, 1)
  if (heightCm == null) return { ok: false, error: "Укажите рост от 40 до 250 см." }
  return { ok: true, value: { age, sex: input.sex, weightKg, heightCm } }
}

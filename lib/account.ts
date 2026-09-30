import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore"
import type { Encounter } from "@/lib/domain/patient"
import { parseIntake, type Intake } from "@/lib/intake"
import { db } from "@/lib/firebase"

export type Story = {
  complaints: string
  diseaseHistory: string
  lifeHistory: string
}

export async function ensureUserDoc(uid: string, email: string | null) {
  const ref = doc(db(), "users", uid)
  const existing = await getDoc(ref)
  await setDoc(
    ref,
    {
      ...(email ? { email } : {}),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  )
}

export async function loadIntake(uid: string): Promise<Intake | null> {
  const snap = await getDoc(doc(db(), "users", uid))
  const data = snap.data()?.questionnaire
  if (!data || typeof data !== "object") return null
  const record = data as Record<string, unknown>
  const parsed = parseIntake({
    age: String(record.age ?? ""),
    sex: String(record.sex ?? ""),
    weightKg: String(record.weightKg ?? ""),
    heightCm: String(record.heightCm ?? ""),
  })
  return parsed.ok ? parsed.value : null
}

export async function saveIntake(uid: string, email: string | null, intake: Intake) {
  const ref = doc(db(), "users", uid)
  const existing = await getDoc(ref)
  await setDoc(
    ref,
    {
      ...(email ? { email } : {}),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
      questionnaire: {
        age: intake.age,
        sex: intake.sex,
        weightKg: intake.weightKg,
        heightCm: intake.heightCm,
        updatedAt: serverTimestamp(),
      },
    },
    { merge: true },
  )
}

function textField(value: unknown) {
  return typeof value === "string" ? value : ""
}

export async function loadStory(uid: string): Promise<Story> {
  const snap = await getDoc(doc(db(), "users", uid))
  const data = snap.data()?.history
  if (!data || typeof data !== "object") {
    return { complaints: "", diseaseHistory: "", lifeHistory: "" }
  }
  const record = data as Record<string, unknown>
  return {
    complaints: textField(record.complaints),
    diseaseHistory: textField(record.diseaseHistory),
    lifeHistory: textField(record.lifeHistory),
  }
}

export async function saveStory(uid: string, email: string | null, story: Story) {
  const ref = doc(db(), "users", uid)
  const existing = await getDoc(ref)
  await setDoc(
    ref,
    {
      ...(email ? { email } : {}),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
      history: {
        complaints: story.complaints.trim(),
        diseaseHistory: story.diseaseHistory.trim(),
        lifeHistory: story.lifeHistory.trim(),
        updatedAt: serverTimestamp(),
      },
    },
    { merge: true },
  )
}

export async function saveTestRequest(
  uid: string,
  request: {
    tests: { name: string; priceKzt: number }[]
    totalKzt: number
    phone: string
    encounterId?: string
  },
) {
  await addDoc(collection(db(), "users", uid, "requests"), {
    tests: request.tests,
    totalKzt: request.totalKzt,
    phone: request.phone,
    ...(request.encounterId ? { encounterId: request.encounterId } : {}),
    createdAt: serverTimestamp(),
  })
}

export async function saveCheckupRequest(
  uid: string,
  encounter: Omit<Encounter, "id" | "createdAt">,
  request: {
    tests: { name: string; priceKzt: number }[]
    totalKzt: number
    phone: string
  },
) {
  const database = db()
  const encounterRef = doc(collection(database, "users", uid, "encounters"))
  const requestRef = doc(collection(database, "users", uid, "requests"))
  const batch = writeBatch(database)
  batch.set(encounterRef, {
    ...encounter,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(requestRef, {
    ...request,
    encounterId: encounterRef.id,
    createdAt: serverTimestamp(),
  })
  await batch.commit()
  return encounterRef.id
}

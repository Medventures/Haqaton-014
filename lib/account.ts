import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore"
import { publishClinicRequest, upsertClinicPatient } from "@/lib/clinic"
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
      role: "patient",
      ...(email ? { email } : {}),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  )
  await upsertClinicPatient({ uid, email })
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
  await upsertClinicPatient({
    uid,
    email,
    age: intake.age,
    sex: intake.sex,
    weightKg: intake.weightKg,
    heightCm: intake.heightCm,
  })
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
  const userSnap = await getDoc(doc(database, "users", uid))
  const data = userSnap.data() ?? {}
  const questionnaire = data.questionnaire && typeof data.questionnaire === "object"
    ? (data.questionnaire as Record<string, unknown>)
    : {}
  const history = data.history && typeof data.history === "object"
    ? (data.history as Record<string, unknown>)
    : {}
  await publishClinicRequest({
    patientUid: uid,
    email: typeof data.email === "string" ? data.email : null,
    phone: request.phone,
    encounterId: encounterRef.id,
    tests: request.tests,
    totalKzt: request.totalKzt,
    complaints: encounter.complaints || textField(history.complaints),
    anamnesis: [textField(history.diseaseHistory), textField(history.lifeHistory)]
      .filter(Boolean)
      .join("\n\n"),
    age: typeof questionnaire.age === "number" ? questionnaire.age : undefined,
    sex: typeof questionnaire.sex === "string" ? questionnaire.sex : undefined,
    weightKg: typeof questionnaire.weightKg === "number" ? questionnaire.weightKg : undefined,
    heightCm: typeof questionnaire.heightCm === "number" ? questionnaire.heightCm : undefined,
  })
  return encounterRef.id
}

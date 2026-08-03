import type { CourseEntry, Plan } from "@/types"

export function codeOf(entry: CourseEntry | undefined) {
  return typeof entry === "string" ? entry : entry?.code ?? ""
}

export function clonePlan(plan: Plan): Plan {
  return structuredClone(plan)
}

export function updatePlan(plan: Plan, recipe: (draft: Plan) => void): Plan {
  const draft = clonePlan(plan)
  recipe(draft)
  return draft
}

export function makeSemester(): Plan["semesters"][number] {
  return { id: `published-${crypto.randomUUID()}`, courses: [] }
}

export function makeElective(): Plan["electiveGroups"][number] {
  return {
    id: `elective-group-${crypto.randomUUID()}`,
    name: "مجموعة اختيارية جديدة",
    requiredHours: 3,
    courses: [],
  }
}

export function occurrenceId(plan: Plan, semesterId: string, code: string) {
  const slug = code.trim().toLocaleLowerCase("ar").replace(/\s+/gu, "-")
  return `major:${plan.id}:${semesterId}:${slug}`
}

export function electiveOccurrenceId(plan: Plan, groupId: string, code: string) {
  const slug = code.trim().toLocaleLowerCase("ar").replace(/\s+/gu, "-")
  return `major:${plan.id}:elective:${groupId}:${slug}`
}

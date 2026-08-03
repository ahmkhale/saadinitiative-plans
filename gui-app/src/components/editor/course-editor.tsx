import { useMemo, useState } from "react"
import {
  IconBook2,
  IconChevronDown,
  IconTrash,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { codeOf } from "@/lib/plan"
import type { CourseEntry, CourseFacts } from "@/types"
import { classifyRequirementCourses } from "../../../../src/domain/course-requirements.mjs"
import { normalizedEntry, parseCodes } from "../../../../gui/plan-model.mjs"

type CourseEditorProps = {
  entry: CourseEntry
  resolved?: CourseFacts
  fallback?: CourseFacts
  sameSemesterCourses: CourseEntry[]
  location: string
  onEntryChange: (entry: CourseEntry) => void
  onFallbackChange: (facts: CourseFacts) => void
  onDelete: () => void
}

function requirementText(entry: CourseEntry) {
  if (typeof entry === "string") return ""
  const forced = new Set(entry.forcedCorequisites ?? [])
  return [
    ...(entry.prerequisites ?? []),
    ...(entry.corequisites ?? []).map((code) => forced.has(code) ? `# ${code}` : code),
    ...(entry.prerequisiteAlternatives ?? []).map((codes) => codes.join(" ^ ")),
  ].join("، ")
}

export function CourseEditor({
  entry,
  resolved,
  fallback,
  sameSemesterCourses,
  location,
  onEntryChange,
  onFallbackChange,
  onDelete,
}: CourseEditorProps) {
  const unresolved = resolved?.source === "unresolved" || resolved?.found === false
  const [open, setOpen] = useState(unresolved)
  const code = codeOf(entry)
  const facts = fallback ?? {}
  const requirements = useMemo(() => requirementText(entry), [entry])
  const [requirementsDraft, setRequirementsDraft] = useState(requirements)
  const [conditionsDraft, setConditionsDraft] = useState(() => (
    typeof entry === "string" ? "" : (entry.prerequisiteConditions ?? []).join("، ")
  ))

  const updateRule = (key: string, value: string) => {
    const next = normalizedEntry(entry)
    if (key === "requirements") {
      const classified = classifyRequirementCourses(parseCodes(value), sameSemesterCourses)
      for (const rule of ["prerequisites", "corequisites", "forcedCorequisites", "prerequisiteAlternatives"] as const) {
        if (classified[rule].length) next[rule] = classified[rule]
        else delete next[rule]
      }
    } else if (key === "minimumCompletedCredits") {
      if (value === "") delete next.minimumCompletedCredits
      else next.minimumCompletedCredits = Number(value)
    } else {
      const values = parseCodes(value)
      if (values.length) next[key] = values
      else delete next[key]
    }
    onEntryChange(Object.keys(next).length === 1 ? next.code : next)
  }

  const updateFact = (key: keyof CourseFacts, value: string, numeric = false) => {
    const next = { ...facts }
    const edited = new Set(next.manuallyEditedFields ?? [])
    if (value === "") {
      delete next[key]
      edited.delete(key)
    } else {
      ;(next as Record<string, unknown>)[key] = numeric ? Number(value) : value
      edited.add(key)
    }
    next.source = edited.size ? "manual" : next.source ?? "catalog"
    next.manuallyEditedFields = [...edited]
    onFallbackChange(next)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg bg-muted/45 ring-1 ring-foreground/10" data-location={location}>
        <div className="flex items-center gap-3 p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-foreground/10">
            <IconBook2 />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-heading text-sm font-semibold" dir="ltr">{resolved?.code ?? code}</p>
              {unresolved ? <Badge variant="destructive">غير محلول</Badge> : null}
              {resolved?.catalogSource ? <Badge variant="outline">{resolved.catalogSource === "male" ? "الدليل" : "دليل الطالبات"}</Badge> : null}
              {facts.manuallyEditedFields?.length ? <Badge variant="secondary">بيانات يدوية</Badge> : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {resolved?.name ?? facts.name ?? "مقرر غير موجود في الدليل"}
            </p>
          </div>
          <div className="hidden text-xs text-muted-foreground md:block">
            {resolved?.academicHours ?? facts.academicHours ?? "—"} ساعات
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="حذف المقرر" onClick={onDelete}>
            <IconTrash />
          </Button>
          <CollapsibleTrigger render={<Button variant="ghost" size="icon-sm" aria-label="حقائق المقرر الاحتياطية" />}>
            <IconChevronDown className="transition-transform group-data-panel-open:rotate-180" />
          </CollapsibleTrigger>
        </div>
        <FieldGroup className="grid gap-2 px-3 pb-3 md:grid-cols-[minmax(12rem,2fr)_minmax(9rem,1fr)_7rem]">
          <Field>
            <FieldLabel className="text-xs">المتطلبات <span className="font-normal text-muted-foreground"># مرافق · ^ بدائل</span></FieldLabel>
            <Input
              value={requirementsDraft}
              placeholder="101 عال، # 102 عال، 201 عال ^ 202 عال"
              onChange={(event) => {
                setRequirementsDraft(event.target.value)
                updateRule("requirements", event.target.value)
              }}
            />
            <FieldDescription className="sr-only">المقرر في المستوى نفسه يصبح مرافقًا تلقائيًا.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel className="text-xs">شرط نصي</FieldLabel>
            <Input
              value={conditionsDraft}
              placeholder="اجتياز المستوى السادس"
              onChange={(event) => {
                setConditionsDraft(event.target.value)
                updateRule("prerequisiteConditions", event.target.value)
              }}
            />
          </Field>
          <Field>
            <FieldLabel className="text-xs">ساعات مجتازة</FieldLabel>
            <Input
              type="number"
              min={0}
              value={typeof entry === "string" ? "" : entry.minimumCompletedCredits ?? ""}
              onChange={(event) => updateRule("minimumCompletedCredits", event.target.value)}
            />
          </Field>
        </FieldGroup>
        <CollapsibleContent>
          <Separator />
          <div className="p-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">حقائق المقرر الاحتياطية</p>
              <FieldGroup>
                <Field data-invalid={unresolved && !facts.name || undefined}>
                  <FieldLabel>اسم المقرر</FieldLabel>
                  <Input
                    aria-invalid={unresolved && !facts.name || undefined}
                    value={facts.name ?? ""}
                    onChange={(event) => updateFact("name", event.target.value)}
                  />
                </Field>
              </FieldGroup>
              <FieldGroup className="grid grid-cols-4 gap-2">
                {([
                  ["academicHours", "الساعات"],
                  ["lectureHours", "محاضرة"],
                  ["practicalHours", "العملي"],
                  ["exerciseHours", "التمارين"],
                ] as const).map(([key, label]) => (
                  <Field key={key}>
                    <FieldLabel className="truncate text-xs">{label}</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      value={facts[key] ?? ""}
                      onChange={(event) => updateFact(key, event.target.value, true)}
                    />
                  </Field>
                ))}
              </FieldGroup>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

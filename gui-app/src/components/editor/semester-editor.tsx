import { useState } from "react"
import {
  IconArrowDown,
  IconArrowUp,
  IconBooks,
  IconChevronDown,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react"

import { CourseAdder } from "@/components/editor/course-adder"
import { CourseEditor } from "@/components/editor/course-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import type { PlanWorkspace } from "@/hooks/use-plan-workspace"
import { codeOf, makeSemester, occurrenceId } from "@/lib/plan"
import type { CourseEntry } from "@/types"
import { compareCourseEntries, semesterLabel } from "../../../../gui/plan-model.mjs"

export function SemesterEditor({ workspace }: { workspace: PlanWorkspace }) {
  const [collapsedSemesterIds, setCollapsedSemesterIds] = useState<Set<string>>(() => new Set())
  const { plan, parentPlan, data, preview } = workspace
  if (!plan || !data) return null

  const inheritedSourceIds = Array.from(new Set([
    ...(parentPlan?.sharedSemesterSets ?? []),
    ...(plan.sharedSemesterSets ?? []),
  ]))
  const inheritedSources = inheritedSourceIds
    .map((id) => data.sharedSemesterSets.find((source) => source.id === id))
    .filter(Boolean)
  const inheritedSemesters = [
    ...inheritedSources.flatMap((source) => source?.semesters ?? []),
    ...(parentPlan?.semesters ?? []),
  ]
  const inheritedCount = inheritedSemesters.length

  return (
    <div className="flex flex-col gap-5">
      {inheritedSemesters.length ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <p className="text-xs font-medium text-muted-foreground">المستويات الموروثة</p>
            <Badge variant="outline">{inheritedSemesters.length}</Badge>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {inheritedSemesters.map((semester, index) => {
              const source = inheritedSources.find((item) => item?.semesters.includes(semester))
              return (
                <Card key={semester.id} size="sm" className="border-dashed">
                  <CardHeader>
                    <CardTitle>{semesterLabel(index + 1)}</CardTitle>
                    <CardDescription>{source ? `مشترك من ${source.name}` : `موروث من خطة ${parentPlan?.major ?? "الخطة الأساسية"}`}</CardDescription>
                    <CardAction><Badge variant="secondary">للقراءة فقط</Badge></CardAction>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs leading-6 text-muted-foreground" dir="ltr">
                      {semester.courses.map(codeOf).join(" · ") || "لا توجد مقررات"}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      ) : null}

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-primary">المستويات الخاصة بالخطة</p>
          <h2 className="font-heading text-lg font-semibold">تسلسل الخطة المنشورة</h2>
          <p className="text-sm text-muted-foreground">تُرتب المقررات تلقائيًا بحسب الرقم ثم الرمز.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!plan.semesters.length}
            onClick={() => setCollapsedSemesterIds(new Set())}
          >
            <IconChevronDown data-icon="inline-start" />
            توسيع الكل
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!plan.semesters.length}
            onClick={() => setCollapsedSemesterIds(new Set(plan.semesters.map((semester) => semester.id)))}
          >
            <IconArrowUp data-icon="inline-start" />
            طي الكل
          </Button>
          <Button onClick={() => workspace.editPlan((draft) => { draft.semesters.push(makeSemester()) })}>
            <IconPlus data-icon="inline-start" />
            إضافة مستوى
          </Button>
        </div>
      </div>

      {!plan.semesters.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><IconBooks /></EmptyMedia>
            <EmptyTitle>لا توجد مستويات خاصة</EmptyTitle>
            <EmptyDescription>أضف أول مستوى، أو اكتفِ بالمستويات المشتركة الموروثة.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {plan.semesters.map((semester, index) => {
            const resolvedSemester = preview?.plan.semesters.find((item) => item.id === semester.id)
              ?? preview?.plan.semesters[inheritedCount + index]
            return (
              <SemesterCard
                key={semester.id}
                index={index}
                inheritedCount={inheritedCount}
                workspace={workspace}
                resolvedCourses={resolvedSemester?.courses ?? []}
                open={!collapsedSemesterIds.has(semester.id)}
                onOpenChange={(open) => setCollapsedSemesterIds((current) => {
                  const next = new Set(current)
                  if (open) next.delete(semester.id)
                  else next.add(semester.id)
                  return next
                })}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function SemesterCard({
  index,
  inheritedCount,
  workspace,
  resolvedCourses,
  open,
  onOpenChange,
}: {
  index: number
  inheritedCount: number
  workspace: PlanWorkspace
  resolvedCourses: CourseEntry[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const plan = workspace.plan!
  const semester = plan.semesters[index]
  const hours = (resolvedCourses as Array<Record<string, unknown>>).reduce((total, course) => (
    total + (Number(course.academicHours) || 0)
  ), 0)

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card data-location={`semester-${index + 1}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {semesterLabel(inheritedCount + index + 1)}
            <Badge variant="outline">{semester.courses.length} مقررات</Badge>
            {hours ? <Badge variant="secondary">{hours} ساعة</Badge> : null}
          </CardTitle>
          <CardDescription dir="ltr">{semester.id}</CardDescription>
          <CardAction>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="نقل المستوى إلى أعلى"
                disabled={index === 0}
                onClick={() => workspace.editPlan((draft) => {
                  ;[draft.semesters[index - 1], draft.semesters[index]] = [draft.semesters[index], draft.semesters[index - 1]]
                })}
              >
                <IconArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="نقل المستوى إلى أسفل"
                disabled={index === plan.semesters.length - 1}
                onClick={() => workspace.editPlan((draft) => {
                  ;[draft.semesters[index + 1], draft.semesters[index]] = [draft.semesters[index], draft.semesters[index + 1]]
                })}
              >
                <IconArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="حذف المستوى"
                onClick={() => {
                  if (semester.courses.length && !window.confirm("يحتوي المستوى على مقررات. هل تريد حذفه؟")) return
                  workspace.editPlan((draft) => { draft.semesters.splice(index, 1) })
                }}
              >
                <IconTrash />
              </Button>
              <CollapsibleTrigger render={<Button variant="ghost" size="icon-sm" aria-label="فتح المستوى" />}>
                <IconChevronDown className="transition-transform group-data-panel-open:rotate-180" />
              </CollapsibleTrigger>
            </div>
          </CardAction>
        </CardHeader>
        <CollapsibleContent>
          <Separator />
          <CardContent className="flex flex-col gap-3 pt-4">
            <CourseAdder
              onSearch={workspace.searchCourses}
              onAdd={(codes) => workspace.editPlan((draft) => {
                const target = draft.semesters[index]
                const existing = new Set(target.courses.map((entry) => codeOf(entry).replace(/\s+/gu, " ").toLocaleLowerCase("ar")))
                for (const code of codes) {
                  const normalized = code.replace(/\s+/gu, " ").trim()
                  if (existing.has(normalized.toLocaleLowerCase("ar"))) continue
                  target.courses.push({ id: occurrenceId(draft, target.id, normalized), code: normalized })
                  existing.add(normalized.toLocaleLowerCase("ar"))
                }
                target.courses.sort(compareCourseEntries)
              })}
            />
            {semester.courses.map((entry, courseIndex) => {
              const code = codeOf(entry)
              const resolved = resolvedCourses.find((item) => codeOf(item) === code) as unknown as Record<string, unknown> | undefined
              return (
                <CourseEditor
                  key={(typeof entry === "object" && entry.id) || `${code}-${courseIndex}`}
                  entry={entry}
                  resolved={resolved}
                  fallback={plan.fallbackCourses[code]}
                  sameSemesterCourses={semester.courses}
                  location={`semester-${index + 1}`}
                  onEntryChange={(next) => workspace.editPlan((draft) => { draft.semesters[index].courses[courseIndex] = next })}
                  onFallbackChange={(facts) => workspace.editPlan((draft) => { draft.fallbackCourses[code] = facts })}
                  onDelete={() => workspace.editPlan((draft) => {
                    draft.semesters[index].courses.splice(courseIndex, 1)
                    const stillUsed = draft.semesters.some((item) => item.courses.some((course) => codeOf(course) === code))
                      || draft.electiveGroups.some((group) => group.courses?.some((course) => codeOf(course) === code))
                    if (!stillUsed) delete draft.fallbackCourses[code]
                  })}
                />
              )
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

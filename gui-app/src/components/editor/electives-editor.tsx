import { useState } from "react"
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconListCheck,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react"

import { CourseAdder } from "@/components/editor/course-adder"
import { CourseEditor } from "@/components/editor/course-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"
import type { PlanWorkspace } from "@/hooks/use-plan-workspace"
import { codeOf, electiveOccurrenceId, makeElective } from "@/lib/plan"
import type { ElectiveGroup } from "@/types"
import { compareCourseEntries, sourceAppliesToSelection } from "../../../../gui/plan-model.mjs"

export function ElectivesEditor({ workspace }: { workspace: PlanWorkspace }) {
  const [sharedSourceId, setSharedSourceId] = useState("")
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set())
  const { plan, data } = workspace
  if (!plan || !data) return null

  const inheritedGroups = workspace.parentPlan?.electiveGroups ?? []
  const availableSources = data.sharedElectiveGroups.filter((source) => (
    sourceAppliesToSelection(source, workspace.selection)
    && !plan.electiveGroups.some((group) => group.sourceId === source.id)
  ))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-primary">متطلبات الإتمام</p>
          <h2 className="font-heading text-lg font-semibold">المجموعات الاختيارية</h2>
          <p className="text-sm text-muted-foreground">اربط مصدرًا مشتركًا أو أنشئ مجموعة يملكها هذا التخصص.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setCollapsedGroupIds(new Set())}>
            <IconChevronDown data-icon="inline-start" />
            توسيع الكل
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCollapsedGroupIds(new Set(plan.electiveGroups.map((group, index) => group.id ?? `group-${index}`)))}>
            <IconArrowUp data-icon="inline-start" />
            طي الكل
          </Button>
          <Button onClick={() => workspace.editPlan((draft) => { draft.electiveGroups.push(makeElective()) })}>
            <IconPlus data-icon="inline-start" />
            مجموعة مخصصة
          </Button>
        </div>
      </div>

      {availableSources.length ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>ربط مصدر اختياري مشترك</CardTitle>
            <CardDescription>يبقى المصدر مركزيًا، وتُعرض هنا نتيجته بعد استبعاد مقررات الخطة.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <Field className="min-w-0 flex-1">
                <FieldLabel htmlFor="shared-elective-source">المصدر</FieldLabel>
                <NativeSelect id="shared-elective-source" value={sharedSourceId} onChange={(event) => setSharedSourceId(event.target.value)}>
                  <NativeSelectOption value="">اختر مصدرًا…</NativeSelectOption>
                  {availableSources.map((source) => (
                    <NativeSelectOption key={source.id} value={source.id}>{source.name}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Button
                variant="outline"
                disabled={!sharedSourceId}
                onClick={() => {
                  workspace.editPlan((draft) => { draft.electiveGroups.push({ sourceId: sharedSourceId }) })
                  setSharedSourceId("")
                }}
              >
                <IconPlus data-icon="inline-start" />
                ربط
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {inheritedGroups.length ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {inheritedGroups.map((group, index) => (
            <Card key={group.sourceId ?? group.id ?? index} size="sm" className="border-dashed">
              <CardHeader>
                <CardTitle>{group.name ?? group.sourceId}</CardTitle>
                <CardDescription>موروثة من الخطة الأساسية</CardDescription>
                <CardAction><Badge variant="secondary">للقراءة فقط</Badge></CardAction>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      {!plan.electiveGroups.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><IconListCheck /></EmptyMedia>
            <EmptyTitle>لا توجد متطلبات اختيارية</EmptyTitle>
            <EmptyDescription>أضف مجموعة مخصصة أو اربط مصدرًا مشتركًا من الأعلى.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {plan.electiveGroups.map((group, index) => group.sourceId
            ? <SharedElectiveCard key={`shared-${group.sourceId}`} workspace={workspace} group={group} index={index} />
            : <CustomElectiveCard
                key={group.id ?? index}
                workspace={workspace}
                group={group}
                index={index}
                open={!collapsedGroupIds.has(group.id ?? `group-${index}`)}
                onOpenChange={(open) => setCollapsedGroupIds((current) => {
                  const next = new Set(current)
                  const id = group.id ?? `group-${index}`
                  if (open) next.delete(id)
                  else next.add(id)
                  return next
                })}
              />)}
        </div>
      )}
    </div>
  )
}

function SharedElectiveCard({ workspace, group, index }: { workspace: PlanWorkspace; group: ElectiveGroup; index: number }) {
  const source = workspace.data?.sharedElectiveGroups.find((item) => item.id === group.sourceId)
  const resolved = workspace.preview?.plan.electiveGroups.find((item) => item.sourceId === group.sourceId)
  return (
    <Card data-location={`elective-${group.sourceId}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {source?.name ?? group.sourceId}
          <Badge variant="secondary">مشترك</Badge>
        </CardTitle>
        <CardDescription>
          المتطلب الأصلي {source?.requiredHours ?? "—"} ساعات · المتبقي {resolved?.requiredHours ?? source?.requiredHours ?? "—"} ساعات
        </CardDescription>
        <CardAction><GroupActions workspace={workspace} index={index} /></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>المستبعدة لوجودها في الخطة: {resolved?.excludedCourses?.map((course) => course.code).join("، ") || "لا يوجد"}</p>
        <p dir="ltr">{resolved?.courses?.map(codeOf).join(" · ") || source?.courses.map(codeOf).join(" · ")}</p>
      </CardContent>
    </Card>
  )
}

function CustomElectiveCard({ workspace, group, index, open, onOpenChange }: { workspace: PlanWorkspace; group: ElectiveGroup; index: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const plan = workspace.plan!
  const resolvedGroup = workspace.preview?.plan.electiveGroups.find((item) => item.id === group.id)
  const mode = group.requirementText === undefined ? "hours" : "text"
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card data-location={`elective-${group.id ?? index + 1}`}>
      <CardHeader>
        <CardTitle>{group.name || "مجموعة اختيارية"}</CardTitle>
        <CardDescription>{group.courses?.length ?? 0} مقررات مرشحة</CardDescription>
        <CardAction>
          <div className="flex items-center gap-1">
            <GroupActions workspace={workspace} index={index} />
            <CollapsibleTrigger render={<Button variant="ghost" size="icon-sm" aria-label="فتح المجموعة" />}>
              <IconChevronDown className="transition-transform group-data-panel-open:rotate-180" />
            </CollapsibleTrigger>
          </div>
        </CardAction>
      </CardHeader>
      <CollapsibleContent>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup className="grid gap-3 md:grid-cols-3">
          <Field>
            <FieldLabel>اسم المجموعة</FieldLabel>
            <Input value={group.name ?? ""} onChange={(event) => workspace.editPlan((draft) => { draft.electiveGroups[index].name = event.target.value })} />
          </Field>
          <Field>
            <FieldLabel>نوع المتطلب</FieldLabel>
            <NativeSelect
              value={mode}
              onChange={(event) => workspace.editPlan((draft) => {
                const target = draft.electiveGroups[index]
                if (event.target.value === "hours") {
                  delete target.requirementText
                  target.requiredHours ??= 3
                } else {
                  target.requirementText = "اختيار مقرر واحد"
                  delete target.requiredHours
                }
              })}
            >
              <NativeSelectOption value="hours">عدد ساعات</NativeSelectOption>
              <NativeSelectOption value="text">نص مخصص</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel>{mode === "hours" ? "الساعات المطلوبة" : "نص المتطلب"}</FieldLabel>
            <Input
              type={mode === "hours" ? "number" : "text"}
              min={mode === "hours" ? 0 : undefined}
              value={mode === "hours" ? group.requiredHours ?? 0 : group.requirementText ?? ""}
              onChange={(event) => workspace.editPlan((draft) => {
                if (mode === "hours") draft.electiveGroups[index].requiredHours = Number(event.target.value)
                else draft.electiveGroups[index].requirementText = event.target.value
              })}
            />
          </Field>
        </FieldGroup>
        <Separator />
        <div className="flex flex-col gap-3">
          <CourseAdder
            onSearch={workspace.searchCourses}
            onAdd={(codes) => workspace.editPlan((draft) => {
              const target = draft.electiveGroups[index]
              target.courses ??= []
              const existing = new Set(target.courses.map((entry) => codeOf(entry).toLocaleLowerCase("ar")))
              for (const code of codes) {
                const normalized = code.replace(/\s+/gu, " ").trim()
                if (existing.has(normalized.toLocaleLowerCase("ar"))) continue
                target.courses.push({ id: electiveOccurrenceId(draft, target.id!, normalized), code: normalized })
              }
              target.courses.sort(compareCourseEntries)
            })}
          />
          {(group.courses ?? []).map((entry, courseIndex) => {
            const code = codeOf(entry)
            const resolved = resolvedGroup?.courses?.find((item) => codeOf(item) === code) as unknown as Record<string, unknown> | undefined
            return (
              <CourseEditor
                key={(typeof entry === "object" && entry.id) || `${code}-${courseIndex}`}
                entry={entry}
                resolved={resolved}
                fallback={plan.fallbackCourses[code]}
                sameSemesterCourses={[]}
                location={`elective-${group.id ?? index + 1}`}
                onEntryChange={(next) => workspace.editPlan((draft) => { draft.electiveGroups[index].courses![courseIndex] = next })}
                onFallbackChange={(facts) => workspace.editPlan((draft) => { draft.fallbackCourses[code] = facts })}
                onDelete={() => workspace.editPlan((draft) => { draft.electiveGroups[index].courses!.splice(courseIndex, 1) })}
              />
            )
          })}
        </div>
      </CardContent>
      </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function GroupActions({ workspace, index }: { workspace: PlanWorkspace; index: number }) {
  const count = workspace.plan!.electiveGroups.length
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" aria-label="نقل إلى أعلى" disabled={index === 0} onClick={() => workspace.editPlan((draft) => {
        ;[draft.electiveGroups[index - 1], draft.electiveGroups[index]] = [draft.electiveGroups[index], draft.electiveGroups[index - 1]]
      })}><IconArrowUp /></Button>
      <Button variant="ghost" size="icon-sm" aria-label="نقل إلى أسفل" disabled={index === count - 1} onClick={() => workspace.editPlan((draft) => {
        ;[draft.electiveGroups[index + 1], draft.electiveGroups[index]] = [draft.electiveGroups[index], draft.electiveGroups[index + 1]]
      })}><IconArrowDown /></Button>
      <Button variant="ghost" size="icon-sm" aria-label="حذف المجموعة" onClick={() => workspace.editPlan((draft) => { draft.electiveGroups.splice(index, 1) })}><IconTrash /></Button>
    </div>
  )
}

import { useMemo, useState } from "react"
import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconChevronDown,
  IconHome,
  IconPlus,
  IconRefresh,
  IconSun,
  IconTrash,
} from "@tabler/icons-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import type { PlanWorkspace } from "@/hooks/use-plan-workspace"
import { codeOf } from "@/lib/plan"
import type { CourseEntry, ProposalSemester } from "@/types"
import {
  buildPublishedDecisionSemesters,
  composeParentTrackPlan,
  entryId,
  reconcileProposalDraft,
  semesterLabel,
} from "../../../../gui/plan-model.mjs"
import {
  createElectivePlaceholder,
  createProposalFromPublished,
  createProposalSemester,
  moveProposalCourse,
  proposalElectiveOptions,
  resetProposalToPublished,
} from "../../../../gui/proposal-actions.mjs"

export function ProposalEditor({ workspace }: { workspace: PlanWorkspace }) {
  const [collapsedSemesterIds, setCollapsedSemesterIds] = useState<Set<string>>(() => new Set())
  const { plan, data, parentPlan } = workspace
  const sourcePlan = useMemo(() => plan ? composeParentTrackPlan(parentPlan, plan) : null, [parentPlan, plan])
  const published = useMemo(() => sourcePlan && data
    ? buildPublishedDecisionSemesters(sourcePlan, data.sharedSemesterSets)
    : [], [data, sourcePlan])

  if (!plan || !data) return null
  const enabled = Boolean(plan.proposal)

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>الخطة المقترحة</CardTitle>
          <CardDescription>إعادة توزيع مرجعية لمقررات الخطة المنشورة؛ لا تغيّر الخطة الأصلية.</CardDescription>
          <CardAction>
            <Field orientation="horizontal" className="w-auto">
              <FieldLabel htmlFor="proposal-enabled">{enabled ? "مفعّلة" : "متوقفة"}</FieldLabel>
              <Switch
                id="proposal-enabled"
                checked={enabled}
                onCheckedChange={(checked) => workspace.editPlan((draft) => {
                  draft.proposal = checked ? createProposalFromPublished(published) : null
                })}
              />
            </Field>
          </CardAction>
        </CardHeader>
      </Card>

      {!enabled ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><IconRefresh /></EmptyMedia>
            <EmptyTitle>الخطة المقترحة غير مفعّلة</EmptyTitle>
            <EmptyDescription>فعّلها لإنشاء توزيع أولي مطابق للخطة المنشورة، ثم انقل المقررات بين المستويات.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Alert>
            <IconRefresh />
            <AlertTitle>مرجع آمن للخطة المنشورة</AlertTitle>
            <AlertDescription>كل مقرر يشير إلى معرّف ظهوره المنشور. النقل هنا لا يحذف المقرر ولا يغيّر حقائقه.</AlertDescription>
          </Alert>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => workspace.editPlan((draft) => {
                reconcileProposalDraft(draft, data.sharedSemesterSets)
              })}>
                <IconRefresh data-icon="inline-start" />
                مزامنة المنشور
              </Button>
              <Button variant="outline" onClick={() => {
                if (!window.confirm("ستعود المقررات إلى مستوياتها المنشورة. هل تريد المتابعة؟")) return
                workspace.editPlan((draft) => {
                  if (draft.proposal) draft.proposal.semesters = resetProposalToPublished(draft.proposal, published)
                })
              }}>
                <IconHome data-icon="inline-start" />
                إعادة الضبط
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCollapsedSemesterIds(new Set())}>
                <IconChevronDown data-icon="inline-start" />
                توسيع الكل
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCollapsedSemesterIds(new Set(plan.proposal!.semesters.map((semester) => semester.id)))}>
                <IconArrowUp data-icon="inline-start" />
                طي الكل
              </Button>
              <Button variant="outline" onClick={() => workspace.editPlan((draft) => { draft.proposal?.semesters.push(createProposalSemester("summer") as ProposalSemester) })}>
                <IconSun data-icon="inline-start" />
                فصل صيفي
              </Button>
              <Button onClick={() => workspace.editPlan((draft) => { draft.proposal?.semesters.push(createProposalSemester("regular") as ProposalSemester) })}>
                <IconPlus data-icon="inline-start" />
                مستوى منتظم
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {plan.proposal!.semesters.map((semester, index) => (
              <ProposalSemesterCard
                key={semester.id}
                semester={semester}
                index={index}
                workspace={workspace}
                published={published}
                open={!collapsedSemesterIds.has(semester.id)}
                onOpenChange={(open) => setCollapsedSemesterIds((current) => {
                  const next = new Set(current)
                  if (open) next.delete(semester.id)
                  else next.add(semester.id)
                  return next
                })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ProposalSemesterCard({
  semester,
  index,
  workspace,
  published,
  open,
  onOpenChange,
}: {
  semester: ProposalSemester
  index: number
  workspace: PlanWorkspace
  published: Array<{ id: string; courses: CourseEntry[] }>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [electiveId, setElectiveId] = useState("")
  const plan = workspace.plan!
  const proposal = plan.proposal!
  const regularNumber = proposal.semesters.slice(0, index + 1).filter((item) => item.type !== "summer").length
  const summerNumber = proposal.semesters.slice(0, index + 1).filter((item) => item.type === "summer").length
  const title = semester.type === "summer"
    ? summerNumber === 1 ? "الفصل الصيفي" : `الفصل الصيفي ${summerNumber}`
    : semesterLabel(regularNumber)
  const entries = new Map(published.flatMap((item) => item.courses.map((entry) => [entryId(entry), entry])))
  const resolvedEntries = new Map((workspace.preview?.plan.semesters ?? []).flatMap((item) => (
    item.courses.map((entry) => [entryId(entry), entry])
  )))
  const options = proposalElectiveOptions(workspace.preview?.plan.electiveGroups ?? [], proposal) as Array<{
    id: string
    name: string
    remainingHours: number
    allocationHours: number
    hasVariableCourseHours: boolean
  }>

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
    <Card data-location={`proposal-semester-${index + 1}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {semester.type === "summer" ? <Badge variant="secondary">صيفي</Badge> : null}
          <Badge variant="outline">{semester.courseOrder.length + semester.placeholders.length} عناصر</Badge>
        </CardTitle>
        <CardDescription>{semester.sourceSemesterId ? "مستوى مرتبط بالخطة المنشورة" : "مستوى إضافي"}</CardDescription>
        <CardAction className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="حذف المستوى"
            disabled={Boolean(semester.courseOrder.length || semester.placeholders.length)}
            onClick={() => workspace.editPlan((draft) => { draft.proposal?.semesters.splice(index, 1) })}
          >
            <IconTrash />
          </Button>
          <CollapsibleTrigger render={<Button variant="ghost" size="icon-sm" aria-label="فتح المستوى" />}>
            <IconChevronDown className="transition-transform group-data-panel-open:rotate-180" />
          </CollapsibleTrigger>
        </CardAction>
      </CardHeader>
      <CollapsibleContent>
      <CardContent className="flex flex-col gap-3">
        {semester.courseOrder.map((courseId) => {
          const entry = entries.get(courseId)
          const resolved = resolvedEntries.get(courseId)
          return (
            <div key={courseId} className="flex items-center gap-3 rounded-lg bg-muted/45 p-3 ring-1 ring-foreground/10">
              <div className="min-w-0 flex-1">
                <p className="font-medium" dir="ltr">{codeOf(entry)}</p>
                <p className="truncate text-sm text-muted-foreground">{typeof resolved === "object" ? resolved.name ?? "مقرر منشور" : "مقرر منشور"}</p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="المستوى السابق" disabled={index === 0} onClick={() => workspace.editPlan((draft) => {
                if (!draft.proposal) return
                moveProposalCourse({ proposal: draft.proposal, publishedSemesters: published, fromIndex: index, courseId, action: "previous" })
              })}><IconArrowRight /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="إعادة للمستوى المنشور" onClick={() => workspace.editPlan((draft) => {
                if (!draft.proposal) return
                moveProposalCourse({ proposal: draft.proposal, publishedSemesters: published, fromIndex: index, courseId, action: "home" })
              })}><IconHome /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="المستوى التالي" disabled={index === proposal.semesters.length - 1} onClick={() => workspace.editPlan((draft) => {
                if (!draft.proposal) return
                moveProposalCourse({ proposal: draft.proposal, publishedSemesters: published, fromIndex: index, courseId, action: "next" })
              })}><IconArrowLeft /></Button>
            </div>
          )
        })}

        {semester.placeholders.map((placeholder, placeholderIndex) => (
          <div key={placeholder.id} className="flex items-center gap-3 rounded-lg border border-dashed p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{placeholder.name}</p>
              <p className="text-xs text-muted-foreground">{placeholder.allocationHours ?? "—"} ساعات محتسبة</p>
            </div>
            <Badge variant="secondary">مقرر نائب</Badge>
            <Button variant="ghost" size="icon-sm" aria-label="حذف المقرر النائب" onClick={() => workspace.editPlan((draft) => {
              draft.proposal?.semesters[index].placeholders.splice(placeholderIndex, 1)
            })}><IconTrash /></Button>
          </div>
        ))}

        {options.length ? (
          <>
            <Separator />
            <div className="flex items-end gap-2">
              <Field className="min-w-0 flex-1">
                <FieldLabel>إضافة مقرر نائب لمتطلب اختياري</FieldLabel>
                <NativeSelect value={electiveId} onChange={(event) => setElectiveId(event.target.value)}>
                  <NativeSelectOption value="">اختر المتطلب…</NativeSelectOption>
                  {options.map((option) => (
                    <NativeSelectOption key={option.id} value={option.id}>{option.name} · متبقي {option.remainingHours} ساعات</NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Button variant="outline" disabled={!electiveId} onClick={() => {
                const option = options.find((item) => item.id === electiveId)
                if (!option) return
                workspace.editPlan((draft) => {
                  draft.proposal?.semesters[index].placeholders.push(createElectivePlaceholder(option))
                })
                setElectiveId("")
              }}>
                <IconPlus data-icon="inline-start" />
                إضافة
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
      </CollapsibleContent>
    </Card>
    </Collapsible>
  )
}

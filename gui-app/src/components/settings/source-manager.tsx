import { useEffect, useState } from "react"
import { IconCopy, IconPlus, IconTrash } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import type { PlanWorkspace } from "@/hooks/use-plan-workspace"
import { codeOf } from "@/lib/plan"
import type { CourseEntry, SharedElectiveSource, SharedSemesterSource } from "@/types"
import { scopeFromFields, scopeTarget } from "../../../../gui/plan-model.mjs"

type SourceKind = "semester" | "elective"
type SourceDraft = (SharedSemesterSource | SharedElectiveSource) & { _originalId?: string }

function parseCodes(value: string) {
  return value.split(/[\n,،;]+/u).map((item) => item.trim()).filter(Boolean)
}

function preserveEntries(current: CourseEntry[], codes: string[], prefix: string) {
  const byCode = new Map(current.map((entry) => [codeOf(entry).toLocaleLowerCase("ar"), entry]))
  return codes.map((code) => byCode.get(code.toLocaleLowerCase("ar")) ?? {
    id: `${prefix}:${code.trim().toLocaleLowerCase("ar").replace(/\s+/gu, "-")}`,
    code,
  })
}

export function SourceManager({ workspace }: { workspace: PlanWorkspace }) {
  const [draft, setDraft] = useState<SourceDraft | null>(null)
  const [kind, setKind] = useState<SourceKind>("semester")
  const [pending, setPending] = useState(false)
  const [scopeType, setScopeType] = useState("institution")
  const [scopeValue, setScopeValue] = useState("")
  const data = workspace.data

  useEffect(() => {
    if (!draft) return
    setScopeType(String(draft.scope?.type ?? "institution"))
    setScopeValue(scopeTarget(draft.scope))
  }, [draft])

  const base = `/api/institutions/${encodeURIComponent(workspace.selection.institutionId)}`
  if (!data) return null

  const newSource = (nextKind: SourceKind) => {
    setKind(nextKind)
    if (nextKind === "semester") {
      setDraft({
        id: "",
        name: "",
        phaseLabel: "السنة المشتركة",
        semesters: [
          { id: `shared-semester-${crypto.randomUUID()}`, courses: [] },
          { id: `shared-semester-${crypto.randomUUID()}`, courses: [] },
        ],
        fallbackCourses: {},
        scope: { type: "institution", institutionId: workspace.selection.institutionId },
      })
    } else {
      setDraft({
        id: "",
        name: "",
        requiredHours: 3,
        excludePublishedCourses: true,
        courses: [],
        fallbackCourses: {},
        scope: { type: "institution", institutionId: workspace.selection.institutionId },
      })
    }
  }

  const editSource = (nextKind: SourceKind, source: SharedSemesterSource | SharedElectiveSource) => {
    setKind(nextKind)
    setDraft({ ...structuredClone(source), _originalId: source.id })
  }

  const save = async () => {
    if (!draft) return
    setPending(true)
    try {
      const originalId = draft._originalId
      const payload = structuredClone(draft) as SourceDraft
      delete payload._originalId
      payload.scope = scopeFromFields(scopeType, scopeValue, workspace.selection.institutionId)
      const path = kind === "semester" ? "shared-semester-sources" : "shared-elective-sources"
      await workspace.mutate(`${base}/${path}${originalId ? `/${encodeURIComponent(originalId)}` : ""}`, originalId ? "PUT" : "POST", payload)
      await workspace.refreshState()
      setDraft(null)
      toast.add({ title: kind === "semester" ? "حُفظ مصدر المستويات." : "حُفظ المصدر الاختياري." })
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>المصادر الأكاديمية المشتركة</CardTitle>
        <CardDescription>تُعرّف مرة واحدة ثم تُربط بالتخصصات ضمن نطاق صريح.</CardDescription>
        <CardAction>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => newSource("elective")}><IconPlus data-icon="inline-start" />مصدر اختياري</Button>
            <Button size="sm" onClick={() => newSource("semester")}><IconPlus data-icon="inline-start" />مصدر مستويات</Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <SourceList title="مصادر المستويات" kind="semester" values={data.sharedSemesterSets} onEdit={editSource} workspace={workspace} />
        <Separator />
        <SourceList title="المصادر الاختيارية" kind="elective" values={data.sharedElectiveGroups} onEdit={editSource} workspace={workspace} />
      </CardContent>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{kind === "semester" ? "مصدر مستويات مشتركة" : "مصدر اختياري مشترك"}</DialogTitle>
            <DialogDescription>تُحفظ المقررات وحقائقها الاحتياطية في ملف المصدر المالك.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="flex flex-col gap-5">
              <FieldGroup className="grid gap-3 md:grid-cols-2">
                <Field>
                  <FieldLabel>الاسم</FieldLabel>
                  <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>المعرّف الثابت</FieldLabel>
                  <Input dir="ltr" value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} />
                </Field>
                {kind === "semester" ? (
                  <Field>
                    <FieldLabel>اسم المرحلة</FieldLabel>
                    <Input value={(draft as SharedSemesterSource).phaseLabel ?? ""} onChange={(event) => setDraft({ ...draft, phaseLabel: event.target.value } as SourceDraft)} />
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel>الساعات المطلوبة</FieldLabel>
                    <Input type="number" min={0} value={(draft as SharedElectiveSource).requiredHours ?? 0} onChange={(event) => setDraft({ ...draft, requiredHours: Number(event.target.value) } as SourceDraft)} />
                  </Field>
                )}
                <Field>
                  <FieldLabel>نوع النطاق</FieldLabel>
                  <NativeSelect value={scopeType} onChange={(event) => setScopeType(event.target.value)}>
                    <NativeSelectOption value="institution">الجامعة</NativeSelectOption>
                    <NativeSelectOption value="college">كلية محددة</NativeSelectOption>
                    <NativeSelectOption value="majors">تخصصات محددة</NativeSelectOption>
                  </NativeSelect>
                </Field>
                {scopeType !== "institution" ? (
                  <Field className="md:col-span-2">
                    <FieldLabel>{scopeType === "college" ? "معرّف الكلية" : "معرّفات التخصصات"}</FieldLabel>
                    <Input dir="ltr" value={scopeValue} onChange={(event) => setScopeValue(event.target.value)} placeholder={scopeType === "majors" ? "major-a, major-b" : "engineering"} />
                  </Field>
                ) : null}
              </FieldGroup>

              <Separator />
              {kind === "semester" ? (
                <div className="flex flex-col gap-3">
                  {(draft as SharedSemesterSource).semesters.map((semester, index) => (
                    <Card key={semester.id} size="sm">
                      <CardHeader>
                        <CardTitle>المستوى {index + 1}</CardTitle>
                        <CardDescription dir="ltr">{semester.id}</CardDescription>
                        <CardAction>
                          <Button variant="ghost" size="icon-sm" aria-label="حذف المستوى" onClick={() => {
                            const next = structuredClone(draft) as SharedSemesterSource
                            next.semesters.splice(index, 1)
                            setDraft(next)
                          }}><IconTrash /></Button>
                        </CardAction>
                      </CardHeader>
                      <CardContent>
                        <Field>
                          <FieldLabel>رموز المقررات — رمز في كل سطر</FieldLabel>
                          <Textarea
                            dir="rtl"
                            value={semester.courses.map(codeOf).join("\n")}
                            onChange={(event) => {
                              const next = structuredClone(draft) as SharedSemesterSource
                              next.semesters[index].courses = preserveEntries(
                                semester.courses,
                                parseCodes(event.target.value),
                                `shared:${next.id || "source"}:${semester.id}`,
                              )
                              setDraft(next)
                            }}
                          />
                        </Field>
                      </CardContent>
                    </Card>
                  ))}
                  <Button variant="outline" onClick={() => {
                    const next = structuredClone(draft) as SharedSemesterSource
                    next.semesters.push({ id: `shared-semester-${crypto.randomUUID()}`, courses: [] })
                    setDraft(next)
                  }}><IconPlus data-icon="inline-start" />إضافة مستوى</Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Field orientation="horizontal">
                    <Checkbox
                      id="exclude-published"
                      checked={(draft as SharedElectiveSource).excludePublishedCourses !== false}
                      onCheckedChange={(checked) => setDraft({ ...draft, excludePublishedCourses: Boolean(checked) } as SourceDraft)}
                    />
                    <FieldLabel htmlFor="exclude-published">استبعاد المقررات الموجودة في الخطة المنشورة</FieldLabel>
                  </Field>
                  <Field>
                    <FieldLabel>رموز المقررات — رمز في كل سطر</FieldLabel>
                    <Textarea
                      dir="rtl"
                      value={(draft as SharedElectiveSource).courses.map(codeOf).join("\n")}
                      onChange={(event) => {
                        const next = structuredClone(draft) as SharedElectiveSource
                        next.courses = preserveEntries(next.courses, parseCodes(event.target.value), `shared-elective:${next.id || "source"}`)
                        setDraft(next)
                      }}
                    />
                  </Field>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>إلغاء</Button>
            <Button disabled={pending || !draft?.id || !draft?.name} onClick={save}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              حفظ المصدر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SourceList({
  title,
  kind,
  values,
  onEdit,
  workspace,
}: {
  title: string
  kind: SourceKind
  values: Array<SharedSemesterSource | SharedElectiveSource>
  onEdit: (kind: SourceKind, source: SharedSemesterSource | SharedElectiveSource) => void
  workspace: PlanWorkspace
}) {
  const base = `/api/institutions/${encodeURIComponent(workspace.selection.institutionId)}`
  const path = kind === "semester" ? "shared-semester-sources" : "shared-elective-sources"
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Badge variant="outline">{values.length}</Badge>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {values.map((source) => (
          <div key={source.id} className="flex items-center gap-3 rounded-lg bg-muted/45 p-3 ring-1 ring-foreground/10">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{source.name}</p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">{source.id}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEdit(kind, source)}>تعديل</Button>
            <Button variant="ghost" size="icon-sm" aria-label="نسخ المصدر" onClick={async () => {
              const id = `${source.id}-copy`
              await workspace.mutate(`${base}/${path}/${encodeURIComponent(source.id)}/duplicate`, "POST", { id, name: `${source.name} - نسخة` })
              await workspace.refreshState()
              toast.add({ title: "أُنشئت نسخة من المصدر." })
            }}><IconCopy /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="حذف المصدر" onClick={async () => {
              if (!window.confirm(`سيُحذف المصدر «${source.name}». هل تريد المتابعة؟`)) return
              await workspace.mutate(`${base}/${path}/${encodeURIComponent(source.id)}`, "DELETE")
              await workspace.refreshState()
              toast.add({ title: "حُذف المصدر." })
            }}><IconTrash /></Button>
          </div>
        ))}
      </div>
    </section>
  )
}

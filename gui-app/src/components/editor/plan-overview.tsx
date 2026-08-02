import { IconBuildingBank, IconBuildingCommunity, IconId } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { PlanWorkspace } from "@/hooks/use-plan-workspace"
import { sourceAppliesToSelection } from "../../../../gui/plan-model.mjs"

export function PlanOverview({ workspace }: { workspace: PlanWorkspace }) {
  const { plan, data, selection } = workspace
  if (!plan || !data) return null

  const applicableSources = data.sharedSemesterSets.filter((source) => sourceAppliesToSelection(source, selection))

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{plan.track ? "بيانات المسار" : "بيانات الخطة"}</CardTitle>
          <CardDescription>هوية الخطة وهدف الساعات. الجامعة والكلية مشتقتان من موقع الملف.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="plan-name">{plan.track ? "اسم المسار" : "اسم التخصص"}</FieldLabel>
              <Input
                id="plan-name"
                value={plan.track?.name ?? plan.major}
                onChange={(event) => workspace.editPlan((draft) => {
                  if (draft.track) draft.track.name = event.target.value
                  else draft.major = event.target.value
                })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="plan-id">المعرّف الثابت</FieldLabel>
              <Input
                id="plan-id"
                dir="ltr"
                value={plan.track?.id ?? plan.id}
                onChange={(event) => workspace.editPlan((draft) => {
                  if (draft.track) draft.track.id = event.target.value
                  else draft.id = event.target.value
                })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="degree">الدرجة</FieldLabel>
              <Input
                id="degree"
                value={plan.degree ?? ""}
                onChange={(event) => workspace.editPlan((draft) => { draft.degree = event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="expected-credits">إجمالي الساعات المتوقع</FieldLabel>
              <Input
                id="expected-credits"
                type="number"
                min={0}
                value={plan.expectedCredits ?? 0}
                onChange={(event) => workspace.editPlan((draft) => { draft.expectedCredits = Number(event.target.value) })}
              />
              <FieldDescription>يُستخدم للتحقق من اكتمال الخطة، ولا يغيّر تخطيط الصفحة.</FieldDescription>
            </Field>
          </FieldGroup>

          <div className="mt-5 grid gap-2 md:grid-cols-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted/55 p-3 text-sm">
              <IconBuildingBank />
              <span className="min-w-0 flex-1 truncate">{workspace.activeInstitution?.name}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/55 p-3 text-sm">
              <IconBuildingCommunity />
              <span className="min-w-0 flex-1 truncate">{workspace.activeCollege?.name}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/55 p-3 text-sm">
              <IconId />
              <span className="min-w-0 flex-1 truncate" dir="ltr">{plan.track ? `${plan.id}/${plan.track.id}` : plan.id}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المستويات المشتركة</CardTitle>
          <CardDescription>اختر المصادر المطبقة على هذا التخصص. يبقى ترتيب الاختيار هو ترتيب الظهور.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldSet>
            <FieldLegend variant="label" className="sr-only">مصادر المستويات المشتركة</FieldLegend>
            <FieldGroup className="grid gap-2 md:grid-cols-2">
              {applicableSources.map((source) => {
                const checked = plan.sharedSemesterSets.includes(source.id)
                return (
                  <Field key={source.id} orientation="horizontal" className="rounded-lg bg-muted/45 p-3">
                    <Checkbox
                      id={`shared-source-${source.id}`}
                      checked={checked}
                      onCheckedChange={(nextChecked) => workspace.editPlan((draft) => {
                        if (nextChecked) {
                          if (!draft.sharedSemesterSets.includes(source.id)) draft.sharedSemesterSets.push(source.id)
                        } else {
                          draft.sharedSemesterSets = draft.sharedSemesterSets.filter((id) => id !== source.id)
                        }
                      })}
                    />
                    <FieldLabel htmlFor={`shared-source-${source.id}`} className="min-w-0 flex-1 font-normal">
                      <span className="block truncate font-medium">{source.name}</span>
                      <span className="block text-xs text-muted-foreground">{source.semesters.length} مستويات · {source.phaseLabel}</span>
                    </FieldLabel>
                    {checked ? <Badge variant="secondary">مفعّل</Badge> : null}
                  </Field>
                )
              })}
              {!applicableSources.length ? (
                <p className="text-sm text-muted-foreground">لا توجد مصادر مشتركة تنطبق على نطاق هذا التخصص.</p>
              ) : null}
            </FieldGroup>
          </FieldSet>
        </CardContent>
      </Card>
    </div>
  )
}


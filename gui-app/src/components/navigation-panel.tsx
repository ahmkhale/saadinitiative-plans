import { useMemo, useState } from "react"
import {
  IconBuildingBank,
  IconBuildingCommunity,
  IconChevronLeft,
  IconCopy,
  IconDots,
  IconDownload,
  IconPlus,
  IconRoute,
  IconSchool,
  IconTrash,
} from "@tabler/icons-react"

import { FormDialog, type FormDialogField } from "@/components/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import type { PlanWorkspace } from "@/hooks/use-plan-workspace"

type DialogState = {
  title: string
  description?: string
  fields: FormDialogField[]
  submit: (values: Record<string, string>) => Promise<void>
}

export function NavigationPanel({ workspace }: { workspace: PlanWorkspace }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const { data, selection, activeInstitution, activeCollege } = workspace

  const institutionBase = selection.institutionId
    ? `/api/institutions/${encodeURIComponent(selection.institutionId)}`
    : ""

  const openEntityDialog = (next: DialogState) => setDialog(next)

  const openDuplicateMajor = (collegeId: string, majorId: string, majorName: string) => openEntityDialog({
    title: "نسخ التخصص",
    fields: [
      { name: "major", label: "اسم النسخة", value: `${majorName} - نسخة` },
      { name: "id", label: "معرّف النسخة", dir: "ltr" },
    ],
    submit: async (values) => {
      const result = await workspace.mutate<{ plan: { id: string } }>(`${institutionBase}/colleges/${encodeURIComponent(collegeId)}/majors/${encodeURIComponent(majorId)}/duplicate`, "POST", values)
      await workspace.refreshState()
      workspace.selectCollege(collegeId)
      await workspace.selectPlan(result.plan.id)
      toast.add({ title: "أُنشئت نسخة من التخصص." })
    },
  })

  const openAddTrack = (collegeId: string, majorId: string, sourceTrackId = "") => openEntityDialog({
    title: "إضافة مسار",
    description: "يرث المسار الخطة الأساسية دون تعديلها.",
    fields: [
      { name: "name", label: "اسم المسار" },
      { name: "id", label: "المعرّف الثابت", dir: "ltr" },
    ],
    submit: async (values) => {
      const result = await workspace.mutate<{ plan: PlanWorkspace["plan"] }>(`${institutionBase}/colleges/${encodeURIComponent(collegeId)}/majors/${encodeURIComponent(majorId)}/tracks`, "POST", { ...values, sourceTrackId: sourceTrackId || undefined })
      await workspace.refreshState()
      workspace.selectCollege(collegeId)
      await workspace.selectPlan(majorId, result.plan?.track?.id)
      toast.add({ title: "أُضيف المسار." })
    },
  })

  const deletePlanTarget = async (collegeId: string, majorId: string, label: string, trackId = "") => {
    if (!window.confirm(`سيُحذف «${label}» نهائيًا. هل تريد المتابعة؟`)) return
    const suffix = trackId ? `/tracks/${encodeURIComponent(trackId)}` : ""
    await workspace.mutate(`${institutionBase}/colleges/${encodeURIComponent(collegeId)}/majors/${encodeURIComponent(majorId)}${suffix}`, "DELETE")
    await workspace.refreshState()
    workspace.selectCollege(collegeId)
    toast.add({ title: trackId ? "حُذف المسار." : "حُذف التخصص." })
  }

  const entityFields = useMemo<FormDialogField[]>(() => [
    { name: "name", label: "الاسم" },
    { name: "id", label: "المعرّف الثابت", dir: "ltr" },
  ], [])

  if (!data) return null

  return (
    <aside className="flex min-h-0 w-[18rem] shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-4 py-4">
        <img src="/assets/logo.svg" alt="" className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-semibold">مولّد الخطط الدراسية</p>
          <p className="text-xs text-sidebar-foreground/60">مبادرة صاد</p>
        </div>
      </div>
      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-3">
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-sidebar-foreground/60">الجامعة</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="إضافة جامعة"
                onClick={() => openEntityDialog({
                  title: "إضافة جامعة",
                  description: "يُستخدم المعرّف في مسار ملفات الجامعة.",
                  fields: entityFields,
                  submit: async (values) => {
                    const result = await workspace.mutate<{ institution: { id: string } }>("/api/institutions", "POST", values)
                    await workspace.selectInstitution(result.institution.id)
                    toast.add({ title: "أُضيفت الجامعة." })
                  },
                })}
              >
                <IconPlus />
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              {data.institutions.map((institution) => (
                <Button
                  key={institution.id}
                  variant={selection.institutionId === institution.id ? "secondary" : "ghost"}
                  className="h-auto justify-start py-2.5"
                  onClick={() => workspace.selectInstitution(institution.id)}
                >
                  <IconBuildingBank data-icon="inline-start" />
                  <span className="min-w-0 flex-1 truncate text-start">{institution.name}</span>
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={!selection.institutionId || workspace.dirty || workspace.generatingInstitution}
                onClick={async () => {
                  const result = await workspace.generateInstitution()
                  if (result) toast.add({ title: `اكتمل تصدير ${result.exported.length} من ${result.total} خطة.` })
                }}
              >
                {workspace.generatingInstitution ? <Spinner data-icon="inline-start" /> : <IconDownload data-icon="inline-start" />}
                تصدير كل خطط الجامعة
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-sidebar-foreground/60">الكليات والتخصصات</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="إضافة كلية"
                disabled={!selection.institutionId}
                onClick={() => openEntityDialog({
                  title: "إضافة كلية",
                  description: "ستُنشأ الكلية داخل الجامعة المحددة.",
                  fields: entityFields,
                  submit: async (values) => {
                    const result = await workspace.mutate<{ college: { id: string } }>(`${institutionBase}/colleges`, "POST", values)
                    await workspace.refreshState()
                    workspace.selectCollege(result.college.id)
                    toast.add({ title: "أُضيفت الكلية." })
                  },
                })}
              >
                <IconPlus />
              </Button>
            </div>

            <div className="flex flex-col gap-1">
              {data.colleges.map((college) => {
                const active = selection.collegeId === college.id
                return (
                  <Collapsible key={college.id} open={active} onOpenChange={(open) => open && workspace.selectCollege(college.id)}>
                    <CollapsibleTrigger
                      render={
                        <Button
                          variant={active ? "secondary" : "ghost"}
                          className="group w-full justify-start"
                        />
                      }
                    >
                      <IconBuildingCommunity data-icon="inline-start" />
                      <span className="min-w-0 flex-1 truncate text-start">{college.name}</span>
                      <Badge variant="outline">{college.majors.length}</Badge>
                      <IconChevronLeft className="transition-transform group-data-panel-open:-rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1 flex flex-col gap-1 border-s ps-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start text-muted-foreground"
                        onClick={() => openEntityDialog({
                          title: "إضافة تخصص",
                          description: "سينشئ المولّد خطة بفصل أول فارغ.",
                          fields: [
                            { name: "major", label: "اسم التخصص" },
                            { name: "id", label: "المعرّف الثابت", dir: "ltr" },
                          ],
                          submit: async (values) => {
                            const result = await workspace.mutate<{ plan: { id: string } }>(`${institutionBase}/colleges/${encodeURIComponent(college.id)}/majors`, "POST", values)
                            await workspace.refreshState()
                            workspace.selectCollege(college.id)
                            await workspace.selectPlan(result.plan.id)
                            toast.add({ title: "أُضيف التخصص." })
                          },
                        })}
                      >
                        <IconPlus data-icon="inline-start" />
                        إضافة تخصص
                      </Button>
                      {college.majors.map((major) => (
                        <div key={major.id} className="flex flex-col gap-1">
                          <ContextMenu>
                            <ContextMenuTrigger
                              render={
                                <Button
                                  variant={selection.majorId === major.id && !selection.trackId ? "secondary" : "ghost"}
                                  size="sm"
                                  className="h-auto w-full justify-start py-2"
                                  onClick={() => workspace.selectPlan(major.id)}
                                />
                              }
                            >
                              <IconSchool data-icon="inline-start" />
                              <span className="min-w-0 flex-1 truncate text-start">{major.major}</span>
                              <Badge variant="outline">{major.semesterCount}</Badge>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuGroup>
                                <ContextMenuItem onClick={() => openDuplicateMajor(college.id, major.id, major.major)}>
                                  <IconCopy />
                                  نسخ التخصص
                                </ContextMenuItem>
                                <ContextMenuItem onClick={() => openAddTrack(college.id, major.id)}>
                                  <IconRoute />
                                  إضافة مسار
                                </ContextMenuItem>
                                <ContextMenuItem variant="destructive" onClick={() => deletePlanTarget(college.id, major.id, major.major)}>
                                  <IconTrash />
                                  حذف التخصص
                                </ContextMenuItem>
                              </ContextMenuGroup>
                            </ContextMenuContent>
                          </ContextMenu>
                          {major.tracks.length ? (
                            <div className="flex flex-col gap-1 ps-5">
                              {major.tracks.map((track) => (
                                <Button
                                  key={track.id}
                                  variant={selection.trackId === track.id ? "secondary" : "ghost"}
                                  size="xs"
                                  className="justify-start"
                                  onClick={() => workspace.selectPlan(major.id, track.id)}
                                >
                                  <IconRoute data-icon="inline-start" />
                                  <span className="truncate">{track.name}</span>
                                </Button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          </section>
        </div>
      </ScrollArea>

      <Separator />
      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{activeInstitution?.name ?? "لا توجد جامعة"}</p>
          <p className="truncate text-xs text-sidebar-foreground/55">{activeCollege?.name ?? "اختر كلية"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
            <IconDots />
            <span className="sr-only">إجراءات</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={!workspace.plan || Boolean(selection.trackId)}
                onClick={() => workspace.plan && openDuplicateMajor(selection.collegeId, selection.majorId, workspace.plan.major)}
              >
                <IconCopy />
                نسخ التخصص
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!selection.majorId}
                onClick={() => openAddTrack(selection.collegeId, selection.majorId, selection.trackId)}
              >
                <IconRoute />
                إضافة مسار
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={!workspace.plan}
                onClick={() => workspace.plan && deletePlanTarget(
                  selection.collegeId,
                  selection.majorId,
                  workspace.plan.track?.name ?? workspace.plan.major,
                  selection.trackId,
                )}
              >
                <IconTrash />
                {selection.trackId ? "حذف المسار" : "حذف التخصص"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <FormDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.title ?? ""}
        description={dialog?.description}
        fields={dialog?.fields ?? []}
        onSubmit={dialog?.submit ?? (async () => undefined)}
      />
    </aside>
  )
}

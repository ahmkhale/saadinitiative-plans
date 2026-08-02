import { useEffect, useMemo, useState } from "react"
import { IconDownload, IconFolderOpen, IconPalette, IconRefresh, IconSearch } from "@tabler/icons-react"

import { SourceManager } from "@/components/settings/source-manager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import type { PlanWorkspace } from "@/hooks/use-plan-workspace"
import { groupCourseColors, parseColorKeywords } from "../../../../gui/color-editor.mjs"

export function SettingsEditor({ workspace }: { workspace: PlanWorkspace }) {
  const data = workspace.data
  const [edition, setEdition] = useState("")
  const [release, setRelease] = useState("")
  const [guidePages, setGuidePages] = useState("both")
  const [settingsPending, setSettingsPending] = useState(false)
  const [colorSubjects, setColorSubjects] = useState("")
  const [previousSubjects, setPreviousSubjects] = useState<string[]>([])
  const [color, setColor] = useState("#2B78DD")
  const [colorPending, setColorPending] = useState(false)
  const [colorQuery, setColorQuery] = useState("")

  useEffect(() => {
    if (!data) return
    setEdition(data.settings.edition)
    setRelease(data.settings.release)
    setGuidePages(data.settings.courseGuidePages)
  }, [data])

  const colorGroups = useMemo(() => groupCourseColors(data?.colors ?? {}), [data?.colors])
  const visibleColorGroups = useMemo(() => {
    const query = colorQuery.trim().toLocaleLowerCase("ar")
    return query
      ? colorGroups.filter((group) => group.subjects.some((subject: string) => subject.toLocaleLowerCase("ar").includes(query)))
      : colorGroups
  }, [colorGroups, colorQuery])
  if (!data) return null
  const base = `/api/institutions/${encodeURIComponent(workspace.selection.institutionId)}`

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-medium text-primary">إعدادات المؤسسة</p>
        <h2 className="font-heading text-lg font-semibold">المصادر والإصدار والتصدير</h2>
        <p className="text-sm text-muted-foreground">هذه القيم مشتركة بين الخطط ولا تُخزن داخل ملف الخطة.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>بيانات الإصدار</CardTitle>
          <CardDescription>تظهر في جميع الخطط التابعة لهذه المؤسسة.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault()
              setSettingsPending(true)
              try {
                await workspace.mutate(`${base}/settings`, "PUT", { edition, release, courseGuidePages: guidePages })
                await workspace.refreshState()
                toast.add({ title: "حُفظت إعدادات الإصدار." })
              } finally {
                setSettingsPending(false)
              }
            }}
          >
            <FieldGroup className="grid gap-3 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="edition">الطبعة</FieldLabel>
                <Input id="edition" value={edition} onChange={(event) => setEdition(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="release">الإصدار</FieldLabel>
                <Input id="release" value={release} onChange={(event) => setRelease(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="guide-pages">ظهور دليل بطاقة المقرر</FieldLabel>
                <NativeSelect id="guide-pages" value={guidePages} onChange={(event) => setGuidePages(event.target.value)}>
                  <NativeSelectOption value="published">الخطة المنشورة</NativeSelectOption>
                  <NativeSelectOption value="proposal">الخطة المقترحة</NativeSelectOption>
                  <NativeSelectOption value="both">كلتا الصفحتين</NativeSelectOption>
                </NativeSelect>
              </Field>
            </FieldGroup>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setEdition(data.settings.edition)
                setRelease(data.settings.release)
                setGuidePages(data.settings.courseGuidePages)
              }}><IconRefresh data-icon="inline-start" />استعادة المحفوظ</Button>
              <Button type="submit" disabled={settingsPending}>
                {settingsPending ? <Spinner data-icon="inline-start" /> : null}
                حفظ الإعدادات
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <SourceManager workspace={workspace} />

      <Card>
        <CardHeader>
          <CardTitle>ألوان رموز المقررات</CardTitle>
          <CardDescription>اجمع الصيغ البديلة بعلامة &amp;، مثل: إحص &amp; احص.</CardDescription>
          <CardAction><Badge variant="outline">{colorGroups.length} مجموعات</Badge></CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="grid items-end gap-3 md:grid-cols-[1fr_10rem_auto]"
            onSubmit={async (event) => {
              event.preventDefault()
              setColorPending(true)
              try {
                await workspace.mutate("/api/colors", "PUT", {
                  subjects: parseColorKeywords(colorSubjects),
                  previousSubjects,
                  color,
                })
                await workspace.refreshState()
                setColorSubjects("")
                setPreviousSubjects([])
                toast.add({ title: "حُفظ لون رموز المقرر." })
              } finally {
                setColorPending(false)
              }
            }}
          >
            <Field>
              <FieldLabel htmlFor="color-subjects">رموز القسم</FieldLabel>
              <Input id="color-subjects" value={colorSubjects} onChange={(event) => setColorSubjects(event.target.value)} placeholder="إحص & احص" />
              <FieldDescription>{previousSubjects.length ? "سيتم تحديث المجموعة المحددة." : "أدخل رمزًا أو أكثر."}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="course-color">اللون</FieldLabel>
              <Input id="course-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            </Field>
            <Button type="submit" disabled={colorPending || !colorSubjects.trim()}>
              <IconPalette data-icon="inline-start" />
              {previousSubjects.length ? "تحديث" : "إضافة"}
            </Button>
          </form>
          <Field>
            <FieldLabel htmlFor="color-search" className="sr-only">البحث في رموز الأقسام</FieldLabel>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input id="color-search" className="ps-8" value={colorQuery} onChange={(event) => setColorQuery(event.target.value)} placeholder="ابحث في 135 مجموعة لونية…" />
            </div>
          </Field>
          <ScrollArea className="h-80 rounded-lg bg-muted/25 p-2 ring-1 ring-foreground/10">
          <div className="grid gap-2 pe-2 md:grid-cols-2 xl:grid-cols-3">
            {visibleColorGroups.map((group) => (
              <button
                key={`${group.subjects.join("-")}-${group.color}`}
                type="button"
                className="flex items-center gap-3 rounded-lg bg-muted/45 p-3 text-start ring-1 ring-foreground/10 transition-colors hover:bg-muted"
                onClick={() => {
                  setColorSubjects(group.subjects.join(" & "))
                  setPreviousSubjects(group.subjects)
                  setColor(group.color)
                }}
              >
                <span className="size-7 rounded-md ring-1 ring-foreground/10" style={{ backgroundColor: group.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{group.subjects.join(" & ")}</span>
                <code className="text-xs text-muted-foreground">{group.color}</code>
              </button>
            ))}
          </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>دليل المقررات</CardTitle>
            <CardDescription>حالة المصدر النشط المستخدم في المطابقة.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Metric label="مقرر محلول" value={data.catalog.resolvedCourseCount.toLocaleString("ar-SA")} />
            <Metric label="تعارضات" value={data.catalog.conflictCount.toLocaleString("ar-SA")} />
            <Metric label="آخر تعديل" value={data.catalog.sources?.[0]?.modifiedAt ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(data.catalog.sources[0].modifiedAt)) : "—"} />
            <p className="truncate text-xs text-muted-foreground sm:col-span-3" dir="ltr">{data.catalog.sources?.[0]?.path}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>تصدير المؤسسة</CardTitle>
            <CardDescription>أنشئ جميع الخطط الأساسية ومساراتها بالخيارات المحددة في الشريط العلوي.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => workspace.mutate("/api/open-output", "POST")}>
              <IconFolderOpen data-icon="inline-start" />فتح المخرجات
            </Button>
            <Button disabled={workspace.generatingInstitution || workspace.dirty} onClick={async () => {
              const result = await workspace.generateInstitution()
              if (result) toast.add({ title: `اكتمل تصدير ${result.exported.length} من ${result.total} خطة.` })
            }}>
              {workspace.generatingInstitution ? <Spinner data-icon="inline-start" /> : <IconDownload data-icon="inline-start" />}
              تصدير جميع الخطط
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="font-heading text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

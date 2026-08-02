import {
  IconDeviceFloppy,
  IconDownload,
  IconFileTypePdf,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import type { PlanWorkspace } from "@/hooks/use-plan-workspace"

export function TopBar({ workspace }: { workspace: PlanWorkspace }) {
  const blockingErrors = workspace.preview?.diagnostics.summary.errors ?? 0
  const disabled = !workspace.plan || blockingErrors > 0

  return (
    <header className="flex min-h-16 shrink-0 items-center gap-4 border-b bg-background px-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate font-heading text-base font-semibold">
            {workspace.plan?.track?.name ?? workspace.plan?.major ?? "مساحة إعداد الخطط"}
          </h1>
          {workspace.plan ? (
            <Badge variant={workspace.dirty ? "secondary" : "outline"}>
              {workspace.dirty ? "تغييرات غير محفوظة" : "محفوظ"}
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[workspace.activeInstitution?.name, workspace.activeCollege?.name, workspace.plan?.major]
            .filter(Boolean)
            .join(" / ") || "اختر تخصصًا من قائمة التنقل"}
        </p>
      </div>

      <div className="hidden items-center gap-3 lg:flex">
        <Field orientation="horizontal" className="w-auto gap-2">
          <Checkbox
            id="keep-svg"
            checked={workspace.keepSvg}
            onCheckedChange={(checked) => workspace.setKeepSvg(Boolean(checked))}
          />
          <FieldLabel htmlFor="keep-svg" className="font-normal">SVG</FieldLabel>
        </Field>
        <Field orientation="horizontal" className="w-auto gap-2">
          <Checkbox
            id="export-png"
            checked={workspace.exportPng}
            onCheckedChange={(checked) => workspace.setExportPng(Boolean(checked))}
          />
          <FieldLabel htmlFor="export-png" className="font-normal">PNG</FieldLabel>
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          disabled={!workspace.plan || workspace.saving}
          onClick={async () => {
            await workspace.savePlan()
            toast.add({ title: "حُفظت الخطة." })
          }}
        >
          {workspace.saving ? <Spinner data-icon="inline-start" /> : <IconDeviceFloppy data-icon="inline-start" />}
          حفظ
        </Button>
        <Button
          variant="outline"
          disabled={disabled || workspace.generating}
          className="hidden xl:inline-flex"
          onClick={async () => {
            await workspace.generatePlan(false)
            toast.add({ title: "أُنشئ PDF دون حفظ التغييرات." })
          }}
        >
          <IconFileTypePdf data-icon="inline-start" />
          إنشاء دون حفظ
        </Button>
        <Button
          disabled={disabled || workspace.generating}
          onClick={async () => {
            await workspace.generatePlan(true)
            toast.add({ title: "حُفظت الخطة وأُنشئ PDF." })
          }}
        >
          {workspace.generating ? <Spinner data-icon="inline-start" /> : <IconDownload data-icon="inline-start" />}
          حفظ وإنشاء PDF
        </Button>
      </div>
    </header>
  )
}


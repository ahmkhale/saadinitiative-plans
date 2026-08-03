import { useState } from "react"
import {
  IconAlertTriangle,
  IconCheck,
  IconExternalLink,
  IconFolderOpen,
  IconZoomIn,
} from "@tabler/icons-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import type { PlanWorkspace } from "@/hooks/use-plan-workspace"

export function PreviewDesk({ workspace }: { workspace: PlanWorkspace }) {
  const [zoom, setZoom] = useState(72)
  const preview = workspace.preview
  const diagnostics = preview?.diagnostics.items ?? []
  const actionable = diagnostics.filter((item) => item.severity !== "info")

  return (
    <aside className="hidden min-h-0 w-[23rem] shrink-0 flex-col border-s bg-surface/45 min-[1100px]:flex 2xl:w-[28rem]">
      <div className="flex min-h-16 items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-heading text-sm font-semibold">مكتب المعاينة</p>
            {workspace.previewing ? <Spinner /> : preview?.ok ? <IconCheck className="text-primary" /> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {preview?.pageLayouts.length
              ? preview.pageLayouts.map((page) => `${page.width}×${Math.round(page.height)} pt`).join(" · ")
              : "المقاس الفعلي للصفحة محفوظ"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="فتح مجلد المخرجات"
          onClick={async () => {
            await workspace.mutate("/api/open-output", "POST")
            toast.add({ title: "فُتح مجلد المخرجات." })
          }}
        >
          <IconFolderOpen />
        </Button>
      </div>
      <Separator />

      <div className="flex items-center gap-3 px-4 py-3">
        <IconZoomIn className="text-muted-foreground" />
        <Slider
          value={zoom}
          min={45}
          max={110}
          step={1}
          aria-label="تكبير المعاينة"
          onValueChange={(value) => setZoom(Number(value))}
        />
        <Badge variant="outline">{zoom}%</Badge>
      </div>

      <ScrollArea className="min-h-0 flex-1 bg-muted/45">
        <div className="flex min-h-full flex-col items-center gap-5 p-5">
          {!workspace.plan ? (
            <Empty className="m-auto border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon"><IconExternalLink /></EmptyMedia>
                <EmptyTitle>المعاينة بانتظار خطة</EmptyTitle>
                <EmptyDescription>اختر تخصصًا لتظهر صفحاته هنا بالمقاس نفسه المستخدم في التصدير.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : workspace.previewing && !preview ? (
            <div className="m-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> جارٍ تشكيل المعاينة…
            </div>
          ) : preview?.pages.length ? preview.pages.map((svg, index) => (
            <div
              key={`${index}-${preview.pageLayouts[index]?.height}`}
              className="plan-preview-page origin-top overflow-hidden bg-white shadow-[0_18px_60px_rgba(15,23,42,.12)] ring-1 ring-foreground/10"
              style={{ width: `${zoom}%` }}
              aria-label={`معاينة الصفحة ${index + 1}`}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )) : (
            <Empty className="m-auto border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon"><IconAlertTriangle /></EmptyMedia>
                <EmptyTitle>تعذّرت المعاينة</EmptyTitle>
                <EmptyDescription>عالج الأخطاء المانعة الظاهرة أسفل المكتب.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </ScrollArea>

      <Separator />
      <div className="max-h-52 overflow-auto p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium">مراجعة الخطة</p>
          <Badge variant={actionable.length ? "destructive" : "secondary"}>{actionable.length}</Badge>
        </div>
        <div className="flex flex-col gap-2">
          {!actionable.length ? (
            <Alert>
              <IconCheck />
              <AlertTitle>لا توجد أخطاء مانعة</AlertTitle>
              <AlertDescription>المعاينة جاهزة للتصدير.</AlertDescription>
            </Alert>
          ) : actionable.slice(0, 5).map((item, index) => (
            <button
              key={`${item.code}-${index}`}
              type="button"
              className="text-start"
              onClick={() => {
                const target = item.location ? document.querySelector(`[data-location="${item.location}"]`) : null
                target?.scrollIntoView({ behavior: "smooth", block: "center" })
              }}
            >
              <Alert variant={item.severity === "errors" ? "destructive" : "default"}>
                <IconAlertTriangle />
                <AlertTitle>{item.code}</AlertTitle>
                <AlertDescription dir="ltr">{item.message}</AlertDescription>
              </Alert>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}

import {
  IconAlertTriangle,
  IconBooks,
  IconChecklist,
  IconFileDescription,
  IconSettings,
  IconSparkles,
  IconX,
} from "@tabler/icons-react"

import { ElectivesEditor } from "@/components/editor/electives-editor"
import { PlanOverview } from "@/components/editor/plan-overview"
import { ProposalEditor } from "@/components/editor/proposal-editor"
import { SemesterEditor } from "@/components/editor/semester-editor"
import { NavigationPanel } from "@/components/navigation-panel"
import { PreviewDesk } from "@/components/preview-desk"
import { SettingsEditor } from "@/components/settings/settings-editor"
import { TopBar } from "@/components/top-bar"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { usePlanWorkspace } from "@/hooks/use-plan-workspace"

function App() {
  const workspace = usePlanWorkspace()

  return (
    <TooltipProvider>
      <div className="flex h-dvh min-w-[64rem] overflow-hidden bg-background" dir="rtl">
        <NavigationPanel workspace={workspace} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar workspace={workspace} />
          <main className="relative min-h-0 flex-1 overflow-y-auto bg-workspace-grid">
            {workspace.error ? (
              <div className="sticky top-0 z-10 p-3 pb-0">
                <Alert variant="destructive" className="shadow-sm">
                  <IconAlertTriangle />
                  <AlertTitle>تعذّر إتمام العملية</AlertTitle>
                  <AlertDescription>{workspace.error}</AlertDescription>
                  <AlertAction>
                    <Button variant="ghost" size="icon-sm" aria-label="إغلاق التنبيه" onClick={() => workspace.setError("")}>
                      <IconX />
                    </Button>
                  </AlertAction>
                </Alert>
              </div>
            ) : null}

            {workspace.loading && !workspace.data ? (
              <div className="grid h-full place-items-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner />جارٍ تحميل مساحة العمل…</div>
              </div>
            ) : !workspace.plan ? (
              <div className="grid h-full place-items-center p-8">
                <Empty className="max-w-lg border-0 bg-card/85 shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><IconBooks /></EmptyMedia>
                    <EmptyTitle>ابدأ من هيكل المؤسسة</EmptyTitle>
                    <EmptyDescription>اختر كلية ثم تخصصًا من القائمة. ستظهر الخطة ومعاينتها الحية دون الحاجة إلى فتح ملفات JSON يدويًا.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : (
              <Tabs defaultValue="published" className="min-h-full">
                <div className="sticky top-0 z-10 border-b bg-background/94 px-5 py-3 backdrop-blur-sm">
                  <TabsList variant="line" className="w-full justify-start">
                    <TabsTrigger value="published"><IconFileDescription data-icon="inline-start" />الخطة المنشورة</TabsTrigger>
                    <TabsTrigger value="electives"><IconChecklist data-icon="inline-start" />الاختيارية</TabsTrigger>
                    <TabsTrigger value="proposal"><IconSparkles data-icon="inline-start" />المقترحة</TabsTrigger>
                    <TabsTrigger value="settings"><IconSettings data-icon="inline-start" />الإعدادات</TabsTrigger>
                  </TabsList>
                </div>
                <div className="mx-auto w-full max-w-4xl p-5 pb-16">
                  <TabsContent value="published" className="flex flex-col gap-5">
                    <PlanOverview workspace={workspace} />
                    <SemesterEditor workspace={workspace} />
                  </TabsContent>
                  <TabsContent value="electives"><ElectivesEditor workspace={workspace} /></TabsContent>
                  <TabsContent value="proposal"><ProposalEditor workspace={workspace} /></TabsContent>
                  <TabsContent value="settings"><SettingsEditor workspace={workspace} /></TabsContent>
                </div>
              </Tabs>
            )}
          </main>
        </div>

        <PreviewDesk workspace={workspace} />
      </div>
      <Toaster />
    </TooltipProvider>
  )
}

export default App


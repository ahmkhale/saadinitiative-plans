import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { api } from "@/lib/api"
import { updatePlan as producePlan } from "@/lib/plan"
import type {
  AppState,
  College,
  CourseFacts,
  Institution,
  MajorSummary,
  Plan,
  PreviewResult,
  Selection,
} from "@/types"

type PlanResponse = { ok: true; plan: Plan; parentPlan?: Plan }

const emptySelection: Selection = {
  institutionId: "",
  collegeId: "",
  majorId: "",
  trackId: "",
}

export function usePlanWorkspace() {
  const [data, setData] = useState<AppState | null>(null)
  const [selection, setSelection] = useState<Selection>(emptySelection)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [parentPlan, setParentPlan] = useState<Plan | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingInstitution, setGeneratingInstitution] = useState(false)
  const [error, setError] = useState("")
  const [keepSvg, setKeepSvg] = useState(false)
  const [exportPng, setExportPng] = useState(false)
  const previewSequence = useRef(0)

  const loadState = useCallback(async (institutionId = selection.institutionId) => {
    const query = institutionId ? `?institutionId=${encodeURIComponent(institutionId)}` : ""
    const next = await api<AppState>(`/api/state${query}`)
    setData(next)
    setSelection((current) => ({
      ...current,
      institutionId: next.selectedInstitutionId,
      collegeId: next.colleges.some((college) => college.id === current.collegeId) ? current.collegeId : "",
    }))
    return next
  }, [selection.institutionId])

  useEffect(() => {
    loadState().catch((reason) => setError(reason.message)).finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectInstitution = useCallback(async (institutionId: string) => {
    if (dirty && !window.confirm("لديك تغييرات غير محفوظة. هل تريد تركها؟")) return
    setLoading(true)
    setPlan(null)
    setParentPlan(null)
    setPreview(null)
    setDirty(false)
    setSelection({ institutionId, collegeId: "", majorId: "", trackId: "" })
    try {
      await loadState(institutionId)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dirty, loadState])

  const selectCollege = useCallback((collegeId: string) => {
    if (dirty && !window.confirm("لديك تغييرات غير محفوظة. هل تريد تركها؟")) return
    setSelection((current) => ({ ...current, collegeId, majorId: "", trackId: "" }))
    setPlan(null)
    setParentPlan(null)
    setPreview(null)
    setDirty(false)
  }, [dirty])

  const selectPlan = useCallback(async (majorId: string, trackId = "") => {
    if (dirty && !window.confirm("لديك تغييرات غير محفوظة. هل تريد تركها؟")) return
    if (!selection.institutionId || !selection.collegeId) return
    setLoading(true)
    setError("")
    const suffix = trackId ? `/tracks/${encodeURIComponent(trackId)}` : ""
    try {
      const result = await api<PlanResponse>(
        `/api/institutions/${encodeURIComponent(selection.institutionId)}/colleges/${encodeURIComponent(selection.collegeId)}/majors/${encodeURIComponent(majorId)}${suffix}`,
      )
      setSelection((current) => ({ ...current, majorId, trackId }))
      setPlan(result.plan)
      setParentPlan(result.parentPlan ?? null)
      setPreview(null)
      setDirty(false)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dirty, selection.collegeId, selection.institutionId])

  useEffect(() => {
    if (!plan || !selection.majorId) return
    const sequence = ++previewSequence.current
    const timer = window.setTimeout(async () => {
      setPreviewing(true)
      try {
        const result = await api<PreviewResult>("/api/preview", {
          method: "POST",
          body: JSON.stringify({
            institutionId: selection.institutionId,
            collegeId: selection.collegeId,
            majorId: selection.majorId,
            trackId: selection.trackId || undefined,
            plan,
          }),
        })
        if (sequence === previewSequence.current) setPreview(result)
      } catch (reason) {
        if (sequence === previewSequence.current) setError((reason as Error).message)
      } finally {
        if (sequence === previewSequence.current) setPreviewing(false)
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [plan, selection])

  const editPlan = useCallback((recipe: (draft: Plan) => void) => {
    setPlan((current) => current ? producePlan(current, recipe) : current)
    setDirty(true)
  }, [])

  const savePlan = useCallback(async () => {
    if (!plan) return null
    setSaving(true)
    setError("")
    const suffix = selection.trackId
      ? `/tracks/${encodeURIComponent(selection.trackId)}`
      : ""
    try {
      const result = await api<PlanResponse>(
        `/api/institutions/${encodeURIComponent(selection.institutionId)}/colleges/${encodeURIComponent(selection.collegeId)}/majors/${encodeURIComponent(selection.majorId)}${suffix}`,
        { method: "PUT", body: JSON.stringify(plan) },
      )
      setPlan(result.plan)
      setParentPlan(result.parentPlan ?? null)
      setSelection((current) => ({
        ...current,
        majorId: result.plan.id,
        trackId: result.plan.track?.id ?? current.trackId,
      }))
      setDirty(false)
      await loadState(selection.institutionId)
      return result
    } catch (reason) {
      setError((reason as Error).message)
      throw reason
    } finally {
      setSaving(false)
    }
  }, [loadState, plan, selection])

  const generatePlan = useCallback(async (save: boolean) => {
    if (!plan) return null
    setGenerating(true)
    setError("")
    try {
      const result = await api<{ ok: true; files: { pdf: string; folder: string }; pdfOptimization?: Record<string, unknown> }>("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          plan,
          institutionId: selection.institutionId,
          collegeId: selection.collegeId,
          majorId: selection.majorId,
          trackId: selection.trackId || undefined,
          save,
          keepSvg,
          png: exportPng,
        }),
      })
      if (save) {
        setDirty(false)
        await loadState(selection.institutionId)
      }
      window.open(result.files.pdf, "_blank", "noopener")
      return result
    } catch (reason) {
      setError((reason as Error).message)
      throw reason
    } finally {
      setGenerating(false)
    }
  }, [exportPng, keepSvg, loadState, plan, selection])

  const generateInstitution = useCallback(async () => {
    if (!selection.institutionId) return null
    setGeneratingInstitution(true)
    setError("")
    try {
      return await api<{ total: number; exported: unknown[]; failed: unknown[] }>(
        `/api/institutions/${encodeURIComponent(selection.institutionId)}/generate`,
        {
          method: "POST",
          body: JSON.stringify({ keepSvg, png: exportPng }),
        },
      )
    } catch (reason) {
      setError((reason as Error).message)
      throw reason
    } finally {
      setGeneratingInstitution(false)
    }
  }, [exportPng, keepSvg, selection.institutionId])

  const mutate = useCallback(async <T,>(url: string, method: string, body?: unknown) => {
    setError("")
    try {
      return await api<T>(url, { method, body: body === undefined ? undefined : JSON.stringify(body) })
    } catch (reason) {
      setError((reason as Error).message)
      throw reason
    }
  }, [])

  const refreshState = useCallback(async () => {
    await loadState(selection.institutionId)
  }, [loadState, selection.institutionId])

  const searchCourses = useCallback(async (query: string) => {
    if (query.trim().length < 2) return [] as CourseFacts[]
    const result = await api<{ courses: CourseFacts[] }>(`/api/catalog/search?q=${encodeURIComponent(query)}`)
    return result.courses
  }, [])

  const activeInstitution = useMemo<Institution | undefined>(() =>
    data?.institutions.find((item) => item.id === selection.institutionId), [data, selection.institutionId])
  const activeCollege = useMemo<College | undefined>(() =>
    data?.colleges.find((item) => item.id === selection.collegeId), [data, selection.collegeId])
  const activeMajor = useMemo<MajorSummary | undefined>(() =>
    activeCollege?.majors.find((item) => item.id === selection.majorId), [activeCollege, selection.majorId])

  return {
    data,
    selection,
    plan,
    parentPlan,
    preview,
    dirty,
    loading,
    previewing,
    saving,
    generating,
    generatingInstitution,
    error,
    keepSvg,
    exportPng,
    activeInstitution,
    activeCollege,
    activeMajor,
    setError,
    setKeepSvg,
    setExportPng,
    selectInstitution,
    selectCollege,
    selectPlan,
    editPlan,
    savePlan,
    generatePlan,
    generateInstitution,
    mutate,
    refreshState,
    searchCourses,
  }
}

export type PlanWorkspace = ReturnType<typeof usePlanWorkspace>

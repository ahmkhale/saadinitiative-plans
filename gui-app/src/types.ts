export type CourseEntry = string | {
  id?: string
  code: string
  prerequisites?: string[]
  corequisites?: string[]
  forcedCorequisites?: string[]
  prerequisiteAlternatives?: string[][]
  prerequisiteConditions?: string[]
  minimumCompletedCredits?: number
  name?: string
  subject?: string
  academicHours?: number
  lectureHours?: number
  exerciseHours?: number
  practicalHours?: number
  source?: string
  catalogSource?: string
  hoursDisplay?: string
  isTrackSpecific?: boolean
}

export type CourseFacts = {
  code?: string
  subject?: string
  name?: string
  academicHours?: number
  lectureHours?: number
  exerciseHours?: number
  practicalHours?: number
  prerequisites?: string[]
  source?: string
  catalogSource?: string
  hoursDisplay?: string
  found?: boolean
  isTrackSpecific?: boolean
  manuallyEditedFields?: string[]
}

export type Semester = {
  id: string
  name?: string
  courses: CourseEntry[]
}

export type ElectiveGroup = {
  id?: string
  sourceId?: string
  name?: string
  requiredHours?: number
  requirementText?: string
  excludePublishedCourses?: boolean
  courses?: CourseEntry[]
  excludedCourses?: CourseFacts[]
}

export type ProposalSemester = {
  id: string
  sourceSemesterId?: string | null
  type: "regular" | "summer"
  courseOrder: string[]
  placeholders: Array<{
    id: string
    name: string
    electiveGroupId?: string
    allocationHours?: number
    hoursDisplay?: string
    color?: string
  }>
}

export type Plan = {
  schemaVersion?: number
  id: string
  major: string
  university?: string
  college?: string
  degree?: string
  expectedCredits?: number
  track?: { id: string; name: string }
  sharedSemesterSets: string[]
  semesters: Semester[]
  electiveGroups: ElectiveGroup[]
  fallbackCourses: Record<string, CourseFacts>
  proposal?: {
    enabled: boolean
    title?: string
    semesters: ProposalSemester[]
  } | null
}

export type TrackSummary = {
  id: string
  name: string
  semesterCount: number
  ownSemesterCount: number
  hasProposal: boolean
}

export type MajorSummary = {
  id: string
  major: string
  degree: string
  expectedCredits: number
  semesterCount: number
  hasProposal: boolean
  tracks: TrackSummary[]
}

export type College = { id: string; name: string; majors: MajorSummary[] }
export type Institution = { id: string; name: string; colleges: College[] }

export type SharedSemesterSource = {
  id: string
  name: string
  phaseLabel?: string
  semesters: Semester[]
  fallbackCourses?: Record<string, CourseFacts>
  scope?: Record<string, unknown>
}

export type SharedElectiveSource = ElectiveGroup & {
  id: string
  name: string
  courses: CourseEntry[]
  fallbackCourses?: Record<string, CourseFacts>
  scope?: Record<string, unknown>
}

export type Diagnostic = {
  code: string
  message: string
  severity: "errors" | "warnings" | "info"
  location?: string
  semester?: number
}

export type Diagnostics = {
  summary: { errors: number; warnings: number; info: number }
  items: Diagnostic[]
}

export type PreviewResult = {
  ok: boolean
  plan: Plan
  pages: string[]
  pageLayouts: Array<{ width: number; height: number }>
  diagnostics: Diagnostics
}

export type AppState = {
  ok: boolean
  institutions: Institution[]
  selectedInstitutionId: string
  colleges: College[]
  catalog: {
    resolvedCourseCount: number
    conflictCount: number
    sources?: Array<{ path: string; modifiedAt?: string }>
  }
  colors: Record<string, string>
  settings: { edition: string; release: string; courseGuidePages: string }
  sharedSemesterSets: SharedSemesterSource[]
  sharedElectiveGroups: SharedElectiveSource[]
}

export type Selection = {
  institutionId: string
  collegeId: string
  majorId: string
  trackId: string
}

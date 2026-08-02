import { useEffect, useId, useState } from "react"
import { IconPlus, IconSearch } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { CourseFacts } from "@/types"

type CourseAdderProps = {
  onSearch: (query: string) => Promise<CourseFacts[]>
  onAdd: (codes: string[]) => void
}

function parseCodes(value: string) {
  const text = value.trim()
  if (!text) return []
  if (/[\n,،;]/u.test(text)) return text.split(/[\n,،;]+/u).map((item) => item.trim()).filter(Boolean)
  const matches = [...text.matchAll(/\d+[A-Za-z]?\s+[\p{L}]+/gu)].map((match) => match[0].trim())
  return matches.length > 1 && matches.join(" ") === text.replace(/\s+/gu, " ") ? matches : [text]
}

export function CourseAdder({ onSearch, onAdd }: CourseAdderProps) {
  const [value, setValue] = useState("")
  const [suggestions, setSuggestions] = useState<CourseFacts[]>([])
  const listId = useId()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSearch(value).then(setSuggestions).catch(() => setSuggestions([]))
    }, 180)
    return () => window.clearTimeout(timer)
  }, [onSearch, value])

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const codes = parseCodes(value)
        if (!codes.length) return
        onAdd(codes)
        setValue("")
        setSuggestions([])
      }}
    >
      <Field className="min-w-0 flex-1">
        <FieldLabel className="sr-only">رمز المقرر</FieldLabel>
        <div className="relative">
          <IconSearch className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-8"
            dir="rtl"
            list={listId}
            value={value}
            placeholder="ابحث بالرمز أو الاسم، أو ألصق عدة رموز"
            onChange={(event) => setValue(event.target.value)}
          />
          <datalist id={listId}>
            {suggestions.map((course) => (
              <option key={course.code} value={course.code}>{course.name}</option>
            ))}
          </datalist>
        </div>
        <FieldDescription className="sr-only">يمكن فصل عدة رموز بفاصلة.</FieldDescription>
      </Field>
      <Button type="submit" variant="outline">
        <IconPlus data-icon="inline-start" />
        إضافة
      </Button>
    </form>
  )
}


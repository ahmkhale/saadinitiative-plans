import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export type FormDialogField = {
  name: string
  label: string
  value?: string | number
  type?: "text" | "number"
  dir?: "ltr" | "rtl"
  required?: boolean
}

type FormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel?: string
  fields: FormDialogField[]
  onSubmit: (values: Record<string, string>) => Promise<void>
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "حفظ",
  fields,
  onSubmit,
}: FormDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues(Object.fromEntries(fields.map((field) => [field.name, String(field.value ?? "")])))
  }, [fields, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault()
            setPending(true)
            try {
              await onSubmit(values)
              onOpenChange(false)
            } finally {
              setPending(false)
            }
          }}
        >
          <FieldGroup>
            {fields.map((field) => (
              <Field key={field.name}>
                <FieldLabel htmlFor={`dialog-${field.name}`}>{field.label}</FieldLabel>
                <Input
                  id={`dialog-${field.name}`}
                  type={field.type ?? "text"}
                  dir={field.dir}
                  required={field.required ?? true}
                  value={values[field.name] ?? ""}
                  onChange={(event) => setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))}
                />
              </Field>
            ))}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "جارٍ الحفظ" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


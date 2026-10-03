import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FormFieldProps extends ComponentProps<'input'> {
  id: string
  label: string
  errors?: string[]
  hint?: string
}

export function FormField({ id, label, errors, hint, ...inputProps }: FormFieldProps) {
  const hasError = Boolean(errors?.length)
  const describedBy = hasError ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={hasError} aria-describedby={describedBy} {...inputProps} />
      {hasError ? (
        <p id={`${id}-error`} role="alert" className="text-base text-destructive">
          {errors!.join(' ')}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

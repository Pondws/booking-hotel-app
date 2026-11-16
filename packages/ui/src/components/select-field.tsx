"use client"

import * as React from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@booking/ui/components/select"

export type SelectOption<T extends string = string> = {
  value: T
  label: React.ReactNode
  disabled?: boolean
}

type SelectFieldProps<T extends string> = {
  options: readonly SelectOption<T>[]
  value: T | undefined
  /** Only ever called with a value from `options`, so no type guard is needed at the call site. */
  onValueChange: (value: T) => void
  id?: string
  placeholder?: string
  disabled?: boolean
  /** Applied to the trigger (e.g. a width such as `w-40` or `w-full`). */
  className?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
  /** false (default) = list opens below the trigger; true = selected item overlays the trigger. */
  alignItemWithTrigger?: boolean
}

function SelectField<T extends string>({
  options,
  value,
  onValueChange,
  id,
  placeholder,
  disabled,
  className,
  alignItemWithTrigger,
  ...aria
}: SelectFieldProps<T>) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const option = options.find((o) => o.value === next)
        if (option) onValueChange(option.value)
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={alignItemWithTrigger}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { SelectField }

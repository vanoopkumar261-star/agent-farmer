"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

type Option = { label: string; value: string };

export default function TerraSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: Option[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
        {label}
      </label>

      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger
          className="w-full inline-flex items-center justify-between gap-3 rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm text-af-ink outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
          aria-label={label}
        >
          <Select.Value />
          <Select.Icon className="text-af-muted">
            <ChevronDown className="w-4 h-4" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={8}
            className="z-[9999] overflow-hidden rounded-[16px] bg-af-card border border-af-border shadow-af-float"
          >
            <Select.Viewport className="p-2">
              {options.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className="relative flex cursor-pointer select-none items-center rounded-[12px] px-10 py-2.5 text-sm text-af-ink-2 outline-none data-[highlighted]:bg-af-sage data-[highlighted]:text-af-secondary data-[state=checked]:text-af-ink"
                >
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute left-3 inline-flex items-center justify-center text-af-primary">
                    <Check className="w-4 h-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
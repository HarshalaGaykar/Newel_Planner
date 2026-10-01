'use client';

import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxGroup,
  ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger,
} from '@/components/kibo-ui/combobox';
import { ActivityAssigneeOption } from '@/lib/activities-api';

interface Props {
  options: ActivityAssigneeOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/**
 * Multi-select on top of the single-select kibo-ui Combobox: selecting an option
 * toggles it in the array and the picker stays open, with the chosen people
 * shown as removable chips underneath.
 */
export default function AssigneeMultiSelect({ options, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const byId = useMemo(
    () => new Map(options.map((option) => [option.userId, option])),
    [options],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(query) ||
        option.email.toLowerCase().includes(query),
    );
  }, [options, search]);

  // cmdk hands back the item's value; match case-insensitively so the lookup
  // holds regardless of how it normalises the string.
  const toggle = (raw: string) => {
    const match = options.find((option) => option.userId.toLowerCase() === raw.toLowerCase());
    if (!match) return;
    onChange(
      value.includes(match.userId)
        ? value.filter((id) => id !== match.userId)
        : [...value, match.userId],
    );
  };

  const selected = value.map((id) => byId.get(id)).filter(Boolean) as ActivityAssigneeOption[];

  return (
    <div className="space-y-2">
      <Combobox
        data={options.map((option) => ({ value: option.userId, label: option.name }))}
        type="member"
        value=""
        onValueChange={toggle}
        open={open}
        onOpenChange={(next) => {
          if (disabled) return;
          setOpen(next);
          if (!next) setSearch('');
        }}
      >
        <ComboboxTrigger
          disabled={disabled}
          className="w-full h-9 px-3 text-xs font-normal justify-between"
        >
          <span className="flex w-full items-center justify-between gap-2">
            <span className={value.length ? 'text-foreground' : 'text-muted-foreground'}>
              {value.length === 0
                ? 'Select members...'
                : `${value.length} member${value.length === 1 ? '' : 's'} selected`}
            </span>
          </span>
        </ComboboxTrigger>
        <ComboboxContent className="z-[10000] p-0" shouldFilter={false}>
          <ComboboxInput value={search} onValueChange={setSearch} />
          <ComboboxEmpty>No matching member.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup>
              {filtered.map((option) => {
                const checked = value.includes(option.userId);
                return (
                  <ComboboxItem key={option.userId} value={option.userId} className="text-xs">
                    <span
                      className={`mr-2 flex size-4 shrink-0 items-center justify-center rounded border ${
                        checked ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                      }`}
                    >
                      {checked && <Check size={11} />}
                    </span>
                    <span className="flex-1 truncate">
                      {option.name}
                      {option.isSelf && (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          you
                        </span>
                      )}
                    </span>
                    <span className="ml-2 truncate text-[10px] text-muted-foreground">
                      {option.email}
                    </span>
                  </ComboboxItem>
                );
              })}
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <span
              key={option.userId}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium"
            >
              {option.name}
              {option.isSelf && (
                <span className="text-[9px] font-semibold uppercase text-muted-foreground">you</span>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((id) => id !== option.userId))}
                className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                aria-label={`Remove ${option.name}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

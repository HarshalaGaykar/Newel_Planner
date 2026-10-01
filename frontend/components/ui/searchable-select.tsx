'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  /** Empty string means "no selection" — renders `allLabel`. */
  value: string;
  onValueChange: (value: string) => void;
  /** Shown on the trigger and as the first, always-present option (clears the filter). */
  allLabel: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * A single-select, searchable dropdown built from shadcn's Popover + Command —
 * the same primitives-based pattern as SpokespersonCombobox, generalized for
 * any id/label option list (filter dropdowns, resource pickers, etc).
 *
 * Filtering is done manually against `label`/`sublabel` (Command's `shouldFilter`
 * is off) because `value` here is an opaque id, not searchable text.
 */
export function SearchableSelect({
  options,
  value,
  onValueChange,
  allLabel,
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  loading = false,
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q),
    );
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : allLabel}
          </span>
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[10000] p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onValueChange('');
                  setSearch('');
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', value === '' ? 'opacity-100' : 'opacity-0')} />
                {allLabel}
              </CommandItem>
            </CommandGroup>
            {filtered.length > 0 ? (
              <CommandGroup>
                {filtered.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.value}
                    onSelect={() => {
                      onValueChange(o.value);
                      setSearch('');
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{o.label}</span>
                      {o.sublabel && <span className="truncate text-xs text-muted-foreground">{o.sublabel}</span>}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

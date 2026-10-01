'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { spokespersonsApi, Spokesperson } from '@/lib/spokespersons-api';

interface SpokespersonComboboxProps {
  clientId?: string | null;
  value?: string | null;
  /** Label to show for the current value before options load (e.g. on edit). */
  initialLabel?: string | null;
  onChange: (id: string | null, name?: string) => void;
}

export function SpokespersonCombobox({
  clientId,
  value,
  initialLabel,
  onChange,
}: SpokespersonComboboxProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Spokesperson[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const disabled = !clientId;

  // Load this client's spokespersons whenever the selected client changes.
  useEffect(() => {
    if (!clientId) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    spokespersonsApi
      .getByClient(clientId)
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load spokespersons');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const selectedName = useMemo(() => {
    if (!value) return '';
    return options.find((o) => o.id === value)?.name || initialLabel || '';
  }, [value, options, initialLabel]);

  const trimmed = search.trim();
  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const hasExact = options.some(
    (o) => o.name.toLowerCase() === trimmed.toLowerCase(),
  );

  const handleCreate = async () => {
    if (!clientId || !trimmed || creating) return;
    try {
      setCreating(true);
      setError('');
      const created = await spokespersonsApi.create({ name: trimmed, clientId });
      setOptions((prev) => {
        // Backend dedupes/reactivates, so the returned row may already be present.
        const exists = prev.some((o) => o.id === created.id);
        const next = exists ? prev : [...prev, created];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      onChange(created.id, created.name);
      setSearch('');
      setOpen(false);
    } catch {
      setError('Failed to create spokesperson');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
        Spokesperson
      </label>
      <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className={selectedName ? '' : 'text-slate-400'}>
              {disabled
                ? 'Please select a client'
                : selectedName || 'Search or add a spokesperson...'}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          align="start"
          style={{ width: 'var(--radix-popover-trigger-width)' }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search spokesperson..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading ? (
                <div className="py-6 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : (
                <>
                  {filtered.length > 0 && (
                    <CommandGroup>
                      {filtered.map((o) => (
                        <CommandItem
                          key={o.id}
                          value={o.id}
                          onSelect={() => {
                            onChange(o.id, o.name);
                            setSearch('');
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${value === o.id ? 'opacity-100' : 'opacity-0'}`}
                          />
                          {o.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {trimmed && !hasExact && (
                    <CommandGroup>
                      <CommandItem
                        value={`__create__${trimmed}`}
                        onSelect={handleCreate}
                        disabled={creating}
                      >
                        {creating ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        Create &quot;{trimmed}&quot;
                      </CommandItem>
                    </CommandGroup>
                  )}

                  {!trimmed && filtered.length === 0 && (
                    <div className="py-6 text-center text-sm text-slate-500">
                      No spokespersons yet. Type a name to add one.
                    </div>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

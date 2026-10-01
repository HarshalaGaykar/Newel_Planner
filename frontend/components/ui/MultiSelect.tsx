import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Option {
  value: string;
  label: string;
  subLabel?: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select options...',
  className,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    const isSelected = selected.includes(value);
    if (isSelected) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const removeOption = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    onChange(selected.filter((s) => s !== value));
  };

  const filteredOptions = options.filter(
    (option) =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.subLabel?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOptions = options.filter((option) => selected.includes(option.value));

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <div
        className={cn(
          'flex min-h-[38px] w-full flex-wrap gap-1 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          isOpen && 'ring-2 ring-ring ring-offset-2'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOptions.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map((option) => (
              <span
                key={option.value}
                className="flex items-center gap-1 rounded bg-secondary px-1 py-0.5 text-xs font-medium text-secondary-foreground"
              >
                {option.label}
                <button
                  type="button"
                  onClick={(e) => removeOption(e, option.value)}
                  className="rounded-full hover:bg-muted-foreground/20"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <div className="ml-auto flex items-center shrink-0">
          <ChevronDown size={16} className={cn('text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center border-b px-3 py-2">
            <Search size={14} className="mr-2 text-muted-foreground shrink-0" />
            <input
              className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-[200px] p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className={cn(
                      'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent/50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(option.value);
                    }}
                  >
                    <div className="flex flex-col flex-1">
                      <span className="font-medium">{option.label}</span>
                      {option.subLabel && <span className="text-[10px] text-muted-foreground">{option.subLabel}</span>}
                    </div>
                    {isSelected && <Check size={14} className="ml-auto text-primary" />}
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">No results found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

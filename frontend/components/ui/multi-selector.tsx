'use client';

import * as React from 'react';
import { CheckIcon, ChevronDown, XCircle, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface MultiSelectorOption {
  label: string;
  value: string;
  subLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disable?: boolean;
}

interface MultiSelectorProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange'> {
  options: MultiSelectorOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  maxCount?: number;
  modalPopover?: boolean;
  popoverClass?: string;
  showAll?: boolean;
  selectAllLabel?: string;
  emptyText?: string;
}

const MultiSelector = React.forwardRef<HTMLButtonElement, MultiSelectorProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = 'Select options',
      maxCount = 3,
      modalPopover = false,
      className,
      popoverClass,
      showAll = false,
      selectAllLabel = 'Select All',
      emptyText = 'No results found.',
      ...props
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const enabledOptions = React.useMemo(() => options.filter((option) => !option.disable), [options]);
    const selected = React.useMemo(() => value.filter((item) => options.some((option) => option.value === item)), [options, value]);

    const setSelected = (next: string[]) => onValueChange([...new Set(next)]);

    const toggleOption = (optionValue: string) => {
      const option = options.find((item) => item.value === optionValue);
      if (option?.disable) return;
      setSelected(selected.includes(optionValue)
        ? selected.filter((item) => item !== optionValue)
        : [...selected, optionValue]);
    };

    const handleClear = () => setSelected([]);
    const clearExtraOptions = () => setSelected(selected.slice(0, maxCount));
    const allEnabledSelected = enabledOptions.length > 0 && enabledOptions.every((option) => selected.includes(option.value));
    const toggleAll = () => setSelected(allEnabledSelected ? [] : enabledOptions.map((option) => option.value));

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        setOpen(true);
      } else if (event.key === 'Backspace' && !event.currentTarget.value && selected.length > 0) {
        setSelected(selected.slice(0, -1));
      }
    };

    const visibleSelected = showAll ? selected : selected.slice(0, maxCount);

    return (
      <Popover open={open} onOpenChange={setOpen} modal={modalPopover}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            {...props}
            onClick={(event) => {
              props.onClick?.(event);
              setOpen((current) => !current);
            }}
            className={cn(
              'flex h-auto min-h-10 w-full justify-between rounded-md px-2 py-1 text-left hover:bg-background',
              className,
            )}
          >
            {selected.length > 0 ? (
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                  {visibleSelected.map((item) => {
                    const option = options.find((entry) => entry.value === item);
                    const Icon = option?.icon;
                    return (
                      <span
                        key={item}
                        className="inline-flex max-w-full items-center rounded-full border bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
                      >
                        {Icon && <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{option?.label ?? item}</span>
                        <XCircle
                          className="ml-1.5 h-3.5 w-3.5 shrink-0 cursor-pointer"
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleOption(item);
                          }}
                        />
                      </span>
                    );
                  })}
                  {!showAll && selected.length > maxCount && (
                    <span className="inline-flex items-center rounded-full border bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                      +{selected.length - maxCount} more
                      <XCircle
                        className="ml-1.5 h-3.5 w-3.5 cursor-pointer"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          clearExtraOptions();
                        }}
                      />
                    </span>
                  )}
                </div>
                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                  <XIcon
                    className="h-4 w-4 cursor-pointer"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleClear();
                    }}
                  />
                  <ChevronDown className="h-4 w-4" />
                </span>
              </div>
            ) : (
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate px-1 text-sm text-muted-foreground">{placeholder}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn('w-[var(--radix-popover-trigger-width)] min-w-64 p-0', popoverClass)}
          align="start"
          onEscapeKeyDown={() => setOpen(false)}
        >
          <Command>
            <CommandInput placeholder="Search..." onKeyDown={handleInputKeyDown} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                <CommandItem value="__all__" onSelect={toggleAll} className="cursor-pointer">
                  <span
                    className={cn(
                      'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                      allEnabledSelected ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible',
                    )}
                  >
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <span>{selectAllLabel}</span>
                </CommandItem>
                {options.map((option) => {
                  const isSelected = selected.includes(option.value);
                  const Icon = option.icon;
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      keywords={[option.label, option.subLabel ?? '']}
                      disabled={option.disable}
                      onSelect={() => toggleOption(option.value)}
                      className={cn('cursor-pointer', option.disable && 'cursor-not-allowed opacity-50')}
                    >
                      <span
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible',
                        )}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </span>
                      {Icon && <Icon className="mr-2 h-4 w-4" />}
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{option.label}</span>
                        {option.subLabel && <span className="truncate text-xs text-muted-foreground">{option.subLabel}</span>}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <div className="flex items-center justify-between">
                  {selected.length > 0 && (
                    <CommandItem onSelect={handleClear} className="flex-1 cursor-pointer justify-center border-r">
                      Clear
                    </CommandItem>
                  )}
                  <CommandItem onSelect={() => setOpen(false)} className="flex-1 cursor-pointer justify-center">
                    Close
                  </CommandItem>
                </div>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);

MultiSelector.displayName = 'MultiSelector';

export default MultiSelector;

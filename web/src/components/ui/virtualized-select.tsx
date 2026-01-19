/**
 * VirtualizedSelect - A searchable dropdown for larger option lists
 * Dense, power-user focused design with theme colors
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface VirtualizedSelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
}

const ITEM_HEIGHT = 32;
const MAX_VISIBLE_ITEMS = 8;

export function VirtualizedSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className,
  searchable = true,
}: VirtualizedSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.sublabel?.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = useCallback(
    (optValue: string) => {
      onChange(optValue);
      setIsOpen(false);
      setSearchQuery('');
    },
    [onChange]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    if (isOpen && value && listRef.current) {
      const index = filteredOptions.findIndex(opt => opt.value === value);
      if (index > 0) {
        listRef.current.scrollTop = Math.max(0, (index - 2) * ITEM_HEIGHT);
      }
    }
  }, [isOpen, value, filteredOptions]);

  const maxHeight = Math.min(filteredOptions.length, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-8 w-full items-center justify-between rounded border px-2.5 py-1.5 text-sm',
          'border-border bg-background text-foreground',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform text-muted-foreground',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded border border-border bg-popover shadow-lg">
          {searchable && (
            <div className="p-1.5 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className={cn(
                    'w-full h-7 pl-7 pr-7 rounded border text-sm',
                    'border-border bg-background text-foreground',
                    'placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-1 focus:ring-ring'
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div className="p-3 text-center text-muted-foreground text-sm">No options found</div>
          ) : (
            <div 
              ref={listRef}
              className="overflow-y-auto" 
              style={{ maxHeight: `${maxHeight}px` }}
            >
              {filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <div
                    key={option.value}
                    className={cn(
                      'px-2.5 py-1.5 cursor-pointer flex items-center justify-between text-sm',
                      'hover:bg-muted',
                      isSelected && 'bg-primary/10'
                    )}
                    onClick={() => handleSelect(option.value)}
                  >
                    <div className="overflow-hidden flex-1 min-w-0">
                      <div className="truncate text-foreground">{option.label}</div>
                      {option.sublabel && (
                        <div className="truncate text-xs text-muted-foreground">{option.sublabel}</div>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary ml-2 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * VirtualizedMultiSelect - Multi-select with search
 */
interface VirtualizedMultiSelectProps {
  options: SelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function VirtualizedMultiSelect({
  options,
  values,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className,
}: VirtualizedMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const selectedLabels = useMemo(() => 
    values
      .map((v) => options.find((o) => o.value === v)?.label)
      .filter((v): v is string => Boolean(v)),
    [values, options]
  );

  const toggleValue = useCallback((val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  }, [values, onChange]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const maxHeight = Math.min(filteredOptions.length, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-8 w-full items-center justify-between rounded border px-2.5 py-1.5 text-sm',
          'border-border bg-background text-foreground',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className={cn('truncate', values.length === 0 && 'text-muted-foreground')}>
          {values.length === 0
            ? placeholder
            : selectedLabels.length <= 2
            ? selectedLabels.join(', ')
            : `${selectedLabels.length} selected`}
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 transition-transform text-muted-foreground', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded border border-border bg-popover shadow-lg">
          <div className="p-1.5 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full h-7 pl-7 pr-7 rounded border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {filteredOptions.length === 0 ? (
            <div className="p-3 text-center text-muted-foreground text-sm">No options found</div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: `${maxHeight}px` }}>
              {filteredOptions.map((option) => {
                const isSelected = values.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className={cn(
                      'px-2.5 py-1.5 cursor-pointer flex items-center gap-2 text-sm',
                      'hover:bg-muted',
                      isSelected && 'bg-primary/10'
                    )}
                    onClick={() => toggleValue(option.value)}
                  >
                    <div className={cn(
                      'h-3.5 w-3.5 shrink-0 rounded-sm border flex items-center justify-center',
                      isSelected ? 'bg-primary border-primary' : 'border-border'
                    )}>
                      {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    <span className="truncate text-foreground">{option.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

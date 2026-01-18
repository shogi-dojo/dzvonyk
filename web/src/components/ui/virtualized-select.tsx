/**
 * VirtualizedSelect - A searchable dropdown for larger option lists
 * Uses virtualization pattern for performance with many items
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

const ITEM_HEIGHT = 40;
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

  // Filter options
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.sublabel?.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Find selected option
  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = useCallback(
    (optValue: string) => {
      onChange(optValue);
      setIsOpen(false);
      setSearchQuery('');
    },
    [onChange]
  );

  // Close on outside click
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

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Scroll to selected item when opened
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
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm',
          'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900',
          'text-gray-900 dark:text-gray-100',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className={cn('truncate', !selectedOption && 'text-gray-400')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 transition-transform text-gray-500',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          {/* Search input */}
          {searchable && (
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className={cn(
                    'w-full h-8 pl-8 pr-8 rounded border text-sm',
                    'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900',
                    'text-gray-900 dark:text-gray-100',
                    'focus:outline-none focus:ring-1 focus:ring-blue-500'
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options list */}
          {filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No options found</div>
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
                      'px-3 py-2 cursor-pointer flex items-center justify-between',
                      'hover:bg-blue-50 dark:hover:bg-blue-900/30',
                      isSelected && 'bg-blue-100 dark:bg-blue-900/50'
                    )}
                    onClick={() => handleSelect(option.value)}
                  >
                    <div className="overflow-hidden flex-1 min-w-0">
                      <div className="truncate text-gray-900 dark:text-gray-100">{option.label}</div>
                      {option.sublabel && (
                        <div className="truncate text-xs text-gray-500">{option.sublabel}</div>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 ml-2 shrink-0" />}
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
          'flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm',
          'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className={cn('truncate text-gray-900 dark:text-gray-100', values.length === 0 && 'text-gray-400')}>
          {values.length === 0
            ? placeholder
            : selectedLabels.length <= 2
            ? selectedLabels.join(', ')
            : `${selectedLabels.length} selected`}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform text-gray-500', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full h-8 pl-8 pr-8 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No options found</div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: `${maxHeight}px` }}>
              {filteredOptions.map((option) => {
                const isSelected = values.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className={cn(
                      'px-3 py-2 cursor-pointer flex items-center gap-2',
                      'hover:bg-blue-50 dark:hover:bg-blue-900/30',
                      isSelected && 'bg-blue-100 dark:bg-blue-900/50'
                    )}
                    onClick={() => toggleValue(option.value)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="h-4 w-4 shrink-0"
                    />
                    <span className="truncate text-gray-900 dark:text-gray-100">{option.label}</span>
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

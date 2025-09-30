'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { TimePeriod } from '@/types/analytics';

interface TimePeriodSelectorProps {
  /** Current selected time period */
  value: TimePeriod;
  /** Callback when time period changes */
  onChange?: (period: TimePeriod) => void;
  /** Optional CSS class name */
  className?: string;
}

const TIME_PERIODS: Array<{ value: TimePeriod; label: string }> = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

/**
 * TimePeriodSelector component allows users to switch between day/week/month views
 * Manages URL state and provides clear visual feedback
 *
 * Requirement 2.3: Time period selection support
 */
export function TimePeriodSelector({
  value,
  onChange,
  className = '',
}: TimePeriodSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePeriodChange = useCallback(
    (period: TimePeriod) => {
      // Update URL state
      const params = new URLSearchParams(searchParams.toString());
      params.set('period', period);
      router.push(`?${params.toString()}`, { scroll: false });

      // Call onChange callback if provided
      onChange?.(period);
    },
    [onChange, router, searchParams]
  );

  return (
    <div
      className={`inline-flex rounded-md shadow-sm ${className}`}
      role="group"
      aria-label="Time period selector"
    >
      {TIME_PERIODS.map((period, index) => {
        const isSelected = value === period.value;
        const isFirst = index === 0;
        const isLast = index === TIME_PERIODS.length - 1;

        return (
          <Button
            key={period.value}
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePeriodChange(period.value)}
            className={`
              ${!isFirst && !isLast ? 'rounded-none' : ''}
              ${isFirst ? 'rounded-r-none' : ''}
              ${isLast ? 'rounded-l-none' : ''}
              ${!isFirst ? '-ml-px' : ''}
              relative
            `}
            aria-pressed={isSelected}
            aria-label={`View ${period.label.toLowerCase()} trends`}
          >
            {period.label}
          </Button>
        );
      })}
    </div>
  );
}
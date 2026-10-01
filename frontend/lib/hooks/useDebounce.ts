import { useState, useEffect } from 'react';

/**
 * Debounces a value by the given delay (ms).
 * Returns the debounced value only after the user stops
 * changing it for the specified duration.
 *
 * Usage: const debouncedSearch = useDebounce(searchText, 300);
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}
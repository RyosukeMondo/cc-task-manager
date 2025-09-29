'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TaskStatus } from '@cc-task-manager/types';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Search,
  X,
  Clock,
  Filter,
  History,
  Sparkles
} from 'lucide-react';

export interface SearchOptions {
  searchFields: SearchField[];
  caseSensitive: boolean;
  useRegex: boolean;
  highlightMatches: boolean;
}

export type SearchField = 'taskId' | 'progress' | 'error' | 'all';

interface TaskSearchProps {
  tasks: TaskStatus[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearchResults?: (results: TaskStatus[]) => void;
  className?: string;
  placeholder?: string;
  showAdvancedOptions?: boolean;
  debounceMs?: number;
  maxRecentSearches?: number;
}

interface SearchSuggestion {
  type: 'field' | 'value' | 'operator';
  text: string;
  description: string;
  insertText: string;
}

/**
 * TaskSearch component following Single Responsibility Principle
 * Handles advanced search functionality with debouncing, suggestions, and field-specific search
 * Optimized for large datasets with efficient filtering algorithms
 */
export function TaskSearch({
  tasks,
  searchTerm,
  onSearchChange,
  onSearchResults,
  className,
  placeholder = "Search tasks...",
  showAdvancedOptions = true,
  debounceMs = 300,
  maxRecentSearches = 10
}: TaskSearchProps) {
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    searchFields: ['all'],
    caseSensitive: false,
    useRegex: false,
    highlightMatches: true
  });

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('taskSearchHistory');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  // Generate search suggestions based on current tasks
  const suggestions = useMemo((): SearchSuggestion[] => {
    if (!searchTerm || searchTerm.length < 2) return [];

    const suggestions: SearchSuggestion[] = [];
    const searchLower = searchTerm.toLowerCase();

    // Field-specific search suggestions
    if (searchTerm.includes(':')) {
      const [field] = searchTerm.split(':');
      if (['status', 'priority', 'error'].includes(field)) {
        suggestions.push({
          type: 'operator',
          text: `${field}:completed`,
          description: 'Search by status',
          insertText: `${field}:completed`
        });
      }
    } else {
      // General suggestions based on task content
      const taskIds = [...new Set(tasks.map(t => t.taskId).filter(id =>
        id.toLowerCase().includes(searchLower)
      ))].slice(0, 5);

      taskIds.forEach(id => {
        suggestions.push({
          type: 'value',
          text: id,
          description: 'Task ID',
          insertText: id
        });
      });
    }

    return suggestions;
  }, [searchTerm, tasks]);

  // Advanced search algorithm with multiple field support
  const searchTasks = useCallback((term: string, options: SearchOptions): TaskStatus[] => {
    if (!term.trim()) return tasks;

    const searchStr = options.caseSensitive ? term : term.toLowerCase();
    let regex: RegExp | null = null;

    if (options.useRegex) {
      try {
        regex = new RegExp(searchStr, options.caseSensitive ? 'g' : 'gi');
      } catch {
        // Invalid regex, fall back to string search
      }
    }

    const searchInField = (value: string | undefined, field: string): boolean => {
      if (!value) return false;

      const fieldValue = options.caseSensitive ? value : value.toLowerCase();

      if (regex) {
        return regex.test(fieldValue);
      }

      // Support field-specific search syntax (e.g., "status:completed")
      if (term.includes(':')) {
        const [searchField, searchValue] = term.split(':', 2);
        if (field === searchField.toLowerCase()) {
          return fieldValue.includes(options.caseSensitive ? searchValue : searchValue.toLowerCase());
        }
        return false;
      }

      return fieldValue.includes(searchStr);
    };

    return tasks.filter(task => {
      // If searching all fields or specific field is included
      if (options.searchFields.includes('all')) {
        return (
          searchInField(task.taskId, 'taskid') ||
          searchInField(task.progress, 'progress') ||
          searchInField(task.error, 'error') ||
          searchInField(task.state, 'status')
        );
      }

      // Search only specified fields
      return options.searchFields.some(field => {
        switch (field) {
          case 'taskId':
            return searchInField(task.taskId, 'taskid');
          case 'progress':
            return searchInField(task.progress, 'progress');
          case 'error':
            return searchInField(task.error, 'error');
          default:
            return false;
        }
      });
    });
  }, [tasks]);

  // Perform search with current options
  const searchResults = useMemo(() => {
    return searchTasks(debouncedSearchTerm, searchOptions);
  }, [debouncedSearchTerm, searchOptions, searchTasks]);

  // Notify parent of search results
  useEffect(() => {
    onSearchResults?.(searchResults);
  }, [searchResults, onSearchResults]);

  const handleSearchSubmit = () => {
    if (!searchTerm.trim()) return;

    // Add to recent searches
    const newRecentSearches = [
      searchTerm,
      ...recentSearches.filter(s => s !== searchTerm)
    ].slice(0, maxRecentSearches);

    setRecentSearches(newRecentSearches);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('taskSearchHistory', JSON.stringify(newRecentSearches));
    }

    setShowSuggestions(false);
  };

  const clearSearch = () => {
    onSearchChange('');
    setShowSuggestions(false);
  };

  const applyRecentSearch = (term: string) => {
    onSearchChange(term);
    setShowSuggestions(false);
  };

  const applySuggestion = (suggestion: SearchSuggestion) => {
    onSearchChange(suggestion.insertText);
    setShowSuggestions(false);
  };

  const toggleSearchField = (field: SearchField) => {
    setSearchOptions(prev => {
      let newFields = [...prev.searchFields];

      if (field === 'all') {
        newFields = ['all'];
      } else {
        newFields = newFields.filter(f => f !== 'all');

        if (newFields.includes(field)) {
          newFields = newFields.filter(f => f !== field);
        } else {
          newFields.push(field);
        }

        if (newFields.length === 0) {
          newFields = ['all'];
        }
      }

      return { ...prev, searchFields: newFields };
    });
  };

  const hasActiveOptions = searchOptions.searchFields.length > 1 ||
                          !searchOptions.searchFields.includes('all') ||
                          searchOptions.caseSensitive ||
                          searchOptions.useRegex;

  return (
    <div className={cn('relative w-full', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearchSubmit();
            } else if (e.key === 'Escape') {
              setShowSuggestions(false);
            }
          }}
          className="pl-9 pr-20"
        />

        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {showAdvancedOptions && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 w-7 p-0',
                    hasActiveOptions && 'text-primary'
                  )}
                >
                  <Filter className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Search Fields</h4>
                    <div className="flex flex-wrap gap-1">
                      {(['all', 'taskId', 'progress', 'error'] as SearchField[]).map(field => (
                        <Badge
                          key={field}
                          variant={searchOptions.searchFields.includes(field) ? "default" : "outline"}
                          className="cursor-pointer capitalize"
                          onClick={() => toggleSearchField(field)}
                        >
                          {field === 'all' ? 'All Fields' : field}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Options</h4>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={searchOptions.caseSensitive}
                          onChange={(e) => setSearchOptions(prev => ({
                            ...prev,
                            caseSensitive: e.target.checked
                          }))}
                          className="rounded"
                        />
                        <span className="text-sm">Case sensitive</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={searchOptions.useRegex}
                          onChange={(e) => setSearchOptions(prev => ({
                            ...prev,
                            useRegex: e.target.checked
                          }))}
                          className="rounded"
                        />
                        <span className="text-sm">Use regex</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={searchOptions.highlightMatches}
                          onChange={(e) => setSearchOptions(prev => ({
                            ...prev,
                            highlightMatches: e.target.checked
                          }))}
                          className="rounded"
                        />
                        <span className="text-sm">Highlight matches</span>
                      </label>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="h-7 w-7 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Search Suggestions and Recent Searches */}
      {showSuggestions && (searchTerm || recentSearches.length > 0) && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1">
          <CardContent className="p-2">
            {suggestions.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Sparkles className="h-3 w-3" />
                  Suggestions
                </div>
                <div className="space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="w-full text-left px-2 py-1 text-sm hover:bg-muted rounded flex items-center justify-between"
                      onClick={() => applySuggestion(suggestion)}
                    >
                      <span>{suggestion.text}</span>
                      <span className="text-xs text-muted-foreground">{suggestion.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {recentSearches.length > 0 && !searchTerm && (
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <History className="h-3 w-3" />
                  Recent searches
                </div>
                <div className="space-y-1">
                  {recentSearches.slice(0, 5).map((term, index) => (
                    <button
                      key={index}
                      className="w-full text-left px-2 py-1 text-sm hover:bg-muted rounded flex items-center justify-between"
                      onClick={() => applyRecentSearch(term)}
                    >
                      <span>{term}</span>
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search Results Summary */}
      {searchTerm && (
        <div className="mt-2 text-xs text-muted-foreground">
          {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          {searchOptions.searchFields.includes('all') ? '' : ` in ${searchOptions.searchFields.join(', ')}`}
        </div>
      )}
    </div>
  );
}
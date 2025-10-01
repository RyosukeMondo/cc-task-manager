import * as React from 'react';
import { useRef, useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, PauseCircle, PlayCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/**
 * Log entry interface matching the expected log structure
 */
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface LogViewerProps {
  taskId: string;
  logs: LogEntry[];
  className?: string;
}

/**
 * LogViewer - Displays task execution logs with syntax highlighting and virtual scrolling
 *
 * Features:
 * - Virtual scrolling with react-window for > 1000 log lines
 * - Auto-scroll to bottom when new logs arrive (sticky to bottom)
 * - Pause auto-scroll when user scrolls up (resume when scrolled to bottom)
 * - "Copy Logs" button to copy all logs to clipboard
 * - Empty state: "No logs available yet" with icon
 * - Log format: [timestamp] [level] message
 * - Level colors: info (blue), warn (yellow), error (red)
 * - Accessible with ARIA labels
 */
export const LogViewer = React.memo<LogViewerProps>(({ taskId, logs, className }) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && listRef.current && logs.length > 0) {
      listRef.current.scrollToItem(logs.length - 1, 'end');
    }
  }, [logs.length, autoScroll]);

  // Detect user scroll to pause auto-scroll
  const handleScroll = ({ scrollOffset, scrollUpdateWasRequested }: any) => {
    if (!scrollUpdateWasRequested && containerRef.current) {
      const containerHeight = containerRef.current.clientHeight || 0;
      const maxScroll = logs.length * 24 - containerHeight;
      const isNearBottom = scrollOffset >= maxScroll - 50;

      setAutoScroll(isNearBottom);
    }
  };

  // Copy all logs to clipboard
  const handleCopyLogs = async () => {
    try {
      const allLogs = logs
        .map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
        .join('\n');
      await navigator.clipboard.writeText(allLogs);
      toast({
        title: 'Success',
        description: 'Logs copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy logs to clipboard',
        variant: 'destructive',
      });
    }
  };

  // Render single log line (virtualized)
  const LogRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const log = logs[index];
    const levelColor = {
      info: 'text-blue-400',
      warn: 'text-yellow-400',
      error: 'text-red-400',
    }[log.level];

    return (
      <div style={style} className="font-mono text-xs px-4 flex gap-2">
        <span className="text-muted-foreground whitespace-nowrap">{log.timestamp}</span>
        <span className={cn(levelColor, 'whitespace-nowrap')}>[{log.level.toUpperCase()}]</span>
        <span className="break-words">{log.message}</span>
      </div>
    );
  };

  return (
    <Card className={cn('w-full', className)} role="region" aria-label="Task execution logs">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle>Execution Logs</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLogs}
              disabled={logs.length === 0}
              aria-label="Copy logs to clipboard"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Logs
            </Button>
            {logs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoScroll(!autoScroll)}
                aria-label={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
              >
                {autoScroll ? (
                  <>
                    <PauseCircle className="h-4 w-4 mr-2" />
                    Pause Auto-scroll
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Resume Auto-scroll
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="bg-gray-950 rounded-lg overflow-hidden"
          role="log"
          aria-live="polite"
        >
          {logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
              <p className="text-sm">No logs available yet</p>
            </div>
          ) : logs.length > 1000 ? (
            // Virtual scrolling for large log sets (> 1000 lines)
            <List
              ref={listRef}
              height={400}
              itemCount={logs.length}
              itemSize={24}
              width="100%"
              onScroll={handleScroll}
            >
              {LogRow}
            </List>
          ) : (
            // Regular rendering for small log sets (<= 1000 lines)
            <div className="max-h-[400px] overflow-y-auto py-2">
              {logs.map((log, index) => (
                <LogRow key={index} index={index} style={{}} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

LogViewer.displayName = 'LogViewer';

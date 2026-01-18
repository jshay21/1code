"use client"

import { useMemo } from "react"
import { Globe, ExternalLink, Search } from "lucide-react"
import { type ToolActivity } from "../../../lib/atoms"
import { cn } from "../../../lib/utils"

interface WebModalContentProps {
  activity: ToolActivity
}

interface SearchResult {
  title: string
  url: string
}

function parseActivityData(activity: ToolActivity) {
  let input: { url?: string; query?: string; prompt?: string } = {}
  let output: { result?: string; bytes?: number; code?: number; results?: any[] } = {}

  try {
    if (activity.input) {
      input = JSON.parse(activity.input)
    }
  } catch {
    // Keep empty
  }

  try {
    if (activity.output) {
      output = JSON.parse(activity.output)
    }
  } catch {
    // Keep empty
  }

  return { input, output }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function parseSearchResults(rawResults: any[]): SearchResult[] {
  const allResults: SearchResult[] = []

  for (const result of rawResults) {
    if (result.content && Array.isArray(result.content)) {
      for (const item of result.content) {
        if (item.title && item.url) {
          allResults.push({ title: item.title, url: item.url })
        }
      }
    } else if (result.title && result.url) {
      allResults.push({ title: result.title, url: result.url })
    }
  }

  return allResults
}

export function WebFetchModalContent({ activity }: WebModalContentProps) {
  const { input, output } = useMemo(() => parseActivityData(activity), [activity])

  const url = input.url || ""
  const prompt = input.prompt || ""
  const result = output.result || ""
  const bytes = output.bytes || 0
  const statusCode = output.code
  const isSuccess = statusCode === 200
  const isRunning = activity.state === "running"

  // Extract hostname for display
  let hostname = ""
  try {
    hostname = new URL(url).hostname.replace("www.", "")
  } catch {
    hostname = url.slice(0, 50)
  }

  return (
    <div className="space-y-4">
      {/* URL header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Globe className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium">{hostname}</div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground truncate block"
          >
            {url}
          </a>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {isRunning ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
              Fetching...
            </span>
          ) : isSuccess ? (
            <span className="text-muted-foreground">{formatBytes(bytes)}</span>
          ) : (
            <span className="text-destructive">
              {statusCode ? `Error ${statusCode}` : "Failed"}
            </span>
          )}
        </div>
      </div>

      {/* Prompt if provided */}
      {prompt && (
        <div>
          <h4 className="text-sm font-medium mb-1">Extraction prompt</h4>
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
            {prompt}
          </div>
        </div>
      )}

      {/* Content */}
      {result ? (
        <div>
          <h4 className="text-sm font-medium mb-2">Content</h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <pre className="p-3 max-h-[350px] overflow-y-auto text-sm text-foreground whitespace-pre-wrap break-words font-mono bg-muted/30">
              {result}
            </pre>
          </div>
        </div>
      ) : isRunning ? (
        <div className="text-sm text-muted-foreground italic">
          Fetching content...
        </div>
      ) : null}

      {/* Error text if present */}
      {activity.errorText && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive whitespace-pre-wrap">
          {activity.errorText}
        </div>
      )}
    </div>
  )
}

export function WebSearchModalContent({ activity }: WebModalContentProps) {
  const { input, output } = useMemo(() => parseActivityData(activity), [activity])

  const query = input.query || ""
  const isRunning = activity.state === "running"

  const results = useMemo(() => {
    if (!output.results) return []
    return parseSearchResults(output.results)
  }, [output.results])

  return (
    <div className="space-y-4">
      {/* Query header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Search className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">Search query</div>
          <div className="font-medium">{query}</div>
        </div>
        <div className="text-sm text-muted-foreground">
          {isRunning ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
              Searching...
            </span>
          ) : (
            `${results.length} results`
          )}
        </div>
      </div>

      {/* Results list */}
      {results.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="max-h-[350px] overflow-y-auto divide-y divide-border">
            {results.map((result, idx) => (
              <a
                key={idx}
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors group"
              >
                <ExternalLink className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {result.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {result.url}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : isRunning ? (
        <div className="text-sm text-muted-foreground italic">
          Searching...
        </div>
      ) : (
        <div className="text-sm text-muted-foreground italic">
          No results found
        </div>
      )}

      {/* Error text if present */}
      {activity.errorText && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive whitespace-pre-wrap">
          {activity.errorText}
        </div>
      )}
    </div>
  )
}

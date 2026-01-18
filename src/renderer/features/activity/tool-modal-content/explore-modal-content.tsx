"use client"

import { useMemo } from "react"
import { FileText, Search, FolderSearch, Check, X, ChevronRight } from "lucide-react"
import { type ToolActivity } from "../../../lib/atoms"
import { cn } from "../../../lib/utils"
import { getFileIconByExtension } from "../../agents/mentions/agents-file-mention"

interface ExploreModalContentProps {
  activity: ToolActivity
  // For grouped activities
  activities?: ToolActivity[]
}

function parseActivityData(activity: ToolActivity) {
  let input: { file_path?: string; pattern?: string; path?: string; glob?: string } = {}
  let output: { content?: string; files?: string[]; matches?: any[]; truncated?: boolean } = {}

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

function getToolIcon(toolName: string) {
  switch (toolName) {
    case "Read":
      return FileText
    case "Grep":
      return Search
    case "Glob":
      return FolderSearch
    default:
      return FileText
  }
}

function getDisplayPath(filePath: string): string {
  if (!filePath) return ""
  const prefixes = ["/project/sandbox/repo/", "/project/sandbox/", "/project/"]
  for (const prefix of prefixes) {
    if (filePath.startsWith(prefix)) {
      return filePath.slice(prefix.length)
    }
  }
  if (filePath.startsWith("/")) {
    const parts = filePath.split("/")
    const rootIndicators = ["apps", "packages", "src", "lib", "components"]
    const rootIndex = parts.findIndex((p: string) => rootIndicators.includes(p))
    if (rootIndex > 0) {
      return parts.slice(rootIndex).join("/")
    }
  }
  return filePath
}

// Single activity view (Read, Grep, or Glob)
function SingleExploreContent({ activity }: { activity: ToolActivity }) {
  const { input, output } = useMemo(() => parseActivityData(activity), [activity])
  const isRunning = activity.state === "running"
  const isError = activity.state === "error"

  const Icon = getToolIcon(activity.toolName)
  const filePath = input.file_path || input.path || ""
  const pattern = input.pattern || input.glob || ""
  const displayPath = getDisplayPath(filePath)
  const filename = filePath ? filePath.split("/").pop() || "" : ""

  // Get file icon for Read
  const FileIcon = activity.toolName === "Read" && filename
    ? getFileIconByExtension(filename, true)
    : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {FileIcon && <FileIcon className="w-4 h-4 text-muted-foreground" />}
            <div className="font-medium truncate">
              {activity.toolName === "Read" && filename}
              {activity.toolName === "Grep" && `Pattern: ${pattern}`}
              {activity.toolName === "Glob" && `Pattern: ${pattern}`}
            </div>
          </div>
          {displayPath && (
            <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
              {displayPath}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm">
          {isRunning ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
              Running
            </span>
          ) : isError ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-1">
              <X className="w-3 h-3" />
              Error
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium flex items-center gap-1">
              <Check className="w-3 h-3" />
              Done
            </span>
          )}
        </div>
      </div>

      {/* Content based on tool type */}
      {activity.toolName === "Read" && output.content && (
        <div>
          <h4 className="text-sm font-medium mb-2">File content</h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <pre className="p-3 max-h-[350px] overflow-y-auto text-xs text-foreground whitespace-pre-wrap break-all font-mono bg-muted/30">
              {output.content}
            </pre>
          </div>
          {output.truncated && (
            <div className="text-xs text-muted-foreground mt-1 italic">
              Content was truncated
            </div>
          )}
        </div>
      )}

      {activity.toolName === "Glob" && output.files && output.files.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">
            Found {output.files.length} {output.files.length === 1 ? "file" : "files"}
          </h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="max-h-[350px] overflow-y-auto divide-y divide-border">
              {output.files.map((file: string, idx: number) => {
                const name = file.split("/").pop() || file
                const FileIcon = getFileIconByExtension(name, true)
                return (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2">
                    {FileIcon && <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    <span className="text-sm font-mono truncate">{getDisplayPath(file)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activity.toolName === "Grep" && output.matches && output.matches.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">
            Found {output.matches.length} {output.matches.length === 1 ? "match" : "matches"}
          </h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="max-h-[350px] overflow-y-auto divide-y divide-border">
              {output.matches.map((match: any, idx: number) => (
                <div key={idx} className="px-3 py-2">
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {getDisplayPath(match.file || match.path || "")}
                    {match.line && `:${match.line}`}
                  </div>
                  {match.content && (
                    <div className="text-sm font-mono mt-1 whitespace-pre-wrap break-all">
                      {match.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
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

// Grouped activities view
function GroupedExploreContent({ activities }: { activities: ToolActivity[] }) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {activities.length} exploration operations
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
          {activities.map((activity) => {
            const { input } = parseActivityData(activity)
            const Icon = getToolIcon(activity.toolName)
            const filePath = input.file_path || input.path || ""
            const pattern = input.pattern || input.glob || ""
            const displayPath = getDisplayPath(filePath)
            const isError = activity.state === "error"

            return (
              <div
                key={activity.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2",
                  isError && "bg-destructive/5",
                )}
              >
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">
                    {activity.toolName === "Read" && displayPath}
                    {activity.toolName === "Grep" && pattern}
                    {activity.toolName === "Glob" && pattern}
                  </div>
                  {activity.toolName !== "Read" && displayPath && (
                    <div className="text-xs text-muted-foreground truncate">
                      in {displayPath}
                    </div>
                  )}
                </div>
                {isError ? (
                  <X className="w-4 h-4 text-destructive flex-shrink-0" />
                ) : (
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ExploreModalContent({ activity, activities }: ExploreModalContentProps) {
  // If we have multiple activities (grouped), show grouped view
  if (activities && activities.length > 1) {
    return <GroupedExploreContent activities={activities} />
  }

  // Single activity view
  return <SingleExploreContent activity={activity} />
}

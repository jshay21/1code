"use client"

import { useMemo, useState, useEffect } from "react"
import { type ToolActivity } from "../../../lib/atoms"
import { cn } from "../../../lib/utils"
import { useCodeTheme } from "../../../lib/hooks/use-code-theme"
import { highlightCode } from "../../../lib/themes/shiki-theme-loader"
import { getFileIconByExtension } from "../../agents/mentions/agents-file-mention"

interface EditModalContentProps {
  activity: ToolActivity
}

type DiffLine = { type: "added" | "removed" | "context"; content: string }

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    go: "go",
    rs: "rust",
    html: "html",
    css: "css",
    json: "json",
    md: "markdown",
    sh: "bash",
    bash: "bash",
  }
  return langMap[ext] || "plaintext"
}

function parseActivityData(activity: ToolActivity) {
  let input: { file_path?: string; old_string?: string; new_string?: string; content?: string } = {}
  let output: { structuredPatch?: Array<{ lines: string[] }>; content?: string } = {}

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

function getDiffLines(patches: Array<{ lines: string[] }> | undefined): DiffLine[] {
  const result: DiffLine[] = []
  if (!patches) return result

  for (const patch of patches) {
    if (!patch.lines) continue
    for (const line of patch.lines) {
      if (line.startsWith("+")) {
        result.push({ type: "added", content: line.slice(1) })
      } else if (line.startsWith("-")) {
        result.push({ type: "removed", content: line.slice(1) })
      } else if (line.startsWith(" ")) {
        result.push({ type: "context", content: line.slice(1) })
      }
    }
  }

  return result
}

function calculateDiffStats(patches: Array<{ lines?: string[] }> | undefined): { added: number; removed: number } | null {
  if (!patches || patches.length === 0) return null

  let added = 0
  let removed = 0

  for (const patch of patches) {
    if (!patch.lines) continue
    for (const line of patch.lines) {
      if (line.startsWith("+")) added++
      else if (line.startsWith("-")) removed++
    }
  }

  return { added, removed }
}

function useBatchHighlight(
  lines: DiffLine[],
  language: string,
  themeId: string,
): Map<number, string> {
  const [highlightedMap, setHighlightedMap] = useState<Map<number, string>>(() => new Map())

  const linesKey = useMemo(() => lines.map((l) => l.content).join("\n"), [lines])

  useEffect(() => {
    if (lines.length === 0) {
      setHighlightedMap(new Map())
      return
    }

    let cancelled = false

    const highlightAll = async () => {
      try {
        const results = new Map<number, string>()
        for (let i = 0; i < lines.length; i++) {
          const content = lines[i].content || " "
          const highlighted = await highlightCode(content, language, themeId)
          results.set(i, highlighted)
        }
        if (!cancelled) {
          setHighlightedMap(results)
        }
      } catch (error) {
        console.error("[EDIT_MODAL] Failed to highlight code:", error)
        if (!cancelled) {
          setHighlightedMap(new Map())
        }
      }
    }

    const timer = setTimeout(highlightAll, 50)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [linesKey, language, themeId, lines.length])

  return highlightedMap
}

export function EditModalContent({ activity }: EditModalContentProps) {
  const codeTheme = useCodeTheme()
  const { input, output } = useMemo(() => parseActivityData(activity), [activity])
  const isWriteMode = activity.toolName === "Write"

  const filePath = input.file_path || ""
  const filename = filePath ? filePath.split("/").pop() || "file" : ""
  const language = filename ? getLanguageFromFilename(filename) : "plaintext"

  // Get clean display path
  const displayPath = useMemo(() => {
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
  }, [filePath])

  // Build diff lines
  const diffLines = useMemo(() => {
    if (isWriteMode) {
      const content = input.content || output.content || ""
      if (!content) return []
      return content.split("\n").map((line: string) => ({
        type: "added" as const,
        content: line,
      }))
    }
    if (output.structuredPatch) {
      return getDiffLines(output.structuredPatch)
    }
    // Fallback to new_string preview
    if (input.new_string) {
      return input.new_string.split("\n").map((line: string) => ({
        type: "added" as const,
        content: line,
      }))
    }
    return []
  }, [isWriteMode, input, output])

  // Calculate stats
  const diffStats = useMemo(() => {
    if (isWriteMode) {
      const content = input.content || output.content || ""
      const added = content ? content.split("\n").length : 0
      return { added, removed: 0 }
    }
    return calculateDiffStats(output.structuredPatch)
  }, [isWriteMode, input, output])

  // Highlight all lines
  const highlightedMap = useBatchHighlight(diffLines, language, codeTheme)

  const FileIcon = filename ? getFileIconByExtension(filename, true) : null

  return (
    <div className="space-y-3">
      {/* File header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {FileIcon && <FileIcon className="w-4 h-4 text-muted-foreground" />}
          <div>
            <div className="font-medium text-sm">{filename}</div>
            <div className="text-xs text-muted-foreground font-mono">{displayPath}</div>
          </div>
        </div>

        {/* Diff stats */}
        {diffStats && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600 dark:text-green-400">+{diffStats.added}</span>
            {diffStats.removed > 0 && (
              <span className="text-red-600 dark:text-red-400">-{diffStats.removed}</span>
            )}
          </div>
        )}
      </div>

      {/* Diff content */}
      {diffLines.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto font-mono text-xs">
            {diffLines.map((line, idx) => (
              <div
                key={idx}
                className={cn(
                  "px-3 py-0.5",
                  line.type === "removed" &&
                    "bg-red-500/10 dark:bg-red-500/15 border-l-2 border-red-500/50",
                  line.type === "added" &&
                    "bg-green-500/10 dark:bg-green-500/15 border-l-2 border-green-500/50",
                  line.type === "context" && "border-l-2 border-transparent",
                )}
              >
                {highlightedMap.get(idx) ? (
                  <span
                    className="whitespace-pre-wrap break-all [&_.shiki]:bg-transparent [&_pre]:bg-transparent [&_code]:bg-transparent"
                    dangerouslySetInnerHTML={{ __html: highlightedMap.get(idx)! }}
                  />
                ) : (
                  <span
                    className={cn(
                      "whitespace-pre-wrap break-all",
                      line.type === "removed" && "text-red-700 dark:text-red-300",
                      line.type === "added" && "text-green-700 dark:text-green-300",
                      line.type === "context" && "text-muted-foreground",
                    )}
                  >
                    {line.content || " "}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground italic">
          No diff data available
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

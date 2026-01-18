"use client"

import { useState } from "react"
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "../../../components/ui/button"
import { type ToolActivity } from "../../../lib/atoms"
import { cn } from "../../../lib/utils"

interface DefaultModalContentProps {
  activity: ToolActivity
}

interface CollapsibleJsonProps {
  title: string
  json: string | null
  defaultExpanded?: boolean
  maxHeight?: string
}

function CollapsibleJson({ title, json, defaultExpanded = true, maxHeight = "250px" }: CollapsibleJsonProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)

  if (!json) {
    return null
  }

  // Try to parse and pretty-print
  let formatted = json
  try {
    const parsed = JSON.parse(json)
    formatted = JSON.stringify(parsed, null, 2)
  } catch {
    // Keep original if not valid JSON
  }

  const isTruncated = formatted.includes("... (truncated)")

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">{title}</span>
        </div>
        {isExpanded && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              handleCopy()
            }}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-border">
          <pre
            className="p-3 text-xs font-mono overflow-auto whitespace-pre-wrap break-all"
            style={{ maxHeight }}
          >
            {formatted}
          </pre>
          {isTruncated && (
            <div className="px-3 pb-2 text-xs text-muted-foreground italic">
              Output was truncated (exceeds 50KB limit)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DefaultModalContent({ activity }: DefaultModalContentProps) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div>
        <h4 className="text-sm font-medium mb-1">Summary</h4>
        <div className="text-sm text-muted-foreground">
          {activity.summary}
        </div>
      </div>

      {/* Input */}
      <CollapsibleJson
        title="Input"
        json={activity.input}
        defaultExpanded={true}
      />

      {/* Output or Error */}
      {activity.state === "error" && activity.errorText ? (
        <div>
          <h4 className="text-sm font-medium mb-2 text-destructive">Error</h4>
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive whitespace-pre-wrap">
            {activity.errorText}
          </div>
        </div>
      ) : activity.output ? (
        <CollapsibleJson
          title="Output"
          json={activity.output}
          defaultExpanded={true}
        />
      ) : activity.state === "running" ? (
        <div>
          <h4 className="text-sm font-medium mb-2">Output</h4>
          <div className="text-muted-foreground text-sm italic">
            Tool is still running...
          </div>
        </div>
      ) : null}
    </div>
  )
}

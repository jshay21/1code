"use client"

import { memo, useMemo } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip"
import { cn } from "../../../lib/utils"
import type { AgentMessageMetadata } from "./agent-message-usage"

// Default Claude model context windows (can be overridden by SDK)
const DEFAULT_CONTEXT_WINDOW = 200_000

interface AgentContextIndicatorProps {
  messages: Array<{ metadata?: AgentMessageMetadata }>
  contextWindow?: number
  className?: string
  onCompact?: () => void
  isCompacting?: boolean
  disabled?: boolean
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}

// Circular progress component
function CircularProgress({
  percent,
  size = 18,
  strokeWidth = 2,
  className,
}: {
  percent: number
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <svg
      width={size}
      height={size}
      className={cn("transform -rotate-90", className)}
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted-foreground/20"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-300 text-muted-foreground/60"
      />
    </svg>
  )
}

export const AgentContextIndicator = memo(function AgentContextIndicator({
  messages,
  contextWindow: contextWindowProp,
  className,
  onCompact,
  isCompacting,
  disabled,
}: AgentContextIndicatorProps) {
  // Calculate context usage from most recent API call
  // For new messages: Use modelUsage data which includes full context with caching
  // For old messages: Estimate context from accumulated conversation tokens
  const contextUsage = useMemo(() => {
    let currentContextTokens = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCostUsd = 0

    // Sum all tokens for cost/usage tracking
    for (const msg of messages) {
      if (msg.metadata) {
        totalInputTokens += msg.metadata.inputTokens || 0
        totalOutputTokens += msg.metadata.outputTokens || 0
        totalCostUsd += msg.metadata.totalCostUsd || 0
      }
    }

    // Find the most recent message with metadata (represents current conversation state)
    let foundMessageIndex = -1
    let foundMeta: any = null
    for (let i = messages.length - 1; i >= 0; i--) {
      const meta = messages[i].metadata
      if (meta?.inputTokens) {
        foundMessageIndex = i
        foundMeta = meta
        break
      }
    }

    let metadataContextWindow: number | undefined

    if (foundMeta) {
      // The inputTokens from modelUsage represents the actual context sent to the API
      // Cache tokens are for billing tracking, not context size
      currentContextTokens = foundMeta.inputTokens || 0
      metadataContextWindow = foundMeta.contextWindow
    }

    // Debug logging for context tracking
    console.log('[CONTEXT_INDICATOR] Context calculation:', {
      messagesCount: messages.length,
      foundMessageIndex,
      foundMetadata: foundMeta ? {
        input: foundMeta.inputTokens,
        cacheRead: foundMeta.cacheReadInputTokens,
        cacheCreation: foundMeta.cacheCreationInputTokens,
        contextWindow: foundMeta.contextWindow,
      } : 'not found',
      currentContextTokens,
      metadataContextWindow,
    })

    return {
      currentContextTokens,
      metadataContextWindow,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
    }
  }, [messages])

  // Use context window from: prop > metadata > default
  const contextWindow = contextWindowProp || contextUsage.metadataContextWindow || DEFAULT_CONTEXT_WINDOW
  const percentUsed = Math.min(
    100,
    (contextUsage.currentContextTokens / contextWindow) * 100,
  )

  const isEmpty = contextUsage.currentContextTokens === 0

  const isClickable = onCompact && !disabled && !isCompacting

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div
          onClick={isClickable ? onCompact : undefined}
          className={cn(
            "h-4 w-4 flex items-center justify-center",
            isClickable
              ? "cursor-pointer hover:opacity-70 transition-opacity"
              : "cursor-default",
            disabled && "opacity-50",
            className,
          )}
        >
          <CircularProgress
            percent={percentUsed}
            size={14}
            strokeWidth={2.5}
            className={isCompacting ? "animate-pulse" : undefined}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        <p className="text-xs">
          {isEmpty ? (
            <span className="text-muted-foreground">
              Context: 0 / {formatTokens(contextWindow)}
            </span>
          ) : (
            <>
              <span className="font-mono font-medium text-foreground">
                {percentUsed.toFixed(1)}%
              </span>
              <span className="text-muted-foreground mx-1">·</span>
              <span className="text-muted-foreground">
                {formatTokens(contextUsage.currentContextTokens)} /{" "}
                {formatTokens(contextWindow)} context
              </span>
            </>
          )}
        </p>
      </TooltipContent>
    </Tooltip>
  )
})

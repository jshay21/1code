import type { ChangedFile } from "../../../shared/changes-types"
import { getBundledClaudeBinaryPath, buildClaudeEnv } from "../claude/env"
import { getClaudeCodeToken } from "../claude/token"

const MAX_DIFF_LENGTH = 4000

/**
 * Generate commit message using Claude Code SDK
 * Uses OAuth token from local storage (same as chat system)
 */
export async function generateCommitMessageWithSDK(options: {
	stagedFiles: ChangedFile[]
	diffContent: string
	worktreePath: string
}): Promise<string> {
	console.log("[AI_COMMIT_SDK] Generating commit message using Claude Code SDK")

	// Get OAuth token from encrypted storage
	const claudeCodeToken = getClaudeCodeToken()
	if (!claudeCodeToken) {
		throw new Error("Claude Code not connected. Please connect in Settings.")
	}

	// Build prompt with explicit instruction for commit message only
	const userPrompt = buildCommitPrompt(options.stagedFiles, options.diffContent)
	console.log("[AI_COMMIT_SDK] Built prompt, length:", userPrompt.length)

	// Build environment with OAuth token
	const claudeEnv = buildClaudeEnv()
	const finalEnv = {
		...claudeEnv,
		CLAUDE_CODE_OAUTH_TOKEN: claudeCodeToken,
	}

	// Dynamic import for ESM module
	const { query } = await import("@anthropic-ai/claude-agent-sdk")

	// Get bundled Claude binary path
	const claudeBinaryPath = getBundledClaudeBinaryPath()

	console.log("[AI_COMMIT_SDK] Binary path:", claudeBinaryPath)
	console.log("[AI_COMMIT_SDK] Working directory:", options.worktreePath)

	// Capture stderr for debugging
	const stderrLines: string[] = []

	// Create abort controller with timeout
	const abortController = new AbortController()
	const timeoutId = setTimeout(() => {
		console.error("[AI_COMMIT_SDK] Timeout after 30 seconds")
		abortController.abort()
	}, 30000)

	try {
		// Invoke SDK with minimal options (text-only, no tools)
		const queryOptions = {
			prompt: userPrompt,
			options: {
				abortController,
				cwd: options.worktreePath,
				env: finalEnv,
				pathToClaudeCodeExecutable: claudeBinaryPath,
				permissionMode: "plan" as const, // Read-only mode, no tool execution
				model: "haiku", // Haiku 4.5 - fast and cheap for commit messages
				systemPrompt: {
					type: "custom" as const,
					text: "You generate git commit messages. Output ONLY the commit message with no preamble. Format: type(scope): description on first line, then blank line, then bullet points. Never explain what you're doing.",
				},
				settingSources: ["user"] as const, // Don't read project config
				includePartialMessages: true, // Get partial messages for streaming
				stderr: (data: string) => {
					stderrLines.push(data)
					console.error("[AI_COMMIT_SDK stderr]", data)
				},
			},
		}

		const stream = await query(queryOptions)
		console.log("[AI_COMMIT_SDK] Stream created, waiting for messages...")

		// Collect response text
		let commitMessage = ""

		try {
			for await (const msg of stream) {
				console.log("[AI_COMMIT_SDK] Received message type:", msg.type)

				// Handle errors
				if (msg.type === "error") {
					const errorMsg = (msg as any).error || "Unknown SDK error"
					console.error("[AI_COMMIT_SDK] SDK error:", errorMsg)
					const stderrOutput = stderrLines.join("\n")
					throw new Error(
						stderrOutput
							? `Failed to generate commit message: ${errorMsg}\n\nProcess output:\n${stderrOutput}`
							: `Failed to generate commit message: ${errorMsg}`,
					)
				}

				// Collect text from assistant messages (direct type)
				if (msg.type === "assistant") {
					const assistantMsg = msg as any
					if (assistantMsg.message?.content) {
						for (const block of assistantMsg.message.content) {
							if (block.type === "text") {
								console.log("[AI_COMMIT_SDK] Collecting text:", block.text)
								commitMessage += block.text
							}
						}
					}
				}

				// Also handle wrapped message type
				if (msg.type === "message" && (msg as any).message?.role === "assistant") {
					for (const block of (msg as any).message.content) {
						if (block.type === "text") {
							console.log("[AI_COMMIT_SDK] Collecting text:", block.text)
							commitMessage += block.text
						}
					}
				}
			}
		} catch (streamError) {
			// Catch streaming errors (like process exit)
			const err = streamError as Error
			const stderrOutput = stderrLines.join("\n")

			console.error("[AI_COMMIT_SDK] Streaming error:", err.message)
			if (stderrOutput) {
				console.error("[AI_COMMIT_SDK] stderr output:", stderrOutput)
			}

			// Re-throw with stderr context
			throw new Error(
				stderrOutput
					? `Claude Code process error: ${err.message}\n\nProcess output:\n${stderrOutput}`
					: `Claude Code process error: ${err.message}`,
			)
		}

		// Extract conventional commit message (header + optional body)
		// Format: type(scope): description followed by optional bullet points
		const conventionalCommitRegex =
			/\b(feat|fix|refactor|docs|style|test|chore|perf|ci|build|revert)(\([^)]+\))?:\s*[^\n]+/i

		const lines = commitMessage.split("\n")
		let cleanedMessage = ""
		let headerFound = false
		let bodyLines: string[] = []

		for (const line of lines) {
			const trimmed = line.trim()
			const lower = trimmed.toLowerCase()

			// Skip preamble lines before finding the header
			if (!headerFound) {
				if (
					lower.startsWith("here is") ||
					lower.startsWith("here's") ||
					lower.startsWith("based on") ||
					lower.startsWith("i'll help") ||
					lower.startsWith("i need") ||
					lower.startsWith("let me") ||
					lower.startsWith("i will") ||
					lower.startsWith("now i") ||
					lower.startsWith("this commit") ||
					trimmed.length === 0
				) {
					continue
				}

				// Check if this line is a conventional commit header
				if (conventionalCommitRegex.test(trimmed)) {
					cleanedMessage = trimmed
					headerFound = true
					continue
				}
			} else {
				// After header, collect body lines (bullet points or blank lines)
				if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
					bodyLines.push(trimmed)
				} else if (trimmed.length === 0 && bodyLines.length > 0) {
					// Stop at second blank line after body starts
					break
				} else if (trimmed.length === 0) {
					// First blank line after header - continue to body
					continue
				} else if (
					lower.startsWith("this commit") ||
					lower.startsWith("the implementation") ||
					lower.startsWith("this change")
				) {
					// Stop at explanatory text after bullet points
					break
				}
			}
		}

		// Combine header and body
		if (headerFound && bodyLines.length > 0) {
			cleanedMessage = cleanedMessage + "\n\n" + bodyLines.join("\n")
		}

		// Remove markdown formatting, quotes, and backticks
		cleanedMessage = cleanedMessage
			.replace(/\*\*/g, "") // Remove bold markdown
			.replace(/^["'`]|["'`]$/g, "") // Remove quotes/backticks at start/end
			.replace(/`([^`]+)`/g, "$1") // Remove inline code backticks
			.trim()

		console.log("[AI_COMMIT_SDK] Extracted commit message:", cleanedMessage)

		if (!cleanedMessage) {
			const stderrOutput = stderrLines.join("\n")
			throw new Error(
				stderrOutput
					? `Claude returned empty commit message\n\nProcess output:\n${stderrOutput}`
					: "Claude returned empty commit message",
			)
		}

		console.log("[AI_COMMIT_SDK] Generated commit message:", cleanedMessage)
		return cleanedMessage
	} finally {
		clearTimeout(timeoutId)
	}
}

/**
 * Build commit message prompt from staged files and diff
 * (Reused from original implementation)
 */
function buildCommitPrompt(files: ChangedFile[], diff: string): string {
	const fileList = files
		.map((f) => `- ${f.path} (${f.status}, +${f.additions}, -${f.deletions})`)
		.join("\n")

	const truncatedDiff =
		diff.length > MAX_DIFF_LENGTH ? diff.slice(0, MAX_DIFF_LENGTH) + "\n... (truncated)" : diff

	return `FILES CHANGED:
${fileList}

DIFF:
${truncatedDiff}

Write a conventional commit message with:
1. First line: type(scope): short description (max 72 chars)
2. Blank line
3. Body: 2-4 bullet points explaining the key changes

Format example:
feat(auth): add OAuth2 login flow

- Implement token refresh mechanism
- Add secure storage for credentials
- Handle session expiration gracefully

Output ONLY the commit message, no other text.`
}

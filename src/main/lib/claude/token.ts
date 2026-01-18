import { eq } from "drizzle-orm"
import { safeStorage } from "electron"
import { claudeCodeCredentials, getDatabase } from "../db"

/**
 * Decrypt token using Electron's safeStorage
 */
export function decryptToken(encrypted: string): string {
	if (!safeStorage.isEncryptionAvailable()) {
		return Buffer.from(encrypted, "base64").toString("utf-8")
	}
	const buffer = Buffer.from(encrypted, "base64")
	return safeStorage.decryptString(buffer)
}

/**
 * Get Claude Code OAuth token from local SQLite
 * Returns null if not connected
 */
export function getClaudeCodeToken(): string | null {
	try {
		const db = getDatabase()
		const cred = db
			.select()
			.from(claudeCodeCredentials)
			.where(eq(claudeCodeCredentials.id, "default"))
			.get()

		if (!cred?.oauthToken) {
			return null
		}
		return decryptToken(cred.oauthToken)
	} catch {
		return null
	}
}

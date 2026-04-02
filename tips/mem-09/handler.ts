import { createSubsystemLogger } from "openclaw/subsystem";
import { resolveStateDir } from "openclaw/paths";
import { resolveAgentIdFromSessionKey } from "openclaw/session-key";
import { resolveAgentWorkspaceDir } from "openclaw/agent-scope";
import { updateSessionStore } from "openclaw/config/sessions";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

const log = createSubsystemLogger("hooks/delete-session-on-new");

/**
 * Delete the previous session entry when /new is issued.
 *
 * The old transcript is archived instead of hard-deleted so the reset stays
 * reversible if you need to inspect the previous session later.
 */
const deleteSessionOnNew = async (event) => {
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  try {
    const context = event.context || {};
    const cfg = context.cfg;

    if (!cfg) {
      log.warn("No config in context, skipping delete-session-on-new hook");
      return;
    }

    const previousEntry = context.previousSessionEntry;
    if (!previousEntry?.sessionId) {
      log.debug("No previous session entry found, nothing to delete");
      return;
    }

    const sessionKey = event.sessionKey;
    const sessionId = previousEntry.sessionId;
    const agentId = resolveAgentIdFromSessionKey(sessionKey);
    const workspaceDir =
      typeof context.workspaceDir === "string" && context.workspaceDir.trim()
        ? context.workspaceDir
        : resolveAgentWorkspaceDir(cfg, agentId) ||
          path.join(resolveStateDir(process.env, os.homedir()), "workspace");

    const sessionsDir = path.join(workspaceDir, "sessions");
    const storePath = path.join(sessionsDir, "sessions.json");

    log.info(`Cleaning up previous session on /new: ${sessionKey}`);

    const deleted = await updateSessionStore(storePath, (store) => {
      const hadEntry = Boolean(store[sessionKey]);
      if (hadEntry) {
        delete store[sessionKey];
      }
      return hadEntry;
    });

    if (!deleted) {
      log.debug(`Session entry not found in store: ${sessionKey}`);
      return;
    }

    const sessionFile = previousEntry.sessionFile;
    if (sessionFile) {
      try {
        const transcriptPath = sessionFile.startsWith("/")
          ? sessionFile
          : path.join(sessionsDir, sessionFile);

        await fs.access(transcriptPath);

        const archiveDir = path.join(sessionsDir, "archive");
        await fs.mkdir(archiveDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const archivePath = path.join(
          archiveDir,
          `${sessionId}.${timestamp}.jsonl`,
        );

        await fs.rename(transcriptPath, archivePath);
        log.info(`Archived transcript: ${archivePath}`);
      } catch (archiveErr) {
        log.warn("Failed to archive transcript", {
          error: String(archiveErr),
        });
      }
    }

    if (Array.isArray(event.messages)) {
      event.messages.push(`🗑️ Previous session cleaned up: ${sessionKey}`);
    }
  } catch (err) {
    log.error("Failed to clean up previous session on /new", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
};

export default deleteSessionOnNew;

/**
 * Remote Questions — /gsd remote command
 *
 * Interactive wizard for configuring Slack/Discord as a remote question channel.
 * Follows the patterns from wizard.ts and gsd/commands.ts.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { CURSOR_MARKER, Editor, type EditorTheme, Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { resolveRemoteConfig, getRemoteConfigStatus } from "./config.js";
import { loadEffectiveGSDPreferences, getGlobalGSDPreferencesPath } from "../gsd/preferences.js";

// ─── Public ──────────────────────────────────────────────────────────────────

export async function handleRemote(
  subcommand: string,
  ctx: ExtensionCommandContext,
  _pi: ExtensionAPI,
): Promise<void> {
  const trimmed = subcommand.trim();

  if (trimmed === "slack") {
    await handleSetupSlack(ctx);
    return;
  }

  if (trimmed === "discord") {
    await handleSetupDiscord(ctx);
    return;
  }

  if (trimmed === "status") {
    await handleRemoteStatus(ctx);
    return;
  }

  if (trimmed === "disconnect") {
    await handleDisconnect(ctx);
    return;
  }

  // Default: show current status and guide
  await handleRemoteMenu(ctx);
}

// ─── Setup Slack ─────────────────────────────────────────────────────────────

async function handleSetupSlack(ctx: ExtensionCommandContext): Promise<void> {
  // Step 1: Collect token
  const token = await promptMaskedInput(ctx, "Slack Bot Token", "Paste your xoxb-... token");
  if (!token) {
    ctx.ui.notify("Slack setup cancelled.", "info");
    return;
  }

  if (!token.startsWith("xoxb-")) {
    ctx.ui.notify("Invalid token format — Slack bot tokens start with xoxb-. Setup cancelled.", "warning");
    return;
  }

  // Step 2: Validate token
  ctx.ui.notify("Validating token...", "info");
  let botInfo: { ok: boolean; user?: string; team?: string; user_id?: string };
  try {
    const res = await fetch("https://slack.com/api/auth.test", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    botInfo = (await res.json()) as typeof botInfo;
  } catch (err) {
    ctx.ui.notify(`Network error validating token: ${(err as Error).message}`, "error");
    return;
  }

  if (!botInfo.ok) {
    ctx.ui.notify("Token validation failed — check that the token is correct and the app is installed.", "error");
    return;
  }

  ctx.ui.notify(`Token valid — bot: ${botInfo.user}, workspace: ${botInfo.team}`, "info");

  // Step 3: Collect channel ID
  const channelId = await promptInput(ctx, "Channel ID", "Paste the Slack channel ID (e.g. C0123456789)");
  if (!channelId) {
    ctx.ui.notify("Slack setup cancelled.", "info");
    return;
  }

  // Step 4: Send test message
  ctx.ui.notify("Sending test message...", "info");
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: channelId,
        text: "GSD remote questions connected! This channel will receive questions during auto-mode.",
      }),
    });
    const result = (await res.json()) as { ok: boolean; error?: string };
    if (!result.ok) {
      ctx.ui.notify(`Could not send to channel: ${result.error}. Make sure the bot is invited to the channel.`, "error");
      return;
    }
  } catch (err) {
    ctx.ui.notify(`Network error sending test message: ${(err as Error).message}`, "error");
    return;
  }

  // Step 5: Save configuration
  saveTokenToAuth("slack_bot", token);
  process.env.SLACK_BOT_TOKEN = token;
  saveRemoteQuestionsConfig("slack", channelId);

  ctx.ui.notify(`Slack connected — questions will arrive in channel ${channelId} during /gsd auto`, "info");
}

// ─── Setup Discord ───────────────────────────────────────────────────────────

async function handleSetupDiscord(ctx: ExtensionCommandContext): Promise<void> {
  // Step 1: Collect token
  const token = await promptMaskedInput(ctx, "Discord Bot Token", "Paste your bot token");
  if (!token) {
    ctx.ui.notify("Discord setup cancelled.", "info");
    return;
  }

  // Step 2: Validate token
  ctx.ui.notify("Validating token...", "info");
  let botInfo: { id?: string; username?: string };
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) {
      ctx.ui.notify(`Token validation failed (HTTP ${res.status}) — check that the token is correct.`, "error");
      return;
    }
    botInfo = (await res.json()) as typeof botInfo;
  } catch (err) {
    ctx.ui.notify(`Network error validating token: ${(err as Error).message}`, "error");
    return;
  }

  ctx.ui.notify(`Token valid — bot: ${botInfo.username}`, "info");

  // Step 3: Collect channel ID
  const channelId = await promptInput(ctx, "Channel ID", "Paste the Discord channel ID (e.g. 1234567890123456789)");
  if (!channelId) {
    ctx.ui.notify("Discord setup cancelled.", "info");
    return;
  }

  // Step 4: Send test message
  ctx.ui.notify("Sending test message...", "info");
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "GSD remote questions connected! This channel will receive questions during auto-mode.",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      ctx.ui.notify(`Could not send to channel (HTTP ${res.status}): ${body}. Make sure the bot has access.`, "error");
      return;
    }
  } catch (err) {
    ctx.ui.notify(`Network error sending test message: ${(err as Error).message}`, "error");
    return;
  }

  // Step 5: Save configuration
  saveTokenToAuth("discord_bot", token);
  process.env.DISCORD_BOT_TOKEN = token;
  saveRemoteQuestionsConfig("discord", channelId);

  ctx.ui.notify(`Discord connected — questions will arrive in channel ${channelId} during /gsd auto`, "info");
}

// ─── Status ──────────────────────────────────────────────────────────────────

async function handleRemoteStatus(ctx: ExtensionCommandContext): Promise<void> {
  const config = resolveRemoteConfig();

  if (!config) {
    ctx.ui.notify(getRemoteConfigStatus(), "info");
    return;
  }

  // Test the connection
  ctx.ui.notify("Checking connection...", "info");

  try {
    if (config.channel === "slack") {
      const res = await fetch("https://slack.com/api/auth.test", {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      const data = (await res.json()) as { ok: boolean; user?: string; team?: string };
      if (data.ok) {
        ctx.ui.notify(
          `Remote questions: Slack connected\n  Bot: ${data.user}\n  Workspace: ${data.team}\n  Channel: ${config.channelId}\n  Timeout: ${config.timeoutMs / 60000}m, poll: ${config.pollIntervalMs / 1000}s`,
          "info",
        );
      } else {
        ctx.ui.notify("Remote questions: Slack token invalid — run /gsd remote slack to reconfigure", "warning");
      }
    } else if (config.channel === "discord") {
      const res = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bot ${config.token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { username?: string };
        ctx.ui.notify(
          `Remote questions: Discord connected\n  Bot: ${data.username}\n  Channel: ${config.channelId}\n  Timeout: ${config.timeoutMs / 60000}m, poll: ${config.pollIntervalMs / 1000}s`,
          "info",
        );
      } else {
        ctx.ui.notify("Remote questions: Discord token invalid — run /gsd remote discord to reconfigure", "warning");
      }
    }
  } catch (err) {
    ctx.ui.notify(`Remote questions: connection check failed — ${(err as Error).message}`, "error");
  }
}

// ─── Disconnect ──────────────────────────────────────────────────────────────

async function handleDisconnect(ctx: ExtensionCommandContext): Promise<void> {
  const prefs = loadEffectiveGSDPreferences();
  if (!prefs?.preferences.remote_questions) {
    ctx.ui.notify("No remote channel configured — nothing to disconnect.", "info");
    return;
  }

  const channel = prefs.preferences.remote_questions.channel;

  // Remove from preferences file
  removeRemoteQuestionsConfig();

  // Remove token from auth storage
  const provider = channel === "slack" ? "slack_bot" : "discord_bot";
  removeTokenFromAuth(provider);

  // Clear env
  if (channel === "slack") delete process.env.SLACK_BOT_TOKEN;
  if (channel === "discord") delete process.env.DISCORD_BOT_TOKEN;

  ctx.ui.notify(`Remote questions disconnected (${channel}).`, "info");
}

// ─── Menu ────────────────────────────────────────────────────────────────────

async function handleRemoteMenu(ctx: ExtensionCommandContext): Promise<void> {
  const config = resolveRemoteConfig();

  if (config) {
    ctx.ui.notify(
      `Remote questions: ${config.channel} (channel ${config.channelId})\n` +
        `  Timeout: ${config.timeoutMs / 60000}m, poll interval: ${config.pollIntervalMs / 1000}s\n\n` +
        `Commands:\n` +
        `  /gsd remote status      — test connection\n` +
        `  /gsd remote disconnect  — remove configuration\n` +
        `  /gsd remote slack       — reconfigure with Slack\n` +
        `  /gsd remote discord     — reconfigure with Discord`,
      "info",
    );
  } else {
    ctx.ui.notify(
      `No remote question channel configured.\n\n` +
        `Commands:\n` +
        `  /gsd remote slack    — set up Slack bot\n` +
        `  /gsd remote discord  — set up Discord bot\n` +
        `  /gsd remote status   — check configuration`,
      "info",
    );
  }
}

// ─── Input helpers ───────────────────────────────────────────────────────────

function maskEditorLine(line: string): string {
  let output = "";
  let i = 0;
  while (i < line.length) {
    if (line.startsWith(CURSOR_MARKER, i)) {
      output += CURSOR_MARKER;
      i += CURSOR_MARKER.length;
      continue;
    }
    const ansiMatch = /^\x1b\[[0-9;]*m/.exec(line.slice(i));
    if (ansiMatch) {
      output += ansiMatch[0];
      i += ansiMatch[0].length;
      continue;
    }
    const ch = line[i] as string;
    output += ch === " " ? " " : "*";
    i += 1;
  }
  return output;
}

async function promptMaskedInput(
  ctx: ExtensionCommandContext,
  label: string,
  hint: string,
): Promise<string | null> {
  if (!ctx.hasUI) return null;

  return ctx.ui.custom<string | null>((tui: any, theme: any, _kb: any, done: (r: string | null) => void) => {
    let cachedLines: string[] | undefined;
    const editorTheme: EditorTheme = {
      borderColor: (s: string) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (t: string) => theme.fg("accent", t),
        selectedText: (t: string) => theme.fg("accent", t),
        description: (t: string) => theme.fg("muted", t),
        scrollInfo: (t: string) => theme.fg("dim", t),
        noMatch: (t: string) => theme.fg("warning", t),
      },
    };
    const editor = new Editor(tui, editorTheme, { paddingX: 1 });

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function handleInput(data: string): void {
      if (matchesKey(data, Key.enter)) {
        const value = editor.getText().trim();
        done(value.length > 0 ? value : null);
        return;
      }
      if (matchesKey(data, Key.escape)) {
        done(null);
        return;
      }
      editor.handleInput(data);
      refresh();
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;
      const lines: string[] = [];
      const add = (s: string) => lines.push(truncateToWidth(s, width));
      add(theme.fg("accent", "\u2500".repeat(width)));
      add(theme.fg("accent", theme.bold(` ${label}`)));
      add(theme.fg("muted", `  ${hint}`));
      lines.push("");
      add(theme.fg("muted", " Enter value:"));
      for (const line of editor.render(width - 2)) {
        add(theme.fg("text", maskEditorLine(line)));
      }
      lines.push("");
      add(theme.fg("dim", ` enter to confirm  |  esc to cancel`));
      add(theme.fg("accent", "\u2500".repeat(width)));
      cachedLines = lines;
      return lines;
    }

    return { render, handleInput, invalidate: () => { cachedLines = undefined; } };
  });
}

async function promptInput(
  ctx: ExtensionCommandContext,
  label: string,
  hint: string,
): Promise<string | null> {
  if (!ctx.hasUI) return null;

  return ctx.ui.custom<string | null>((tui: any, theme: any, _kb: any, done: (r: string | null) => void) => {
    let cachedLines: string[] | undefined;
    const editorTheme: EditorTheme = {
      borderColor: (s: string) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (t: string) => theme.fg("accent", t),
        selectedText: (t: string) => theme.fg("accent", t),
        description: (t: string) => theme.fg("muted", t),
        scrollInfo: (t: string) => theme.fg("dim", t),
        noMatch: (t: string) => theme.fg("warning", t),
      },
    };
    const editor = new Editor(tui, editorTheme, { paddingX: 1 });

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function handleInput(data: string): void {
      if (matchesKey(data, Key.enter)) {
        const value = editor.getText().trim();
        done(value.length > 0 ? value : null);
        return;
      }
      if (matchesKey(data, Key.escape)) {
        done(null);
        return;
      }
      editor.handleInput(data);
      refresh();
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;
      const lines: string[] = [];
      const add = (s: string) => lines.push(truncateToWidth(s, width));
      add(theme.fg("accent", "\u2500".repeat(width)));
      add(theme.fg("accent", theme.bold(` ${label}`)));
      add(theme.fg("muted", `  ${hint}`));
      lines.push("");
      add(theme.fg("muted", " Enter value:"));
      for (const line of editor.render(width - 2)) {
        add(theme.fg("text", line));
      }
      lines.push("");
      add(theme.fg("dim", ` enter to confirm  |  esc to cancel`));
      add(theme.fg("accent", "\u2500".repeat(width)));
      cachedLines = lines;
      return lines;
    }

    return { render, handleInput, invalidate: () => { cachedLines = undefined; } };
  });
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

function getAuthFilePath(): string {
  return join(homedir(), ".gsd", "agent", "auth.json");
}

function loadAuthJson(): Record<string, unknown> {
  const path = getAuthFilePath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function saveAuthJson(data: Record<string, unknown>): void {
  const path = getAuthFilePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

function saveTokenToAuth(provider: string, token: string): void {
  const auth = loadAuthJson();
  auth[provider] = { type: "api_key", key: token };
  saveAuthJson(auth);
}

function removeTokenFromAuth(provider: string): void {
  const auth = loadAuthJson();
  delete auth[provider];
  saveAuthJson(auth);
}

function saveRemoteQuestionsConfig(channel: "slack" | "discord", channelId: string): void {
  const prefsPath = getGlobalGSDPreferencesPath();
  let content = "";

  if (existsSync(prefsPath)) {
    content = readFileSync(prefsPath, "utf-8");
  }

  // Check if frontmatter exists
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);

  const remoteBlock = [
    `remote_questions:`,
    `  channel: ${channel}`,
    `  channel_id: "${channelId}"`,
    `  timeout_minutes: 5`,
    `  poll_interval_seconds: 5`,
  ].join("\n");

  if (fmMatch) {
    // Replace existing remote_questions or append to frontmatter
    let fm = fmMatch[1];
    const remoteRegex = /remote_questions:[\s\S]*?(?=\n[a-zA-Z_]|\n---|$)/;
    if (remoteRegex.test(fm)) {
      fm = fm.replace(remoteRegex, remoteBlock);
    } else {
      fm = fm.trimEnd() + "\n" + remoteBlock;
    }
    content = `---\n${fm}\n---` + content.slice(fmMatch[0].length);
  } else {
    // Create new frontmatter
    content = `---\n${remoteBlock}\n---\n\n${content}`;
  }

  mkdirSync(dirname(prefsPath), { recursive: true });
  writeFileSync(prefsPath, content, "utf-8");
}

function removeRemoteQuestionsConfig(): void {
  const prefsPath = getGlobalGSDPreferencesPath();
  if (!existsSync(prefsPath)) return;

  let content = readFileSync(prefsPath, "utf-8");
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return;

  let fm = fmMatch[1];
  // Remove remote_questions block from frontmatter
  fm = fm.replace(/remote_questions:[\s\S]*?(?=\n[a-zA-Z_]|\n---|$)/, "").trim();

  if (fm) {
    content = `---\n${fm}\n---` + content.slice(fmMatch[0].length);
  } else {
    // Frontmatter is now empty, remove it
    content = content.slice(fmMatch[0].length).replace(/^\n+/, "");
  }

  writeFileSync(prefsPath, content, "utf-8");
}

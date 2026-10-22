"use client";

import { supabase } from "@/lib/supabase";

/**
 * The "what the assistant did" activity log for voice-originated writes.
 *
 * Ported from agent-farmer-mobile/src/lib/agent/log.ts, with localStorage in
 * place of AsyncStorage. The design decision worth keeping is this one:
 *
 *   An entry is written by the code that actually RAN a tool, never by the
 *   model narrating what it did.
 *
 * That is what makes a model claiming an action it never took immediately
 * visible — the log and the assistant's speech are two independent sources
 * that either agree or do not.
 *
 * Two copies, written together:
 *   - this localStorage ring, which is fast, always available, and what undo
 *     actually reads; and
 *   - `agent_actions` (migration 027), a durable copy that survives a cleared
 *     browser, a different device, or a support question three weeks later.
 *
 * The remote write is fire-and-forget. Losing it costs an audit trail, never
 * the ability to undo the thing that just happened, so it must not block or
 * fail the local write it rides along with. The remote row is created through
 * the farmer's own RLS-scoped session — there is no service-role path into
 * that table, by design.
 */

export type ActivityEntry = {
  id: string;
  /** epoch ms */
  at: number;
  tool: string;
  args: Record<string, unknown>;
  /** What to show or speak — "Logged ₹2,000 for Fertilizer". */
  summary: string;
  /** What would undo this, or null for a tool with no inverse. */
  inverse: { tool: string; args: Record<string, unknown> } | null;
  undone: boolean;
  /** The agent_actions row id, once the durable write lands. Null if it never did. */
  remoteId: string | null;
};

const KEY = "af_agent_activity_v1";
const MAX_ENTRIES = 200;

/**
 * Every read and write is wrapped: localStorage throws in a private window
 * with site data blocked, and an activity log is never a good enough reason
 * to take the voice assistant down with it.
 */
function load(): ActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: ActivityEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota or blocked storage — the write still happened, only the log is lost */
  }
}

export function recentActions(limit = 20): ActivityEntry[] {
  return load().slice(0, limit);
}

/** The newest entry that can still be undone, or null. */
export function lastUndoable(): ActivityEntry | null {
  return load().find((e) => !e.undone && e.inverse !== null) ?? null;
}

export async function recordAction(input: {
  farmerId: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  inverse: { tool: string; args: Record<string, unknown> } | null;
}): Promise<ActivityEntry> {
  const entry: ActivityEntry = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: Date.now(),
    tool: input.tool,
    args: input.args,
    summary: input.summary,
    inverse: input.inverse,
    undone: false,
    remoteId: null,
  };

  // Local first, and unconditionally: undo must work even with the network
  // gone, because the write it undoes has already happened.
  save([entry, ...load()]);

  try {
    const { data, error } = await supabase
      .from("agent_actions")
      .insert([
        {
          farmer_id: input.farmerId,
          tool: input.tool,
          args: input.args,
          summary: input.summary,
          inverse: input.inverse,
        },
      ])
      .select("id")
      .single();
    if (!error && data?.id) {
      entry.remoteId = data.id as string;
      save(load().map((e) => (e.id === entry.id ? entry : e)));
    }
  } catch {
    /* fire-and-forget, as documented above */
  }

  return entry;
}

export async function markUndone(entryId: string) {
  const entries = load();
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return;
  entry.undone = true;
  save(entries);

  if (!entry.remoteId) return;
  try {
    await supabase.from("agent_actions").update({ undone: true }).eq("id", entry.remoteId);
  } catch {
    /* the local ring is the source of truth for undo */
  }
}

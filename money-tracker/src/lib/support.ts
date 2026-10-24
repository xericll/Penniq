import type { SupabaseClient } from '@supabase/supabase-js';

export type SupportKind = 'problem' | 'request' | 'other';
export const SUPPORT_KINDS: SupportKind[] = ['problem', 'request', 'other'];
export const SUPPORT_MAX_LENGTH = 2000;

/** One message to the team, with the answer once there is one. */
export interface SupportMessage {
  id: string;
  kind: SupportKind;
  message: string;
  status: 'open' | 'answered' | 'closed';
  reply: string | null;
  createdAt: string;
  repliedAt: string | null;
}

interface SupportRow {
  id: string;
  kind: SupportKind;
  message: string;
  status: SupportMessage['status'];
  reply: string | null;
  created_at: string;
  replied_at: string | null;
}

const COLUMNS = 'id, kind, message, status, reply, created_at, replied_at';

function fromRow(row: SupportRow): SupportMessage {
  return {
    id: row.id,
    kind: row.kind,
    message: row.message,
    status: row.status,
    reply: row.reply,
    createdAt: row.created_at,
    repliedAt: row.replied_at,
  };
}

export async function pullSupport(sb: SupabaseClient): Promise<SupportMessage[]> {
  const { data, error } = await sb.from('support_messages').select(COLUMNS).order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return (data as SupportRow[]).map(fromRow);
}

/** Why a message could not be sent, mapped to a translated line by the sheet. */
export type SupportFailure = 'network' | 'limit' | 'unknown';

/** What the device tells the team with a message, so a problem can be reproduced. */
export interface SupportContext {
  version: string;
  lang: string;
  edition: string;
  agent: string;
}

export async function sendSupport(
  sb: SupabaseClient,
  kind: SupportKind,
  message: string,
  context: SupportContext,
): Promise<{ ok: true; message: SupportMessage } | { ok: false; reason: SupportFailure }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, reason: 'network' };
  const { data, error } = await sb.from('support_messages').insert({ kind, message, context }).select(COLUMNS).single();
  if (!error) return { ok: true, message: fromRow(data as SupportRow) };
  // The daily allowance is part of the table's insert policy.
  if (error.code === '42501') return { ok: false, reason: 'limit' };
  return { ok: false, reason: error.code ? 'unknown' : 'network' };
}

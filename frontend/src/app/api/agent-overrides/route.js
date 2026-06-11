/**
 * Agent Override API — Stores agent-to-room overrides locally.
 *
 * GET  /api/agent-overrides           → { overrides: { agentId: { room, defaultRoom, overriddenAt } } }
 * POST /api/agent-overrides           → body: { agentId, room, defaultRoom }  → saves override
 * DELETE via POST with { agentId, _delete: true }  → removes override
 *
 * Storage: JSON file at data/agent-overrides.json (persisted via Docker volume).
 * Falls back to in-memory if file I/O fails.
 *
 * TODO(security): This endpoint has no authentication.
 * In production, it should be protected by session-based auth
 * or an API key. Currently acceptable because the office-client
 * runs on a private NAS accessible only on the local network.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

// Resolve the file path safely — no user input in path construction
const DATA_DIR = path.resolve(process.cwd(), 'data');
const OVERRIDE_FILE = path.join(DATA_DIR, 'agent-overrides.json');

// In-memory fallback
let memoryStore = {};

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Non-fatal — will use in-memory fallback
  }
}

function readOverrides() {
  try {
    ensureDataDir();
    if (fs.existsSync(OVERRIDE_FILE)) {
      const raw = fs.readFileSync(OVERRIDE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        memoryStore = parsed;
      }
    }
  } catch {
    // Use in-memory store
  }
  return { ...memoryStore };
}

function writeOverrides(overrides) {
  memoryStore = { ...overrides };
  try {
    ensureDataDir();
    fs.writeFileSync(OVERRIDE_FILE, JSON.stringify(overrides, null, 2), 'utf-8');
  } catch {
    // Silently fall back to in-memory
  }
}

// ── Validation ──
// Only allow known safe room IDs and agent ID patterns
const VALID_ROOMS = new Set([
  'lobby', 'research', 'desk', 'debate', 'inbox',
  'error', 'tool_bench', 'smoke_break', 'janitor',
]);

const AGENT_ID_PATTERN = /^[A-Za-z0-9_]{1,60}$/;

export async function GET() {
  const overrides = readOverrides();
  return NextResponse.json({ overrides });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { agentId, room, defaultRoom, _delete } = body;

    // Validate agentId format (allow-list pattern)
    if (!agentId || typeof agentId !== 'string' || !AGENT_ID_PATTERN.test(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agentId format' },
        { status: 400 }
      );
    }

    const overrides = readOverrides();

    if (_delete) {
      delete overrides[agentId];
      writeOverrides(overrides);
      return NextResponse.json({ ok: true, action: 'deleted', agentId });
    }

    // Validate room is a known station
    if (!room || !VALID_ROOMS.has(room)) {
      return NextResponse.json(
        { error: `Invalid room: ${String(room).slice(0, 50)}` },
        { status: 400 }
      );
    }

    // Validate defaultRoom if provided
    if (defaultRoom && !VALID_ROOMS.has(defaultRoom)) {
      return NextResponse.json(
        { error: `Invalid defaultRoom: ${String(defaultRoom).slice(0, 50)}` },
        { status: 400 }
      );
    }

    overrides[agentId] = {
      room,
      defaultRoom: defaultRoom || null,
      overriddenAt: new Date().toISOString(),
    };

    writeOverrides(overrides);

    return NextResponse.json({ ok: true, action: 'saved', agentId, room });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CallToolResult,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

// Works both from source (server.ts) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

const MONSTERS_DIR = path.join(import.meta.dirname, "..", "MONSTERS");

interface MonsterStats {
  type: string;
  color: string;
  height: string;
  weight: string;
}

interface Monster {
  id: number;
  name: string;
  title: string;
  stats: MonsterStats;
  bio: string;
  image: string;
}

interface MonstersData {
  monsters: Monster[];
}

// --- Cached data loaders (static files, read once) ---

let monstersCache: MonstersData | null = null;
async function loadMonsters(): Promise<MonstersData> {
  if (!monstersCache) {
    const raw = await fs.readFile(
      path.join(MONSTERS_DIR, "monsters-data.json"),
      "utf-8",
    );
    monstersCache = JSON.parse(raw) as MonstersData;
  }
  return monstersCache;
}

let logoCache: string | null = null;
async function loadLogo(): Promise<string> {
  if (!logoCache) {
    logoCache = await fs.readFile(
      path.join(MONSTERS_DIR, "images", "lil-monsters-logo.svg"),
      "utf-8",
    );
  }
  return logoCache;
}

const imageCache = new Map<string, string>();
async function loadMonsterImage(relativePath: string): Promise<string> {
  let dataUri = imageCache.get(relativePath);
  if (!dataUri) {
    const imageBuffer = await fs.readFile(path.join(MONSTERS_DIR, relativePath));
    dataUri = `data:image/png;base64,${imageBuffer.toString("base64")}`;
    imageCache.set(relativePath, dataUri);
  }
  return dataUri;
}

function findMonsterByName(
  data: MonstersData,
  name: string,
): Monster | undefined {
  return data.monsters.find(
    (m) => m.name.toLowerCase() === name.toLowerCase(),
  );
}

function monsterNotFound(name: string): CallToolResult {
  return {
    content: [{ type: "text", text: `Monster "${name}" not found.` }],
    isError: true,
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Meet The Monsters",
    version: "1.0.0",
  });

  // --- Tool 1: get-monsters (App Tool with UI) ---
  const monstersResourceUri = "ui://meet-the-monsters/mcp-app.html";

  registerAppTool(
    server,
    "get-monsters",
    {
      title: "Get Monsters",
      description:
        "Returns a list of monsters with their names and IDs. Displays an interactive monster gallery.",
      inputSchema: {},
      _meta: { ui: { resourceUri: monstersResourceUri } },
    },
    async (): Promise<CallToolResult> => {
      const [data, logo] = await Promise.all([loadMonsters(), loadLogo()]);
      const names = data.monsters.map((m) => m.name).join(", ");

      return {
        content: [
          {
            type: "text",
            text: `Monsters: ${names}`,
          },
        ],
        structuredContent: {
          monsters: data.monsters.map((m) => ({ id: m.id, name: m.name })),
          logo,
        },
      };
    },
  );

  registerAppResource(
    server,
    monstersResourceUri,
    monstersResourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(
        path.join(DIST_DIR, "mcp-app.html"),
        "utf-8",
      );
      return {
        contents: [
          { uri: monstersResourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  // --- Tool 2: get-monster-stats (consumed inline by gallery UI via callServerTool) ---
  server.registerTool(
    "get-monster-stats",
    {
      title: "Get Monster Stats",
      description:
        "Returns detailed stats and image for a specific monster. This tool is only called from the UI, never by the model.",
      inputSchema: { name: z.string() },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ name }): Promise<CallToolResult> => {
      const data = await loadMonsters();
      const monster = findMonsterByName(data, name);
      if (!monster) return monsterNotFound(name);

      const dataUri = await loadMonsterImage(monster.image);

      return {
        content: [
          {
            type: "text",
            text: `${monster.name} — ${monster.title} | Type: ${monster.stats.type}, Color: ${monster.stats.color}, Height: ${monster.stats.height}, Weight: ${monster.stats.weight}`,
          },
        ],
        structuredContent: {
          name: monster.name,
          title: monster.title,
          stats: monster.stats,
          image: dataUri,
        },
      };
    },
  );

  // --- Tool 3: show-monster-card (App Tool with UI, model-invoked) ---
  const cardResourceUri = "ui://meet-the-monsters/monster-card.html";

  registerAppTool(
    server,
    "show-monster-card",
    {
      title: "Show Monster Card",
      description:
        "Shows a collectible card view for a specific monster with image, bio, and stats. Use this ONLY when the user specifically asks to see a monster card.",
      inputSchema: { name: z.string() },
      _meta: { ui: { resourceUri: cardResourceUri } },
    },
    async ({ name }): Promise<CallToolResult> => {
      const data = await loadMonsters();
      const monster = findMonsterByName(data, name);
      if (!monster) return monsterNotFound(name);

      const dataUri = await loadMonsterImage(monster.image);

      return {
        content: [
          {
            type: "text",
            text: `${monster.name} — ${monster.title} | ${monster.bio}`,
          },
        ],
        structuredContent: {
          name: monster.name,
          title: monster.title,
          bio: monster.bio,
          stats: monster.stats,
          image: dataUri,
        },
      };
    },
  );

  registerAppResource(
    server,
    cardResourceUri,
    cardResourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(
        path.join(DIST_DIR, "monster-card.html"),
        "utf-8",
      );
      return {
        contents: [
          { uri: cardResourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  // --- Tool 4: get-monster-bio (Standard MCP tool, no UI) ---
  server.registerTool(
    "get-monster-bio",
    {
      title: "Get Monster Bio",
      description: "Returns the biography text for a specific monster. Used when the user asks to learn more about the monster.",
      inputSchema: { name: z.string() },
    },
    async ({ name }): Promise<CallToolResult> => {
      const data = await loadMonsters();
      const monster = findMonsterByName(data, name);
      if (!monster) return monsterNotFound(name);

      return {
        content: [{ type: "text", text: monster.bio }],
      };
    },
  );

  return server;
}

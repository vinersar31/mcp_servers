import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./mcp-app.css";

interface MonsterEntry {
  id: number;
  name: string;
}

interface MonstersData {
  monsters: MonsterEntry[];
  logo: string;
}

interface MonsterStats {
  type: string;
  color: string;
  height: string;
  weight: string;
}

interface MonsterDetailData {
  name: string;
  title: string;
  stats: MonsterStats;
  image: string;
}

function extractMonstersData(result: CallToolResult): MonstersData | null {
  const sc = result.structuredContent as MonstersData | undefined;
  if (sc?.monsters) return sc;
  return null;
}

function extractMonsterDetailData(
  result: CallToolResult,
): MonsterDetailData | null {
  const sc = result.structuredContent as MonsterDetailData | undefined;
  if (sc?.name && sc?.stats) return sc;
  return null;
}

function MeetTheMonstersApp() {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error } = useApp({
    appInfo: { name: "Meet The Monsters", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.onteardown = async () => {
        return {};
      };

      app.ontoolresult = async (result) => {
        setToolResult(result);
      };

      app.ontoolcancelled = (params) => {
        console.info("Tool call cancelled:", params.reason);
      };

      app.onerror = console.error;

      app.onhostcontextchanged = (params) => {
        setHostContext((prev) => ({ ...prev, ...params }));
        if (params.theme) applyDocumentTheme(params.theme);
        if (params.styles?.variables) applyHostStyleVariables(params.styles.variables);
        if (params.styles?.css?.fonts) applyHostFonts(params.styles.css.fonts);
      };
    },
  });

  useEffect(() => {
    if (app) {
      const ctx = app.getHostContext();
      setHostContext(ctx);
      if (ctx?.theme) applyDocumentTheme(ctx.theme);
      if (ctx?.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
      if (ctx?.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
    }
  }, [app]);

  if (error) return <div><strong>ERROR:</strong> {error.message}</div>;
  if (!app) return <div>Connecting...</div>;

  return (
    <MonstersInner app={app} toolResult={toolResult} hostContext={hostContext} />
  );
}

interface MonstersInnerProps {
  app: App;
  toolResult: CallToolResult | null;
  hostContext?: McpUiHostContext;
}

function MonstersInner({ app, toolResult, hostContext }: MonstersInnerProps) {
  const [monsters, setMonsters] = useState<MonsterEntry[]>([]);
  const [logo, setLogo] = useState<string>("");
  const [selectedMonster, setSelectedMonster] =
    useState<MonsterDetailData | null>(null);

  const displayMode = (hostContext?.displayMode ?? "inline") as
    | "inline"
    | "fullscreen";

  useEffect(() => {
    if (toolResult) {
      const data = extractMonstersData(toolResult);
      if (data) {
        setMonsters(data.monsters);
        setLogo(data.logo);
      }
    }
  }, [toolResult]);

  const handleMonsterClick = useCallback(
    async (name: string) => {
      try {
        const result = await app.callServerTool({
          name: "get-monster-stats",
          arguments: { name },
        });
        const detail = extractMonsterDetailData(result);
        if (detail) {
          setSelectedMonster(detail);
        }
      } catch (e) {
        console.error("Failed to get monster stats:", e);
      }
    },
    [app],
  );

  const handleBack = useCallback(() => {
    setSelectedMonster(null);
  }, []);

  const handleShowCard = useCallback(async () => {
    if (!selectedMonster) return;
    try {
      await app.sendMessage({
        role: "user",
        content: [
          {
            type: "text",
            text: `Show the monster card for ${selectedMonster.name}`,
          },
        ],
      });
    } catch (e) {
      console.error("Failed to send message:", e);
    }
  }, [app, selectedMonster]);

  const handleToggleDisplay = useCallback(async () => {
    const newMode = displayMode === "fullscreen" ? "inline" : "fullscreen";
    try {
      await app.requestDisplayMode({ mode: newMode });
    } catch (e) {
      console.error("Failed to toggle display mode:", e);
    }
  }, [app, displayMode]);

  const canFullscreen =
    hostContext?.availableDisplayModes?.includes("fullscreen");

  return (
    <main
      className={`monsters-main ${displayMode === "fullscreen" ? "fullscreen" : ""}`}
      style={{
        paddingTop: hostContext?.safeAreaInsets?.top,
        paddingRight: hostContext?.safeAreaInsets?.right,
        paddingBottom: hostContext?.safeAreaInsets?.bottom,
        paddingLeft: hostContext?.safeAreaInsets?.left,
      }}
    >
      {canFullscreen && (
        <button
          className="display-toggle"
          onClick={handleToggleDisplay}
          aria-label={
            displayMode === "fullscreen"
              ? "Exit fullscreen"
              : "Enter fullscreen"
          }
        >
          {displayMode === "fullscreen" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          )}
        </button>
      )}

      {selectedMonster ? (
        <section className="stats-inline" aria-label={`${selectedMonster.name} details`}>
          <img
            className="monster-image"
            src={selectedMonster.image}
            alt={`${selectedMonster.name} illustration`}
          />
          <h1 className="monster-name">{selectedMonster.name}</h1>
          <p className="monster-title">{selectedMonster.title}</p>

          <table className="stats-table" aria-label={`${selectedMonster.name} stats`}>
            <tbody>
              <tr>
                <th scope="row">Type</th>
                <td>{selectedMonster.stats.type}</td>
              </tr>
              <tr>
                <th scope="row">Color</th>
                <td>{selectedMonster.stats.color}</td>
              </tr>
              <tr>
                <th scope="row">Height</th>
                <td>{selectedMonster.stats.height}</td>
              </tr>
              <tr>
                <th scope="row">Weight</th>
                <td>{selectedMonster.stats.weight}</td>
              </tr>
            </tbody>
          </table>

          <div className="stats-actions">
            <button className="back-button" onClick={handleBack}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back
            </button>
            <button className="show-card-button" onClick={handleShowCard}>
              Show Monster Card
            </button>
          </div>
        </section>
      ) : (
        <>
          {logo && (
            <div
              className="logo"
              dangerouslySetInnerHTML={{ __html: logo }}
              aria-label="Lil Monsters logo"
            />
          )}

          {monsters.length === 0 ? (
            <p className="loading-text">Loading monsters...</p>
          ) : (
            <nav aria-label="Monster list">
              <ul className="monster-list" role="list">
                {monsters.map((monster) => (
                  <li key={monster.id}>
                    <button
                      className="monster-button"
                      onClick={() => handleMonsterClick(monster.name)}
                    >
                      {monster.name}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MeetTheMonstersApp />
  </StrictMode>,
);

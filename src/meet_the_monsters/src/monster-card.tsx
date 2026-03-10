import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./monster-card.css";

interface MonsterStats {
  type: string;
  color: string;
  height: string;
  weight: string;
}

interface MonsterCardData {
  name: string;
  title: string;
  bio: string;
  stats: MonsterStats;
  image: string;
}

function extractMonsterCardData(result: CallToolResult): MonsterCardData | null {
  const sc = result.structuredContent as MonsterCardData | undefined;
  if (sc?.name && sc?.stats && sc?.bio) return sc;
  return null;
}

function MonsterCardApp() {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error } = useApp({
    appInfo: { name: "Monster Card", version: "1.0.0" },
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
    <CardInner app={app} toolResult={toolResult} hostContext={hostContext} />
  );
}

interface CardInnerProps {
  app: App;
  toolResult: CallToolResult | null;
  hostContext?: McpUiHostContext;
}

function CardInner({ app, toolResult, hostContext }: CardInnerProps) {
  const [monster, setMonster] = useState<MonsterCardData | null>(null);

  useEffect(() => {
    if (toolResult) {
      const data = extractMonsterCardData(toolResult);
      if (data) {
        setMonster(data);
      }
    }
  }, [toolResult]);

  const handleTellMeMore = useCallback(async () => {
    if (!monster) return;
    try {
      await app.sendMessage({
        role: "user",
        content: [
          { type: "text", text: `Tell me about ${monster.name}` },
        ],
      });
    } catch (e) {
      console.error("Failed to send message:", e);
    }
  }, [app, monster]);

  return (
    <main
      className="card-main"
      style={{
        paddingTop: hostContext?.safeAreaInsets?.top,
        paddingRight: hostContext?.safeAreaInsets?.right,
        paddingBottom: hostContext?.safeAreaInsets?.bottom,
        paddingLeft: hostContext?.safeAreaInsets?.left,
      }}
    >
      {!monster ? (
        <p className="loading-text">Loading monster card...</p>
      ) : (
        <>
          <article className="card" aria-label={`${monster.name} collectible card`}>
            <img
              className="card-image"
              src={monster.image}
              alt={`${monster.name} illustration`}
            />
            <div className="card-body">
              <h1 className="card-name">{monster.name}</h1>
              <p className="card-title">{monster.title}</p>
              <p className="card-bio">{monster.bio}</p>

              <table className="card-stats" aria-label={`${monster.name} stats`}>
                <tbody>
                  <tr>
                    <th scope="row">Type</th>
                    <td>{monster.stats.type}</td>
                  </tr>
                  <tr>
                    <th scope="row">Color</th>
                    <td>{monster.stats.color}</td>
                  </tr>
                  <tr>
                    <th scope="row">Height</th>
                    <td>{monster.stats.height}</td>
                  </tr>
                  <tr>
                    <th scope="row">Weight</th>
                    <td>{monster.stats.weight}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <button className="tell-me-button" onClick={handleTellMeMore}>
            Tell me about {monster.name}
          </button>
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MonsterCardApp />
  </StrictMode>,
);

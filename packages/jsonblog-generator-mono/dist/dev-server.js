import {
  generateBlog
} from "./chunk-JIZF7BP4.js";

// src/dev-server.ts
import express from "express";
import path from "path";
import fs from "fs/promises";
import chokidar from "chokidar";
import WebSocket, { WebSocketServer } from "ws";
var app = express();
var PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : process.env.PORT ? parseInt(process.env.PORT, 10) : 3500;
var wss;
var blogData;
var generatedFiles = /* @__PURE__ */ new Map();
var injectLiveReloadScript = (html) => {
  const script = `
    <script>
      (function() {
        const ws = new WebSocket('ws://localhost:${PORT}');
        ws.onmessage = (event) => {
          if (event.data === 'reload') {
            location.reload();
          }
        };
        ws.onclose = () => {
          setTimeout(() => location.reload(), 1000);
        };
      })();
    </script>
  `;
  return html.replace("</body>", `${script}</body>`);
};
async function loadBlogData() {
  try {
    const blogJsonPath = path.join(process.cwd(), "blog.json");
    const data = await fs.readFile(blogJsonPath, "utf-8");
    blogData = JSON.parse(data);
  } catch (error) {
    console.error("Error loading blog.json:", error);
    throw error;
  }
}
async function generateAndCacheFiles() {
  if (!blogData) return;
  try {
    const files = await generateBlog(blogData, process.cwd());
    generatedFiles.clear();
    for (const file of files) {
      let content = file.content;
      if (file.name.endsWith(".html")) {
        content = injectLiveReloadScript(content);
      }
      generatedFiles.set(file.name, content);
    }
    console.log(`Generated ${files.length} files`);
  } catch (error) {
    console.error("Error generating blog:", error);
  }
}
function notifyClients() {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send("reload");
      }
    });
  }
}
var changeTimeout = null;
async function handleFileChange(filePath) {
  console.log(`File changed: ${filePath}`);
  if (changeTimeout) {
    clearTimeout(changeTimeout);
  }
  changeTimeout = setTimeout(async () => {
    if (filePath.endsWith("blog.json")) {
      await loadBlogData();
    }
    await generateAndCacheFiles();
    notifyClients();
  }, 300);
}
app.get("*", (req, res) => {
  let requestPath = req.path === "/" ? "/index.html" : req.path;
  if (!path.extname(requestPath)) {
    requestPath = `${requestPath}/index.html`;
  }
  const fileName = requestPath.substring(1);
  res.setHeader("Cache-Control", "no-cache");
  if (generatedFiles.has(fileName)) {
    const content = generatedFiles.get(fileName);
    const contentType = fileName.endsWith(".css") ? "text/css" : "text/html";
    res.contentType(contentType).send(content);
  } else {
    res.status(404).send(`
      <html>
        <head><title>404 Not Found</title></head>
        <body>
          <h1>404 Not Found</h1>
          <p>The requested file "${fileName}" was not found.</p>
          <p><a href="/">Go to homepage</a></p>
        </body>
      </html>
    `);
  }
});
async function startDevServer() {
  await loadBlogData();
  await generateAndCacheFiles();
  const server = app.listen(PORT, () => {
    console.log(`
\u{1F680} Development server running at http://localhost:${PORT}`);
    console.log("\u{1F440} Watching for changes...\n");
  });
  wss = new WebSocketServer({ server });
  wss.on("connection", (ws) => {
    ws.on("pong", () => {
    });
  });
  const watcher = chokidar.watch(["blog.json", "src/**/*.ts", "templates/**/*", "assets/**/*"], {
    persistent: true,
    ignoreInitial: true
  });
  watcher.on("change", handleFileChange);
  watcher.on("add", handleFileChange);
  watcher.on("unlink", handleFileChange);
  process.on("SIGINT", () => {
    console.log("\n\u2728 Shutting down development server...");
    watcher.close();
    wss.close();
    server.close();
    process.exit(0);
  });
}
if (import.meta.url === `file://${process.argv[1]}`) {
  startDevServer().catch(console.error);
}
export {
  startDevServer
};

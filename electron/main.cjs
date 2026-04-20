const { app, BrowserWindow, dialog, session } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Path for storing generated secrets securely
const SECRET_FILE = path.join(app.getPath("userData"), ".judge-ai-secret");

/**
 * Generate or load a random JWT secret for this installation.
 * The secret is stored in the user's app data directory with restricted permissions.
 * This prevents hardcoded credentials and ensures each installation has unique secrets.
 */
function getOrCreateJwtSecret() {
  try {
    // Try to read existing secret
    if (fs.existsSync(SECRET_FILE)) {
      const existingSecret = fs.readFileSync(SECRET_FILE, "utf8").trim();
      if (existingSecret.length >= 32) {
        return existingSecret;
      }
    }
    
    // Generate new random 64-character secret
    const newSecret = crypto.randomBytes(32).toString("hex");
    
    // Write with restricted permissions (owner read/write only)
    // Note: Windows doesn't support chmod fully, but this helps on Unix systems
    try {
      fs.writeFileSync(SECRET_FILE, newSecret, { mode: 0o600 });
    } catch (writeErr) {
      console.warn("[Electron] Could not restrict secret file permissions:", writeErr);
      fs.writeFileSync(SECRET_FILE, newSecret);
    }
    
    return newSecret;
  } catch (error) {
    console.error("[Electron] Failed to manage JWT secret, using process-based fallback:", error);
    // Fallback: derive from process info (not ideal but better than static)
    return crypto.createHash("sha256")
      .update(`electron-${process.pid}-${Date.now()}-${Math.random()}`)
      .digest("hex");
  }
}

// Load .env before setting fallbacks so dotenv values take priority
function loadEnv() {
  try {
    const dotenv = require("dotenv");
    const candidates = [
      path.join(process.cwd(), ".env"),
      path.join(__dirname, "../.env"),
      path.join(__dirname, "../../.env"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p });
        break;
      }
    }
  } catch (e) {
    // dotenv not available, ignore
  }
}
loadEnv();

process.env.PORT = process.env.PORT || "3000";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

// Provide fallbacks for desktop mode - generate random secrets instead of hardcoded values
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = getOrCreateJwtSecret();
}
if (!process.env.DATABASE_URL) {
  // Use a more descriptive error if database is not configured
  console.warn("[Electron] DATABASE_URL not set, using default. Ensure MariaDB is running.");
  process.env.DATABASE_URL = "mysql://root:root@localhost:3306/judge_ai";
}
if (!process.env.OWNER_OPEN_ID) {
  process.env.OWNER_OPEN_ID = "desktop-local-user";
}

let mainWindow;
let serverReady = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    title: "Judge AI",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.loadURL("http://localhost:3000").catch((err) => {
    console.error("Failed to load app URL:", err);
    dialog.showErrorBox(
      "Startup Error",
      "Could not connect to the Judge AI server. Please make sure your database is configured correctly and try again."
    );
    app.quit();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

try {
  require(path.join(__dirname, "../dist/index.cjs"));
} catch (err) {
  console.error("Server failed to start:", err);
  dialog.showErrorBox(
    "Server Startup Error",
    err?.message || "The Judge AI server could not start."
  );
  app.quit();
}

function waitForServer(retries = 30) {
  const http = require("http");
  const req = http.get("http://localhost:3000/api/trpc", (res) => {
    serverReady = true;
    createWindow();
  });
  req.on("error", () => {
    if (retries > 0) {
      setTimeout(() => waitForServer(retries - 1), 500);
    } else {
      dialog.showErrorBox(
        "Server Timeout",
        "The Judge AI server did not start in time. Please check your configuration and try again."
      );
      app.quit();
    }
  });
  req.setTimeout(2000, () => {
    req.destroy();
  });
}

app.whenReady().then(async () => {
  // Clear browser cache so updates are always picked up
  try {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({
      storages: ["appcache", "cookies", "filesystem", "indexdb", "localstorage", "shadercache", "websql", "serviceworkers"],
      quotas: ["temporary", "persistent", "syncable"],
    });
  } catch (e) {
    console.error("Failed to clear cache:", e);
  }
  waitForServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow == null) createWindow();
});

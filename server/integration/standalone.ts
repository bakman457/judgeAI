import "dotenv/config";
import { startIntegrationServer } from "./server";

startIntegrationServer().catch(error => {
  console.error("[Integration] Failed to start:", error);
  process.exit(1);
});

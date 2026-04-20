import { randomBytes } from "node:crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions, isSecureRequest } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/authorize", (req: Request, res: Response) => {
    if (!ENV.oAuthServerUrl) {
      res.status(500).json({ error: "OAuth server is not configured" });
      return;
    }
    const state = randomBytes(16).toString("hex");
    res.cookie("oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(req),
      maxAge: 600_000,
    });
    const redirectUri = `${req.protocol}://${req.get("host")}/api/oauth/callback`;
    const url = new URL("app-auth", ENV.oAuthServerUrl);
    url.searchParams.set("appId", ENV.appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    res.redirect(url.toString());
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    const cookieState = req.cookies?.oauth_state;
    if (!cookieState || cookieState !== state) {
      res.status(403).json({ error: "Invalid OAuth state" });
      return;
    }
    res.clearCookie("oauth_state");

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
        userAgent: req.get("user-agent") ?? null,
        ipAddress: req.ip ?? null,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "../../shared/const";
import { getUserByOpenId } from "../db";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Populated at startup by index.ts. Used as a loopback-only fallback for the
// Electron desktop app, where the user IS the OS user of the local machine.
let desktopAdminUser: User | null = null;

export function setDesktopAdminUser(user: User) {
  desktopAdminUser = user;
}

function isLoopbackRequest(req: CreateExpressContextOptions["req"]): boolean {
  const remote = req.socket?.remoteAddress ?? "";
  return (
    remote === "127.0.0.1" ||
    remote === "::1" ||
    remote === "::ffff:127.0.0.1"
  );
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // 1) Try to authenticate via the session cookie (JWT).
  let user: User | null = null;
  try {
    const cookies = parseCookieHeader(opts.req.headers.cookie ?? "");
    const sessionCookie = cookies[COOKIE_NAME];
    if (sessionCookie) {
      const session = await sdk.verifySession(sessionCookie);
      if (session?.openId) {
        user = (await getUserByOpenId(session.openId)) ?? null;
      }
    }
  } catch {
    user = null;
  }

  // 2) Desktop fallback: only trust the seeded admin when the request came
  //    from the local loopback interface. Prevents the previous behaviour of
  //    granting admin to every caller regardless of their cookie.
  if (!user && desktopAdminUser && isLoopbackRequest(opts.req)) {
    user = desktopAdminUser;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

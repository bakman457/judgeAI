import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Desktop mode: local admin user for development/testing only.
// This user is created at startup but still requires valid session for auth.
let desktopAdminUser: User | null = null;

export function setDesktopAdminUser(user: User) {
  desktopAdminUser = user;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: desktopAdminUser,
  };
}

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServerConfig } from "./config";

type CookieWrite = { name: string; value: string; options: CookieOptions };

export type RequestSupabaseClient = ReturnType<typeof createRequestSupabaseClient>;

function secureCookies(request?: NextRequest) {
  return process.env.NODE_ENV === "production" || request?.nextUrl.protocol === "https:";
}

function cookieOptions(options: CookieOptions, request?: NextRequest): CookieOptions {
  return { ...options, httpOnly: true, sameSite: "lax", secure: secureCookies(request), path: "/" };
}

/** A fresh Supabase client for one Route Handler request. Auth cookie writes are applied to its response. */
export function createRequestSupabaseClient(request: NextRequest) {
  const config = getSupabaseServerConfig();
  const writes: CookieWrite[] = [];
  const client = createServerClient(config.url, config.anonKey, {
    cookieOptions: cookieOptions({}, request),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const item of items) {
          request.cookies.set(item.name, item.value);
          writes.push(item);
        }
      },
    },
  });

  return {
    client,
    withCookies(response: NextResponse) {
      for (const item of writes) {
        response.cookies.set(item.name, item.value, cookieOptions(item.options, request));
      }
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    },
  };
}

/** Server Components read the refreshed request cookies supplied by middleware. */
export function createComponentSupabaseClient() {
  const cookieStore = cookies();
  const config = getSupabaseServerConfig();
  return createServerClient(config.url, config.anonKey, {
    cookieOptions: cookieOptions({}),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          for (const item of items) cookieStore.set(item.name, item.value, cookieOptions(item.options));
        } catch {
          // Server Components cannot write cookies; middleware refreshes them first.
        }
      },
    },
  });
}

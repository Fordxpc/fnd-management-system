import { onRequest } from "./functions/api/[[path]]";
import { getAuth } from "./src/lib/auth";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // 1. Route Better Auth requests to its handler
    if (url.pathname.startsWith("/api/auth/")) {
      const auth = getAuth(env); // Create auth instance per-request
      return auth.handler(request);
    }

    // 2. Route all other API requests to your custom handler
    if (url.pathname.startsWith("/api/")) {
      const context = {
        request,
        env,
        waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise),
        passThroughOnException: () => ctx.passThroughOnException(),
        next: () => env.ASSETS.fetch(request),
        params: {},
        data: {},
        functionPath: url.pathname,
      };

      return onRequest(context as any);
    }

    // 3. Serve static React files
    return env.ASSETS.fetch(request);
  },
};
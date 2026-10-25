import { onRequest } from './functions/api/[[path]]';

export default {
  // Changed ExecutionContext to any to fix the red squiggly line
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      // Construct a context object that perfectly mimics Cloudflare Pages
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

    // Serve the static React files from the 'dist' folder
    return env.ASSETS.fetch(request);
  },
};
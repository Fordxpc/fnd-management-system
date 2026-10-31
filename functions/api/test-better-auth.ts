import { auth } from "../../src/lib/auth.ts";

export const onRequestPost = async (ctx: any) => {
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: "test@funadhooairport.com",
        password: "Test123456!",
        name: "Test User",
      },
    });

    return Response.json(result);
  } catch (e: any) {
    return Response.json(
      {
        error: String(e),
      },
      {
        status: 500,
      }
    );
  }
};
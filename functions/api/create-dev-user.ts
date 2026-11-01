import { auth } from "../../src/lib/auth.ts";

export const onRequestPost = async () => {
  const result = await auth.api.signUpEmail({
    body: {
      email: "developer2@funadhooairport.com",
      password: "Dev123456!",
      name: "Developer",
    },
  });

  return Response.json(result);
};
export interface AuthUser {
  email: string;
  role: string;
}

export async function requireAuth(
  request: Request,
  env: any
): Promise<AuthUser> {

  const email = request.headers.get("x-user-email");

  if (!email) {
    throw new Error("Unauthorized");
  }

  const user: any = await env.DB
    .prepare(
      "SELECT email, role FROM users WHERE LOWER(email) = LOWER(?)"
    )
    .bind(email)
    .first();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return {
    email: user.email,
    role: user.role,
  };
}
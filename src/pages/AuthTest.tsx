import { authClient } from "../lib/auth-client";

export default function AuthTest() {
  async function createTestUser() {
    try {
      const result = await authClient.signUp.email({
        email: "test@example.com",
        password: "Test123456!",
        name: "Test User",
      });

      console.log("SUCCESS:", result);
    } catch (err) {
      console.error("ERROR:", err);
    }
  }

  return (
    <div style={{ padding: 30 }}>
      <h2>Better Auth Test</h2>

      <button onClick={createTestUser}>
        Create Test User
      </button>
    </div>
  );
}
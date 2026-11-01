const API_BASE = "/api";

export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include", // Sends the Better Auth cookie
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage =
        errorData.message || errorData.error || JSON.stringify(errorData);
    } catch {
      const textError = await response.text();
      errorMessage = textError.substring(0, 100);
    }
    console.error("API Error:", errorMessage);
    throw new Error(errorMessage);
  }

  return response.json();
};
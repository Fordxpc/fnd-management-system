// src/lib/api.ts
import { auth } from '../firebase';

const API_BASE = '/api';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  
  if (!response.ok) {
    // Try to parse the error as JSON, otherwise return raw text (like an HTML error page)
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
    } catch (e) {
      const textError = await response.text();
      errorMessage = textError.substring(0, 100); // Show first 100 chars of HTML/Text
    }
    console.error("API Error:", errorMessage);
    throw new Error(errorMessage);
  }
  
  return response.json();
};
/**
 * Configuration module
 */

// Export environment variables
export const GEMINI_API_KEY: string | undefined =
  process.env.GEMINI_API_KEY || '';

export const GH_ACCESS_TOKEN =
  process.env.GH_ACCESS_TOKEN ||
  '';

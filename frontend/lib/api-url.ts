const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!configuredApiUrl) {
  throw new Error(
    'Missing NEXT_PUBLIC_API_URL. Set it in frontend/.env.local for local development or frontend/.env.production before running next build.',
  );
}

export const API_BASE_URL = configuredApiUrl.replace(/\/$/, '');

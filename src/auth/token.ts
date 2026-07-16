interface JwtPayload {
  exp?: number;
}

export function tokenExpirationMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized)) as JwtPayload;
    return typeof payload.exp === 'number' ? payload.exp * 1_000 : null;
  } catch {
    return null;
  }
}

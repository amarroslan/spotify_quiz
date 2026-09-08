declare global {
  namespace Express {
    interface Request {
      sessionId: string;
      userSession: { userId?: string; spotifyUserId?: string; oauthState?: string };
    }
  }
}
export {};

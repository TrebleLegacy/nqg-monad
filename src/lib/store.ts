// In-memory store for hackathon. In production, use a database.

export interface AuthenticatorDevice {
  credentialID: Uint8Array;
  credentialPublicKey: Uint8Array;
  counter: number;
  transports?: string[];
}

export interface UserRecord {
  id: string; // passkey credential ID (hex)
  username: string;
  evmAddress: string; // deterministic address derived from credential
  authenticators: AuthenticatorDevice[];
  currentChallenge?: string;
  registeredAt: number;
}

// Global in-memory stores
const users = new Map<string, UserRecord>();
const usernameToId = new Map<string, string>();
const challengeStore = new Map<string, string>(); // challenge → userId
const sessionStore = new Map<string, { userId: string; expiresAt: number }>();

// Vote tracking for anti-double-vote (proposalId:credentialId → true)
const voteTracking = new Map<string, boolean>();

export function getUser(id: string): UserRecord | undefined {
  return users.get(id);
}

export function getUserByUsername(username: string): UserRecord | undefined {
  const id = usernameToId.get(username.toLowerCase());
  return id ? users.get(id) : undefined;
}

export function createUser(user: UserRecord): void {
  users.set(user.id, user);
  usernameToId.set(user.username.toLowerCase(), user.id);
}

export function getAllUsers(): UserRecord[] {
  return Array.from(users.values());
}

export function setChallenge(challenge: string, userId: string): void {
  challengeStore.set(challenge, userId);
}

export function getChallenge(challenge: string): string | undefined {
  return challengeStore.get(challenge);
}

export function deleteChallenge(challenge: string): void {
  challengeStore.delete(challenge);
}

export function createSession(userId: string): string {
  const sessionId = crypto.randomUUID();
  sessionStore.set(sessionId, {
    userId,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
  });
  return sessionId;
}

export function getSession(sessionId: string): { userId: string } | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessionStore.delete(sessionId);
    return null;
  }
  return { userId: session.userId };
}

export function hasVoted(proposalId: number, userId: string): boolean {
  return voteTracking.get(`${proposalId}:${userId}`) === true;
}

export function markVoted(proposalId: number, userId: string): void {
  voteTracking.set(`${proposalId}:${userId}`, true);
}

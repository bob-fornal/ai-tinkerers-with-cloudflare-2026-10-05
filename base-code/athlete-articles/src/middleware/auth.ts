import type { Env } from "../lib/env";
import { extractBearerToken, verifyFirebaseIdToken, FirebaseAuthError, type VerifiedFirebaseUser } from "../lib/firebaseAuth";

export type FirebaseProject = "admin" | "coach";

export async function authenticate(
  request: Request,
  env: Env,
  project: FirebaseProject,
): Promise<VerifiedFirebaseUser | null> {
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }
  const projectId = project === "admin" ? env.ADMIN_FIREBASE_PROJECT_ID : env.COACH_FIREBASE_PROJECT_ID;
  try {
    return await verifyFirebaseIdToken(token, projectId);
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      return null;
    }
    throw error;
  }
}

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

// Returns `undefined` while loading, `null` if signed out, else the profile.
export function useCurrentUser() {
  return useQuery(api.users.getCurrent);
}

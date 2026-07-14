import { ConvexReactClient } from "convex/react";

const url = import.meta.env.VITE_CONVEX_URL;
if (!url) {
  throw new Error(
    "VITE_CONVEX_URL is not set. Run `npx convex dev` to create a deployment " +
      "and populate .env.local.",
  );
}

export const convex = new ConvexReactClient(url);

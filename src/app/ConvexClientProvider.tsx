"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const address = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!address) {
  console.error(
    "[ConvexClientProvider] NEXT_PUBLIC_CONVEX_URL is not set. " +
    "Convex queries will not work. Set this variable in Vercel → Settings → Environment Variables."
  );
}
const convex = address ? new ConvexReactClient(address) : null;

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

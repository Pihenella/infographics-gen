import ProjectsClient from "./ProjectsClient";

// force-dynamic prevents Next.js from statically pre-rendering this page at build time,
// which would fail when NEXT_PUBLIC_CONVEX_URL is not set (Convex hooks require the provider).
export const dynamic = "force-dynamic";

export default function Page() {
  return <ProjectsClient />;
}

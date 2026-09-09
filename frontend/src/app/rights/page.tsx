import { redirect } from "next/navigation";

// "Know Your Rights" has been merged into the unified AI Legal Help surface
// (available as a tab on /chat). Keep this route as a redirect so existing
// links and bookmarks continue to work.
export default function RightsPage() {
  redirect("/chat");
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startUrlSourcePoller } = await import("@/lib/urlSourcePoller");
    startUrlSourcePoller();
  }
}

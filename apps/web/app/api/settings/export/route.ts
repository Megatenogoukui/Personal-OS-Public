import { readStore } from "@/lib/server/local-store";

export async function GET() {
  const store = await readStore();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(store, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="personal-os-backup-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}

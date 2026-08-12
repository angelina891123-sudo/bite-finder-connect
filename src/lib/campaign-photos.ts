import { createServerFn } from "@tanstack/react-start";

// Dev-only local photo storage — campaigns.photos isn't in the Supabase
// schema yet, so uploaded photos are kept on local disk instead. Only works
// under `npm run dev` (Node fs access); swap for Supabase Storage before deploying.
export const getCampaignPhotosMap = createServerFn({ method: "GET" }).handler(async () => {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    const raw = await readFile(join(process.cwd(), "local-data", "campaign-photos.json"), "utf-8");
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {} as Record<string, string[]>;
  }
});

export const uploadCampaignPhoto = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    const file = data.get("file");
    const campaignId = data.get("campaignId");
    if (!(file instanceof File)) throw new Error("缺少檔案");
    if (typeof campaignId !== "string" || !campaignId) throw new Error("缺少 campaignId");
    return { file, campaignId };
  })
  .handler(async ({ data }) => {
    const { mkdir, readFile, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");

    const uploadsDir = join(process.cwd(), "public", "uploads", "campaigns", data.campaignId);
    await mkdir(uploadsDir, { recursive: true });
    const ext = data.file.name.split(".").pop() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await writeFile(join(uploadsDir, filename), Buffer.from(await data.file.arrayBuffer()));
    const url = `/uploads/campaigns/${data.campaignId}/${filename}`;

    const dbDir = join(process.cwd(), "local-data");
    const dbPath = join(dbDir, "campaign-photos.json");
    await mkdir(dbDir, { recursive: true });
    let map: Record<string, string[]> = {};
    try {
      map = JSON.parse(await readFile(dbPath, "utf-8"));
    } catch {
      // no local db yet
    }
    map[data.campaignId] = [...(map[data.campaignId] ?? []), url];
    await writeFile(dbPath, JSON.stringify(map, null, 2));

    return { url };
  });

import { supabase } from "@/integrations/supabase/client";

export const CAMPAIGN_PHOTOS_BUCKET = "campaign-photos";

// The bucket's insert policy requires the first path segment to be the
// uploader's user id, so every object lives under <userId>/<campaignId>/.
// See supabase/migrations/20260812210000_add_campaign_photos.sql.
export async function uploadCampaignPhotos(files: File[], userId: string, campaignId: string) {
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${campaignId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(CAMPAIGN_PHOTOS_BUCKET)
      .upload(path, file, { contentType: file.type });
    if (error) throw error;
    urls.push(supabase.storage.from(CAMPAIGN_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

import { CalendarDays, Gift, MapPin, Users, Store, Clapperboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** 案件詳情彈窗需要的欄位，首頁與「我的申請」共用。 */
export type CampaignDetail = {
  id: string;
  title: string;
  description: string | null;
  video_direction: string | null;
  video_must_include: string | null;
  video_must_avoid: string | null;
  copy_must_include: string | null;
  copy_must_avoid: string | null;
  hashtags: string[] | null;
  reference_link: string | null;
  notes: string | null;
  restaurant_name: string | null;
  region: string;
  address: string | null;
  collab_types: string[];
  reward: string;
  min_followers: number;
  slots: number;
  deadline: string | null;
  photos: string[] | null;
};

function Row({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SubRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{value}</p>
    </div>
  );
}

export function CampaignDetailDialog({
  campaign,
  onOpenChange,
  expired,
  children,
}: {
  campaign: CampaignDetail | null;
  onOpenChange: (open: boolean) => void;
  expired?: boolean;
  /** 底部動作區，例如申請按鈕；不傳則只顯示關閉。 */
  children?: React.ReactNode;
}) {
  const videoRows = [
    { label: "影片主軸方向", value: campaign?.video_direction?.trim() },
    { label: "影片必要露出資訊/畫面", value: campaign?.video_must_include?.trim() },
    { label: "影片避免露出資訊/畫面", value: campaign?.video_must_avoid?.trim() },
  ].filter((r): r is { label: string; value: string } => !!r.value);

  const copyMustInclude = campaign?.copy_must_include?.trim() || campaign?.description?.trim();
  const copyRows = [
    { label: "必要露出資訊", value: copyMustInclude },
    { label: "避免露出資訊", value: campaign?.copy_must_avoid?.trim() },
  ].filter((r): r is { label: string; value: string } => !!r.value);
  const hashtags = (campaign?.hashtags ?? []).filter(Boolean);
  const referenceLink = campaign?.reference_link?.trim();

  return (
    <Dialog open={campaign !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            {campaign?.collab_types.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
            {expired && <Badge variant="destructive">已截止</Badge>}
          </div>
          <DialogTitle className="text-xl">{campaign?.title}</DialogTitle>
          <DialogDescription>
            {campaign?.restaurant_name ?? "餐廳"}・{campaign?.region}
          </DialogDescription>
        </DialogHeader>

        {campaign?.photos && campaign.photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {campaign.photos.map((p) => (
              <img
                key={p}
                src={p}
                alt={`${campaign.title} 案件照片`}
                loading="lazy"
                className="h-44 w-64 shrink-0 rounded-lg object-cover"
              />
            ))}
          </div>
        )}

        <div className="grid gap-2 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
          <Row icon={Store} label="餐廳" value={campaign?.restaurant_name ?? "未提供"} />
          <Row icon={MapPin} label="地區" value={campaign?.region ?? ""} />
          <Row icon={Clapperboard} label="合作類型" value={campaign?.collab_types.join("、") ?? ""} />
          <Row icon={Gift} label="獎勵" value={campaign?.reward ?? ""} />
          <Row
            icon={Users}
            label="粉絲門檻"
            value={`${(campaign?.min_followers ?? 0).toLocaleString()} 人・名額 ${campaign?.slots ?? 0}`}
          />
          <Row icon={CalendarDays} label="預計上線日期" value={campaign?.deadline ?? "未提供"} />
        </div>

        {campaign?.address?.trim() && (
          <div>
            <p className="mb-1 text-sm font-semibold">店家位置</p>
            <p className="mb-2 text-sm text-muted-foreground">{campaign.address}</p>
            <iframe
              title="店家位置地圖"
              src={`https://www.google.com/maps?q=${encodeURIComponent(campaign.address)}&output=embed`}
              className="h-56 w-full rounded-lg border border-border"
              loading="lazy"
            />
          </div>
        )}

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">影音需求</p>
            {videoRows.length > 0 ? (
              <div className="space-y-2">
                {videoRows.map((r) => (
                  <SubRow key={r.label} label={r.label} value={r.value} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">商家尚未提供詳細說明。</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">文案需求</p>
            {copyRows.length > 0 || hashtags.length > 0 || referenceLink ? (
              <div className="space-y-2">
                {copyRows.map((r) => (
                  <SubRow key={r.label} label={r.label} value={r.value} />
                ))}
                {hashtags.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">hashtag</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {hashtags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag.startsWith("#") ? tag : `#${tag}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {referenceLink && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">連結</p>
                    <a
                      href={referenceLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline break-all"
                    >
                      {referenceLink}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">商家尚未提供詳細說明。</p>
            )}
          </div>
          {campaign?.notes?.trim() && (
            <div>
              <p className="mb-1 text-sm font-semibold">備註</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{campaign.notes}</p>
            </div>
          )}
        </div>

        {children && <DialogFooter>{children}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

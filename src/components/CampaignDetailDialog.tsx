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
  restaurant_name: string | null;
  region: string;
  collab_type: string;
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
  return (
    <Dialog open={campaign !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{campaign?.collab_type}</Badge>
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
          <Row icon={Clapperboard} label="合作類型" value={campaign?.collab_type ?? ""} />
          <Row icon={Gift} label="獎勵" value={campaign?.reward ?? ""} />
          <Row
            icon={Users}
            label="粉絲門檻"
            value={`${(campaign?.min_followers ?? 0).toLocaleString()} 人・名額 ${campaign?.slots ?? 0}`}
          />
          <Row icon={CalendarDays} label="預計上線日期" value={campaign?.deadline ?? "未提供"} />
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold">文案需求</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {campaign?.description?.trim() || "商家尚未提供詳細說明。"}
          </p>
        </div>

        {children && <DialogFooter>{children}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

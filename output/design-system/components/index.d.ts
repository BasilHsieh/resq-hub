import type * as React from 'react';

/** 可以按的元件：有 href 就畫成連結（mockup 串頁），否則是按鈕（onClick）。 */
interface Pressable { href?: string; onClick?: () => void }

/** 時間：Date、ISO 字串、毫秒，或已寫好的「14:26」「昨天 08:40」「9/24 08:40」。null＝還沒有紀錄。 */
export type When = Date | string | number | null;

/** 同意狀態（D-16）。沒給＝尚未取得同意。 */
export type Consent = 'agreed' | 'pending' | 'declined' | 'public';
/** 需求。只講人力，不含物資（U-06）。 */
export type Need = 'need' | 'unknown' | 'enough' | 'done';
/** 清單的四個分類（D-16）。 */
export type Category = 'help' | 'ask' | 'declined' | 'done';
export type IconName = 'back' | 'check' | 'close' | 'clock' | 'walk' | 'directions' | 'report' | 'user-plus' | 'users' | 'info' | 'lock';

export interface ConsentBadgeProps { status?: Consent }
/** 一戶的同意狀態標籤：已同意／尚未取得同意／不同意／公共區域。 */
export declare function ConsentBadge(props: ConsentBadgeProps): React.ReactElement;

export interface NeedChipProps {
  status?: Need;
  /** status 為 need 時的人數；'10+' 寫成「缺 10 人以上」。 */
  count?: number | string;
}
/** 一戶的需求：缺 N 人／人夠了／清完了／需求不明。沒給 status 不畫。 */
export declare function NeedChip(props: NeedChipProps): React.ReactElement | null;

export interface UpdatedAtProps { at?: When; now?: Date | string | number }
/** 「最後更新 14:26」，只有一種寫法。 */
export declare function UpdatedAt(props: UpdatedAtProps): React.ReactElement;
/** UpdatedAt 用的同一個格式函式，給資料層用。 */
export declare function formatUpdated(at?: When, now?: Date | string | number): string;

export interface CategoryGridProps {
  /** 選中的分類，預設 help（可以直接幫忙）。 */
  value?: Category;
  counts?: Partial<Record<Category, number | string>>;
  countHelp?: number | string; countAsk?: number | string; countDeclined?: number | string; countDone?: number | string;
  onSelect?: (key: Category) => void;
  /** mockup 串頁：每一格連到哪一張。 */
  hrefs?: Partial<Record<Category, string>>;
  hrefHelp?: string; hrefAsk?: string; hrefDeclined?: string; hrefDone?: string;
  /** 下面那句說明，預設顯示。 */
  showHint?: boolean | 'true' | 'false';
}
/** 清單頁最上面的四個分類，每格寫數量。 */
export declare function CategoryGrid(props: CategoryGridProps): React.ReactElement;

export interface HouseholdRowProps {
  /** 虛構地址（甲街、乙路）。 */
  address: string;
  consent?: Consent;
  need?: Need;
  needCount?: number | string;
  updatedAt?: When;
  now?: Date | string | number;
  walkMinutes?: number | string;
  expanded?: boolean | 'true' | 'false';
  /** 點這一列（收合時）或它的標頭（展開時）。 */
  onSelect?: () => void; href?: string;
  onDirections?: () => void; directionsHref?: string;
  onReport?: () => void; reportHref?: string;
  /** 換掉展開後那句說明；預設跟著同意狀態。 */
  hint?: string;
}
/** 清單上的一戶；點一下就地展開，給「怎麼走」與「回報這一戶」。 */
export declare function HouseholdRow(props: HouseholdRowProps): React.ReactElement;

export interface ResumeCardProps extends Pressable { address: string }
/** 回到清單時最上面的「你剛剛在」。 */
export declare function ResumeCard(props: ResumeCardProps): React.ReactElement;

export interface ReportCardProps extends Pressable {
  kind: 'consent' | 'need';
  /** kind 為 consent 時是 Consent，為 need 時是 Need（預設 unknown）。 */
  status?: Consent | Need;
  count?: number | string;
  updatedAt?: When;
  now?: Date | string | number;
  /** 框起來、按鈕變主要。一個畫面最多一塊。 */
  emphasis?: boolean | 'true' | 'false';
}
/** 回報頁的一塊：屋主同意嗎／需要人嗎，各自更新。 */
export declare function ReportCard(props: ReportCardProps): React.ReactElement;

export interface ButtonProps extends Pressable {
  /** outline 是 tonal 的舊名。 */
  variant?: 'primary' | 'tonal' | 'outline' | 'dashed' | 'link';
  size?: 'lg' | 'md';
  icon?: IconName;
  /** 副標，只給 lg（一題一頁的答案，靠左排，圖示在左邊的白圓裡）。 */
  sub?: string;
  className?: string;
  'aria-label'?: string;
  children?: React.ReactNode;
}
/** 一個按鈕做一件事，字寫動作。 */
export declare function Button(props: ButtonProps): React.ReactElement;

export interface CountPickerProps {
  /** 預設 1、2、3、5、8、10+；字串時用逗號分開。 */
  options?: string[] | string;
  onPick?: (value: string) => void;
  href?: string;
}
/** 「還要幾個人？」的答案，按一下就送出。 */
export declare function CountPicker(props: CountPickerProps): React.ReactElement;

export interface NoticeProps { children?: React.ReactNode }
/** 剛回報完的「已記下」。 */
export declare function Notice(props: NoticeProps): React.ReactElement;

export interface TopBarProps { label?: string; onBack?: () => void; backHref?: string }
/** 返回鍵＋你在哪。 */
export declare function TopBar(props: TopBarProps): React.ReactElement;

export interface DrillBannerProps {
  /** 演習時間，例如 14:20。 */
  time?: string;
  /** 預設「地址、需求都是編的」。 */
  note?: string;
}
/** 演習標記（D-12），兵推全程掛著。 */
export declare function DrillBanner(props: DrillBannerProps): React.ReactElement;

export interface IconProps {
  name: IconName;
  size?: number | string;
  strokeWidth?: number | string;
  /** 單獨出現時必填。 */
  label?: string;
  className?: string;
}
/** 十一個線條圖示（Tabler Icons，MIT）。 */
export declare function Icon(props: IconProps): React.ReactElement | null;

declare global {
  interface Window {
    ResQ: {
      ConsentBadge: typeof ConsentBadge; NeedChip: typeof NeedChip; UpdatedAt: typeof UpdatedAt;
      CategoryGrid: typeof CategoryGrid; HouseholdRow: typeof HouseholdRow; ResumeCard: typeof ResumeCard;
      ReportCard: typeof ReportCard; Button: typeof Button; CountPicker: typeof CountPicker; Notice: typeof Notice;
      TopBar: typeof TopBar; DrillBanner: typeof DrillBanner; Icon: typeof Icon;
      formatUpdated: typeof formatUpdated;
    };
  }
}

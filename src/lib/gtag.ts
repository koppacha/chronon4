declare global {
    interface Window {
        gtag: any;
    }
}

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID

export const pageView = (url: string) => {
    if (typeof window !== "undefined" && window.gtag) {
        window.gtag("config", GA_MEASUREMENT_ID, {
            page_path: url,
        });
    }
};

// イベントトラッキング関数（カスタムイベント用）
export const event = ({ action, category, label, value }: {
    action: string;
    category: string;
    label?: string;
    value?: number;
}) => {
    if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", action, {
            event_category: category,
            event_label: label,
            value: value,
        });
    }
};
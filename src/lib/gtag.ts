export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID

export const pageView = (url: string) => {
    window.gtag('config', GA_MEASUREMENT_ID, {
        page_path: url,
    });
};
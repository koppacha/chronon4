import "server-only";

import { revalidatePath } from "next/cache";
import { clearCache } from "@/lib/cache";

export const SITE_REVALIDATE_PATHS = ["/", "/api/recent", "/api/tags", "/rss.xml"] as const;

export function revalidateSiteContent(): readonly string[] {
    clearCache();
    revalidatePath("/", "page");
    revalidatePath("/api/recent");
    revalidatePath("/api/tags");
    revalidatePath("/rss.xml");
    return SITE_REVALIDATE_PATHS;
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import * as gtag from "@/lib/gtag";

export default function AnalyticsTracker() {
    const pathname = usePathname();

    useEffect(() => {
        if (!pathname) return;
        if (
            pathname === "/login" ||
            pathname === "/welcome" ||
            pathname === "/password-reset" ||
            pathname.startsWith("/api/auth/")
        ) return;
        gtag.pageView(pathname);
    }, [pathname]);

    return null;
}

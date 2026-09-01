import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/login", "/welcome", "/password-reset", "/config", "/api/auth/", "/api/user/", "/api/admin/"],
        },
    };
}

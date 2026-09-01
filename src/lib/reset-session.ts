export const RESET_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-chronon_reset" : "chronon_reset";
export const RESET_CSRF_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-chronon_reset_csrf" : "chronon_reset_csrf";

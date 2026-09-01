export function isDevAuthMockEnabledForEnvironment(
    nodeEnv: string | undefined,
    enableDevAuthMock: string | undefined,
): boolean {
    return nodeEnv === "development" && enableDevAuthMock !== "0";
}

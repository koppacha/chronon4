import {
    createCipheriv,
    createDecipheriv,
    createHmac,
    randomBytes,
    scrypt as scryptCallback,
    timingSafeEqual,
} from "node:crypto";
const PASSWORD_MIN_CHARACTERS = 12;
const PASSWORD_MAX_BYTES = 256;
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: { N: number; r: number; p: number; maxmem: number }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
            if (error) reject(error);
            else resolve(derivedKey);
        });
    });
}

function readSecret(name: string, minimumBytes = 32): Buffer {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not configured.`);
    }

    const bytes = value.startsWith("base64:")
        ? Buffer.from(value.slice("base64:".length), "base64")
        : Buffer.from(value, "utf8");

    if (bytes.length < minimumBytes) {
        throw new Error(`${name} must contain at least ${minimumBytes} bytes.`);
    }
    return bytes;
}

function readEncryptionKey(): Buffer {
    const value = process.env.EMAIL_ENCRYPTION_KEY;
    if (!value) throw new Error("EMAIL_ENCRYPTION_KEY is not configured.");
    const key = value.startsWith("base64:")
        ? Buffer.from(value.slice("base64:".length), "base64")
        : Buffer.from(value, "base64");
    if (key.length !== 32) {
        throw new Error("EMAIL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
    }
    return key;
}

function hmac(name: string, purpose: string, value: string): string {
    return createHmac("sha256", readSecret(name))
        .update(`${purpose}\0${value}`, "utf8")
        .digest("hex");
}

export function normalizeEmail(value: string): string {
    const trimmed = value.trim();
    const at = trimmed.lastIndexOf("@");
    if (at <= 0 || at === trimmed.length - 1) return trimmed;
    return `${trimmed.slice(0, at)}@${trimmed.slice(at + 1).toLowerCase()}`;
}

export function isValidEmail(value: string): boolean {
    const normalized = normalizeEmail(value);
    if (normalized.length > 254 || /[\s\0]/.test(normalized)) return false;
    const at = normalized.lastIndexOf("@");
    if (at <= 0 || at > 64) return false;
    const local = normalized.slice(0, at);
    const domain = normalized.slice(at + 1);
    if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
    if (!/^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(domain)) {
        return false;
    }
    return true;
}

export function validatePassword(password: string): string | null {
    if (password.includes("\0") || /[\uD800-\uDFFF]/.test(password)) {
        return "パスワードに使用できない文字が含まれています。";
    }
    if (Array.from(password).length < PASSWORD_MIN_CHARACTERS) {
        return `パスワードは${PASSWORD_MIN_CHARACTERS}文字以上にしてください。`;
    }
    if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
        return `パスワードはUTF-8で${PASSWORD_MAX_BYTES}バイト以下にしてください。`;
    }
    return null;
}

export async function hashPassword(password: string): Promise<string> {
    const validationError = validatePassword(password);
    if (validationError) throw new Error(validationError);

    const salt = randomBytes(16);
    const derived = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY,
    });

    return [
        "scrypt",
        SCRYPT_N,
        SCRYPT_R,
        SCRYPT_P,
        salt.toString("base64url"),
        derived.toString("base64url"),
    ].join("$");
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
    const parts = encodedHash.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;

    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;

    try {
        const salt = Buffer.from(parts[4], "base64url");
        const expected = Buffer.from(parts[5], "base64url");
        const actual = await scryptAsync(password, salt, expected.length, {
            N: n,
            r,
            p,
            maxmem: SCRYPT_MAX_MEMORY,
        });
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
        return false;
    }
}

export function encryptEmail(email: string): { encrypted: string; keyVersion: number } {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) throw new Error("Invalid email address.");

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", readEncryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        encrypted: ["1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join("."),
        keyVersion: 1,
    };
}

export function decryptEmail(encrypted: string): string {
    const [version, ivText, tagText, ciphertextText] = encrypted.split(".");
    if (version !== "1" || !ivText || !tagText || !ciphertextText) {
        throw new Error("Unsupported encrypted email format.");
    }
    const decipher = createDecipheriv("aes-256-gcm", readEncryptionKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([
        decipher.update(Buffer.from(ciphertextText, "base64url")),
        decipher.final(),
    ]).toString("utf8");
}

export function emailHmac(email: string): string {
    return hmac("EMAIL_HMAC_KEY", "email", normalizeEmail(email));
}

export function ipHmac(ip: string): string {
    return hmac("IP_HMAC_KEY", "ip", ip);
}

export function tokenHmac(token: string): string {
    return hmac("TOKEN_HMAC_KEY", "token", token);
}

export function sessionTokenHmac(token: string): string {
    return hmac("SESSION_HMAC_KEY", "session", token);
}

export function csrfTokenHmac(token: string): string {
    return hmac("SESSION_HMAC_KEY", "csrf", token);
}

export function opaqueHmac(purpose: string, value: string): string {
    return hmac("SESSION_HMAC_KEY", purpose, value);
}

export function randomToken(bytes = 32): string {
    return randomBytes(bytes).toString("base64url");
}

export function newCorrelationHash(): string {
    return opaqueHmac("correlation", randomToken(24));
}

export function safeStringEqual(left: string, right: string): boolean {
    const a = Buffer.from(left, "utf8");
    const b = Buffer.from(right, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
}

import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-please-change";
  process.env.AUTH_SECRET = "test-auth-secret-please-change";
});

describe("crypto", () => {
  it("round-trips a secret", async () => {
    const { encrypt, decrypt } = await import("../src/lib/crypto");
    const secret = "xxxx yyyy zzzz 1234";
    const enc = encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(decrypt(enc)).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const { encrypt } = await import("../src/lib/crypto");
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects tampered ciphertext", async () => {
    const { encrypt, decrypt } = await import("../src/lib/crypto");
    const enc = encrypt("secret");
    const [iv, tag, data] = enc.split(".");
    const tampered = `${iv}.${tag}.${Buffer.from("evil").toString("base64")}`;
    expect(() => decrypt(tampered)).toThrow();
    expect(iv && tag && data).toBeTruthy();
  });
});

describe("session tokens", () => {
  it("signs and verifies a session", async () => {
    const { createSessionToken, verifySessionToken } = await import("../src/lib/auth/session");
    const token = await createSessionToken({ sub: "u1", email: "a@b.com", name: "A", role: "editor" });
    const decoded = await verifySessionToken(token);
    expect(decoded?.sub).toBe("u1");
    expect(decoded?.role).toBe("editor");
  });

  it("rejects a garbage token", async () => {
    const { verifySessionToken } = await import("../src/lib/auth/session");
    expect(await verifySessionToken("not.a.jwt")).toBeNull();
  });
});

describe("rbac", () => {
  it("enforces the role hierarchy", async () => {
    const { atLeast, canPublish, canEditArticle } = await import("../src/lib/auth/rbac");
    expect(atLeast("admin", "editor")).toBe(true);
    expect(atLeast("author", "editor")).toBe(false);
    expect(canPublish({ role: "editor" })).toBe(true);
    expect(canPublish({ role: "author" })).toBe(false);
    // Authors can edit their own; editors can edit anyone's.
    const author = { sub: "u1", email: "", name: "", role: "author" as const };
    expect(canEditArticle(author, "u1")).toBe(true);
    expect(canEditArticle(author, "u2")).toBe(false);
    const editor = { sub: "e1", email: "", name: "", role: "editor" as const };
    expect(canEditArticle(editor, "u2")).toBe(true);
  });
});

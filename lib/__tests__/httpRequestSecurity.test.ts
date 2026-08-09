import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  hasJsonContentType,
  isSameOriginRequest,
  readBoundedJson,
} from "@/lib/server/httpRequestSecurity";

function request(
  body: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("https://valisenmentalhealth.com/api/example", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Origin: "https://valisenmentalhealth.com",
      ...headers,
    },
    body,
  });
}

describe("server request security", () => {
  it("requires JSON and the complete same origin, including scheme", () => {
    const valid = request("{}");
    expect(hasJsonContentType(valid)).toBe(true);
    expect(isSameOriginRequest(valid)).toBe(true);

    expect(
      isSameOriginRequest(
        request("{}", { Origin: "http://valisenmentalhealth.com" }),
      ),
    ).toBe(false);
    expect(
      hasJsonContentType(request("{}", { "Content-Type": "text/plain" })),
    ).toBe(false);
  });

  it("accepts a verified public origin supplied by the deployment proxy", () => {
    const proxied = new NextRequest("http://internal:3000/api/example", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://valisenmentalhealth.com",
        "X-Forwarded-Host": "valisenmentalhealth.com",
        "X-Forwarded-Proto": "https",
      },
      body: "{}",
    });
    expect(isSameOriginRequest(proxied)).toBe(true);
  });

  it("enforces the byte limit without relying on Content-Length", async () => {
    const oversized = await readBoundedJson(request(JSON.stringify({ value: "é".repeat(20) })), 30);
    expect(oversized).toEqual({ ok: false, reason: "too_large" });

    const parsed = await readBoundedJson(request('{"ok":true}'), 30);
    expect(parsed).toEqual({ ok: true, value: { ok: true } });
  });

  it("cancels the request stream as soon as the byte ceiling is crossed", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(31)));
        controller.enqueue(new TextEncoder().encode("unread trailing data"));
      },
      cancel() {
        cancelled = true;
      },
    });
    const streamedRequest = new NextRequest(
      "https://valisenmentalhealth.com/api/example",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://valisenmentalhealth.com",
        },
        body: stream,
        duplex: "half",
      } as unknown as ConstructorParameters<typeof NextRequest>[1],
    );

    await expect(readBoundedJson(streamedRequest, 30)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(cancelled).toBe(true);
  });

  it("rejects malformed or dishonest request lengths", async () => {
    await expect(
      readBoundedJson(request("{}", { "Content-Length": "not-a-number" }), 30),
    ).resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(readBoundedJson(request("{not-json}"), 30)).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
    await expect(readBoundedJson(request("{}"), 0)).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});

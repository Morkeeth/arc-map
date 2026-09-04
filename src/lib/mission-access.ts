import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

export function missionAccess(
  request: Request,
  mutation = false,
): { owner: string; cookie?: string } {
  const configured = process.env.ARCMAP_AGENT_TOKEN;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer /, "");
  if (configured && supplied) {
    const a = createHash("sha256").update(configured).digest(),
      b = createHash("sha256").update(supplied).digest();
    if (timingSafeEqual(a, b)) return { owner: `agent:${b.toString("hex")}` };
    throw new Error("Invalid agent token.");
  }
  const allowed = process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3107";
  if (mutation && request.headers.get("origin") !== allowed)
    throw new Error("Same-origin request or agent bearer token required.");
  const token =
    request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)arcmap_session=([a-f0-9]{64})(?:;|$)/)?.[1] ||
    randomBytes(32).toString("hex");
  return {
    owner: createHash("sha256").update(token).digest("hex"),
    cookie: `arcmap_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${allowed.startsWith("https:") ? "; Secure" : ""}`,
  };
}
export async function readMissionBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("JSON body required.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body required.");
  let size = 0;
  let text = "";
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16384) {
      await reader.cancel();
      throw new Error("Request body too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  const body = JSON.parse(text + decoder.decode());
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("JSON object required.");
  return body;
}
export function missionResponse(data: unknown, cookie?: string, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
}

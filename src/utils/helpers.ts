/**
 * Turns any thrown value into a readable string for logs (worker `failed`, support, etc.).
 * Handles normal `Error` instances, optional `cause`, and HTTP client errors such as SendGrid’s
 * `ResponseError` (`code`, `response.body`, `response.statusCode`).
 */
export function normalizeError(err: unknown): string {
  if (err == null) {
    return String(err);
  }
  if (typeof err === "string") {
    return err;
  }
  if (typeof err !== "object") {
    return String(err);
  }

  const o = err as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name : "Error";
  const message = typeof o.message === "string" ? o.message : "";

  const response = o.response;
  if (response && typeof response === "object") {
    const r = response as { body?: unknown; statusCode?: number };
    const code = typeof o.code === "number" ? o.code : r.statusCode;
    const lines: string[] = [];
    if (message) {
      lines.push(code != null ? `${message} (HTTP ${code})` : message);
    } else {
      lines.push(code != null ? `${name} (HTTP ${code})` : name);
    }
    if (r.body !== undefined) {
      lines.push(
        typeof r.body === "string"
          ? r.body
          : safeJsonStringify(r.body),
      );
    }
    return lines.join("\n");
  }

  if (message) {
    return name === "Error" ? message : `${name}: ${message}`;
  }

  const cause = o.cause;
  if (cause !== undefined && cause !== err) {
    return `${name}\nCaused by: ${normalizeError(cause)}`;
  }

  try {
    return JSON.stringify(o, null, 2);
  } catch {
    return String(err);
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

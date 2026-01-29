export const TEST_BASE_URL = "http://localhost:3000";
export const TEST_ORIGIN = "http://localhost:8080";

export function buildRequest(
  path: string,
  init: RequestInit = {},
  baseUrl: string = TEST_BASE_URL
): Request {
  const url = new URL(path, baseUrl).toString();
  return new Request(url, init);
}

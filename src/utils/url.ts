/**
 * Fast pathname extraction from URL string without full URL parsing.
 * This is significantly faster than `new URL(url).pathname` for simple cases.
 *
 * @param url - The full URL string (e.g., "http://localhost:3000/users?page=1")
 * @returns The pathname portion (e.g., "/users")
 */
export function getPathname(url: string): string {
  // Find the start of the path (after protocol://host:port)
  const protocolEnd = url.indexOf("://");
  let pathStart: number;

  if (protocolEnd !== -1) {
    // URL has protocol, find the path start after host
    pathStart = url.indexOf("/", protocolEnd + 3);
    if (pathStart === -1) {
      // No path, return root
      return "/";
    }
  } else {
    // No protocol, assume path starts at beginning or after host
    pathStart = url.indexOf("/");
    if (pathStart === -1) {
      return "/";
    }
  }

  // Find the end of the path (before query string or hash)
  let pathEnd = url.length;

  const queryIndex = url.indexOf("?", pathStart);
  if (queryIndex !== -1) {
    pathEnd = queryIndex;
  }

  const hashIndex = url.indexOf("#", pathStart);
  if (hashIndex !== -1 && hashIndex < pathEnd) {
    pathEnd = hashIndex;
  }

  return url.slice(pathStart, pathEnd) || "/";
}

/**
 * Fast query string extraction from URL string.
 * Returns the query string without the leading "?", or empty string if none.
 *
 * @param url - The full URL string
 * @returns The query string without "?" (e.g., "page=1&limit=10")
 */
export function getQueryString(url: string): string {
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) {
    return "";
  }

  const hashIndex = url.indexOf("#", queryIndex);
  if (hashIndex !== -1) {
    return url.slice(queryIndex + 1, hashIndex);
  }

  return url.slice(queryIndex + 1);
}

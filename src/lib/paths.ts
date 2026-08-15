const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const basePath = configuredBasePath === "/" ? "" : configuredBasePath.replace(/\/$/u, "");

export function withBasePath(pathname: string) {
  if (!pathname.startsWith("/")) throw new Error(`Public path must start with /: ${pathname}`);
  return `${basePath}${pathname}`;
}

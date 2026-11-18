export function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/dashboard";
  }

  try {
    const base = new URL("http://vetto.local");
    const target = new URL(value, base);
    const decodedPath = decodeURIComponent(target.pathname);

    if (
      target.origin !== base.origin ||
      !decodedPath.startsWith("/") ||
      decodedPath.startsWith("//") ||
      decodedPath.includes("\\")
    ) {
      return "/dashboard";
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/dashboard";
  }
}

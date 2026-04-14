/**
 * Returns the current store's externalId from localStorage.
 * Every data query must be scoped to this ID so stores see only their own data.
 */
export function getStoreId(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem("pos_ext_id") ?? ""
}

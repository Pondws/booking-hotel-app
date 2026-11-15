/** Display order for hotel/room images: explicit sortOrder, then id as a stable tiebreak. */
export const imageOrder = [{ sortOrder: "asc" }, { id: "asc" }] as const;

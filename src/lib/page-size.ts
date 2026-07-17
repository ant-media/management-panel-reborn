// Page-size vocabulary shared by the Pagination control and every list hook, so
// the picker and the query agree on the allowed sizes. Kept separate from the
// component file so Fast Refresh stays happy (components-only modules).
export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 25

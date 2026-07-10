// ─────────────────────────────────────────────────────────────
// CATALOG DISPLAY CONFIG — shared shape between the admin panel,
// the /api/admin/catalog-config route and the catalog grid.
// ─────────────────────────────────────────────────────────────

export type CatalogConfig = {
  /** contain = вся картинка целиком, cover = кроп по центру, cover-top = кроп сверху (головы в кадре) */
  fit: 'contain' | 'cover' | 'cover-top'
  /** форма превью-окна карточки; auto = натуральная высота картинки */
  ratio: '1/1' | '4/5' | '3/4' | '16/9' | 'auto'
}

export const DEFAULT_CATALOG_CONFIG: CatalogConfig = { fit: 'contain', ratio: '1/1' }

export const FIT_OPTIONS: Array<{ value: CatalogConfig['fit']; label: string }> = [
  { value: 'contain', label: 'Fit — вся картинка целиком' },
  { value: 'cover', label: 'Crop — кроп по центру' },
  { value: 'cover-top', label: 'Crop Top — кроп сверху (головы в кадре)' },
]

export const RATIO_OPTIONS: Array<{ value: CatalogConfig['ratio']; label: string }> = [
  { value: '1/1', label: 'Квадрат 1:1' },
  { value: '4/5', label: 'Портрет 4:5' },
  { value: '3/4', label: 'Портрет 3:4' },
  { value: '16/9', label: 'Кино 16:9' },
  { value: 'auto', label: 'Авто — натуральная высота' },
]

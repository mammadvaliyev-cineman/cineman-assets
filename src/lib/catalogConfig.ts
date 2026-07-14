// ─────────────────────────────────────────────────────────────
// CATALOG DISPLAY CONFIG — shared shape between the admin panel,
// the /api/admin/catalog-config route and the catalog grid.
// ─────────────────────────────────────────────────────────────

export type CatalogConfig = {
  /** contain = вся картинка целиком, cover = кроп по центру, cover-top = кроп сверху (головы в кадре) */
  fit: 'contain' | 'cover' | 'cover-top'
  /** форма превью-окна карточки; auto = натуральная высота картинки */
  ratio: '1/1' | '4/5' | '3/4' | '4/3' | '16/10' | '16/9' | 'auto'
}

// Дефолт владельца: единый размер карточек, картинка заполняет окно (cover),
// лишнее аккуратно режется по краям. 16:10 сидит лучше 4:3 — большинство
// ассетов (шиты персонажей, локации) близки к 16:9, кроп по бокам минимален.
export const DEFAULT_CATALOG_CONFIG: CatalogConfig = { fit: 'cover', ratio: '16/10' }

export const FIT_OPTIONS: Array<{ value: CatalogConfig['fit']; label: string }> = [
  { value: 'contain', label: 'Fit — the whole image' },
  { value: 'cover', label: 'Crop — center' },
  { value: 'cover-top', label: 'Crop Top — heads in frame' },
]

export const RATIO_OPTIONS: Array<{ value: CatalogConfig['ratio']; label: string }> = [
  { value: '1/1', label: 'Square 1:1' },
  { value: '4/5', label: 'Portrait 4:5' },
  { value: '3/4', label: 'Portrait 3:4' },
  { value: '4/3', label: 'Landscape 4:3' },
  { value: '16/10', label: 'Wide 16:10' },
  { value: '16/9', label: 'Cinema 16:9' },
  { value: 'auto', label: 'Auto — natural height' },
]

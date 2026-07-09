# Cineman AI Studio — что добавлено и как запустить

Ветка: `feature/cineman-studio`

## Что это

Страница **/studio** — диалоговый AI-режиссёр поверх твоей базы ассетов.
Флоу: тип ролика → герой (поиск по базе) → локация (поиск по базе) → действие → камера → атмосфера → «Снимаем!» → Seedance 2.0 → готовое видео.

Экономика — retrieval-first:

| Шаг | Стоимость |
|---|---|
| Поиск героев/локаций в Supabase | 0 (бесплатно, мгновенно) |
| Перевод запроса в теги (Gemini Flash) | ~$0.0001 за запрос |
| Fallback-генерация ассета (Nano Banana, только если в базе нет) | копейки; результат сохраняется обратно в базу — второй раз уже бесплатно |
| Финальный промпт (шаблон + Gemini-полировка) | ~$0.0002 |
| Видео Seedance 2.0 Fast (черновик, 720p, без звука) | дёшево |
| Видео Seedance 2.0 (финал, 1080p + звук) | полная цена — только по явному выбору юзера |

## Новые файлы

- `src/app/studio/page.tsx` — визард агента (UI)
- `src/app/api/studio/search/route.ts` — поиск ассетов (Gemini keywords → скоринг по tags/title/description)
- `src/app/api/studio/compile/route.ts` — компилятор промпта (детерминированный шаблон + LLM-полировка)
- `src/app/api/studio/video/route.ts` — Seedance 2.0 через kie.ai (POST создать / GET статус)
- `src/app/api/studio/generate/route.ts` — fallback-генерация ассета + автосохранение в базу
- `src/lib/kie.ts` — клиент kie.ai (все модели меняются в одном месте: KIE_MODELS)
- `src/components/Navbar.tsx` — добавлена ссылка Studio

## Настройка (5 минут)

1. **Env-переменные** (Vercel → Settings → Environment Variables):
   - `KIE_API_KEY` — ключ с kie.ai (Dashboard → API Keys)
   - `GEMINI_API_KEY` — уже должен стоять (используется в ai-name)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — уже стоят

2. **Пуш и деплой:**
   ```bash
   git push origin feature/cineman-studio
   # смержи в main или открой превью-деплой Vercel на ветку
   ```

3. **Проверка локально:**
   ```bash
   npm install && npm run dev
   # http://localhost:3000/studio
   ```

## Важно: наполнение базы

Агент ищет в таблице `assets` Supabase. Сейчас там только то, что загружено через админку.
1 869 PNG из Dropbox надо прогнать батчами через админку (она уже умеет Gemini-разметку), либо следующим шагом я напишу bulk-скрипт `scripts/ingest.ts`: папка → Gemini-теги → storage → таблица, одним запуском.

## Известные ограничения v1

- `duration` перебрасывается в kie как есть (5/10/15) — если API отклонит значение, ошибка покажется в UI.
- Ссылки kie на готовое видео живут ~24 ч — юзеру показана подсказка «скачай сразу». Следующий шаг: автосохранение видео в Supabase storage.
- Подписочный гейт (LemonSqueezy) на кнопку «Снимаем!» ещё не подключён — сейчас любой может жечь кредиты. Не выкладывай /studio в паблик до добавления гейта.
- Голос (Whisper/TTS) — v2 по плану.

<!-- redeploy: ARK_API_KEY enabled -->

<!-- redeploy: ark key updated -->

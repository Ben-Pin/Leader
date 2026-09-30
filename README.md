# Leader

Local lead management for Windows, with a TickTick-inspired browser interface and an MCP connector sharing the same data model. The name comes from **lead**.

Prototype scope: editable cards, lists, ordered color tags, country, last-contact quarter, search, filters, completion, and persistent SQLite storage. At least 10,000 cards per list is the target. Demo data is fictional; the private mail archive is never part of this repository.

## Development

Requires Node.js 24 LTS and pnpm. Install with `pnpm install`, run `pnpm dev`, and open the printed localhost URL. Production: `pnpm build` then `pnpm start`. Windows launcher: `start-leader.cmd`.

Architecture is defined in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), requirements in [docs/PRODUCT.md](docs/PRODUCT.md), the API contract in [docs/API.md](docs/API.md), and verification in [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

The local database lives under `data/` and is ignored by Git. Backups are not automated yet. No customer archive is uploaded to GitHub.

## Использование в Windows

После установки зависимостей и сборки дважды нажмите `start-leader.cmd`: он запускает локальный сервер в фоне и открывает браузер на http://127.0.0.1:4177. Открытие браузера не требует GitHub CLI. Для разработки нужны Node.js 24 и pnpm; готовый launcher повторной сборки не выполняет.

В демо 12 вымышленных компаний. Создавайте карточки, выбирайте страну, добавляйте теги, даты, следующие шаги и заметки. После редактирования полей нажмите «Сохранить». Тег квартала вычисляется автоматически и всегда отображается первым. Списки и теги показывают активные карточки; завершённые доступны в отдельном разделе.

Инструкции по локальному MCP находятся в [docs/CONNECTOR.md](docs/CONNECTOR.md), результаты проверок — в [docs/VERIFICATION.md](docs/VERIFICATION.md). Коннектор реализован и протестирован, но ещё не установлен в пользовательский MCP-хост. Для изменений через коннектор обновите страницу браузера. Архивирование обратимо через MCP по ID; экрана архива пока нет.

Прототип не включает синхронизацию с TickTick, импорт почты, удалённый облачный доступ, вложения, уведомления и полноценный календарь. Реальные карточки из JSON не импортированы. Не публикуйте loopback-сервер в интернет.

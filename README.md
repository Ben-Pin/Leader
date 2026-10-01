# Leader

Local lead management for Windows, with a TickTick-inspired browser interface and an MCP connector sharing the same data model. The name comes from **lead**.

of the lead-free world

Prototype scope: editable cards, lists, ordered color tags, country, last-contact quarter, search, work flags, isolated company databases, and full company JSON export/import. At least 10,000 cards per list is the target. Demo data is fictional; the private mail archive is never part of this repository.

## Development

Requires Node.js 24 LTS and pnpm. Install with `pnpm install`, run `pnpm dev`, and open the printed localhost URL. Production: `pnpm build` then `pnpm start`. Windows launcher: `start-leader.cmd`.

Architecture is defined in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), requirements in [docs/PRODUCT.md](docs/PRODUCT.md), the API contract in [docs/API.md](docs/API.md), and verification in [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

The local database lives under `data/` and is ignored by Git. Backups are not automated yet. No customer archive is uploaded to GitHub.

## Использование в Windows

После установки зависимостей и сборки дважды нажмите `start-leader.cmd`: он запускает локальный сервер в фоне и открывает браузер на http://127.0.0.1:4177. Открытие браузера не требует GitHub CLI. Для разработки нужны Node.js 24 и pnpm; готовый launcher повторной сборки не выполняет.

Выберите базу в переключателе под Leader: Demo, Clab или BrothersInArms. У каждой компании отдельный файл SQLite. Кнопка управления базами открывает создание новой компании, экспорт текущей базы и импорт файла Leader JSON в новую базу. Импорт сохраняет карточки, теги, списки, комментарии, флаги, историю и идентификаторы. Демо содержит 12 исходных вымышленных компаний; существующие изменения в прежней базе сохраняются.

После редактирования нажмите постоянно видимую кнопку Save или Ctrl+S. При переходе из изменённой карточки: Save Changes? → Yes сохраняет и продолжает, No отбрасывает изменения и продолжает, Cancel оставляет редактор открытым. При закрытии самой вкладки браузер показывает собственное предупреждение.

Зелёный In quote означает ожидание ответа на предложение о цене; Logistics issue — жёлтый; Administrative issue — красный. Каждый флаг имеет однострочный комментарий и снимается чек-боксом. Можно включить несколько флагов. Карточка отображается в списках своих флагов и возвращается в In work после снятия всех. Название компании не зачёркивается. Квартальный тег остаётся первым.

Инструкции по локальному MCP находятся в [docs/CONNECTOR.md](docs/CONNECTOR.md), результаты проверок — в [docs/VERIFICATION.md](docs/VERIFICATION.md). Коннектор реализован и протестирован, но ещё не установлен в пользовательский MCP-хост. Для изменений через коннектор обновите страницу браузера. Архивирование обратимо через MCP по ID; экрана архива пока нет.

Прототип не включает синхронизацию с TickTick, импорт почты, удалённый облачный доступ, вложения, уведомления и полноценный календарь. Реальные карточки из JSON не импортированы. Не публикуйте loopback-сервер в интернет.

// Fictional records only. These names and contact details are demonstration data.
export const DEMO_LISTS = [
  { id: 'demo-clients', name: 'Customers', color: '#4779eb' },
  { id: 'demo-prospects', name: 'Prospects', color: '#a077df' },
  { id: 'demo-partners', name: 'Partners', color: '#e9a74a' },
];

export const DEMO_TAGS = [
  { id: 'demo-iot', name: 'IoT', color: '#557bdf' },
  { id: 'demo-industrial', name: 'Промышленность', color: '#ad77d9' },
  { id: 'demo-gateway', name: 'Шлюзы', color: '#df9960' },
  { id: 'demo-pilot', name: 'Пилотный проект', color: '#42a991' },
  { id: 'demo-distributor', name: 'Дистрибьютор', color: '#6b8b9f' },
];

export const DEMO_CARDS = [
  {
    title: 'Nordwell Systems', company: 'Nordwell Systems', country: 'Германия',
    contactName: 'Anna Weber', email: 'anna@nordwell.example', listId: 'demo-clients',
    description: 'Демо-компания • Мониторинг промышленного оборудования.\n\nОбсуждаем пилот на трёх заводах: 40 IoT-шлюзов с LTE, резервным питанием и удалённым управлением. После успешного пилота — до 600 устройств в год.\n\nСледующий шаг: согласовать спецификацию и срок поставки образцов.',
    lastContact: '2026-09-28', dueDate: '2026-10-02', status: 'proposal', priority: 3, starred: true,
    tagIds: ['demo-iot', 'demo-industrial', 'demo-pilot'],
    checklist: [{ text: 'Подготовить техническое предложение', done: true }, { text: 'Подтвердить комплектацию LTE', done: false }, { text: 'Отправить расчёт на 40 устройств', done: false }],
    activity: [{ text: 'Анна подтвердила бюджет пилота. Нужен расчёт двух вариантов комплектации.', createdAt: '2026-09-28T10:30:00.000Z' }, { text: 'Провели демонстрацию удалённого мониторинга.', createdAt: '2026-09-18T08:00:00.000Z' }],
  },
  { title: 'Aster Marine', company: 'Aster Marine', country: 'Норвегия', contactName: 'Erik Lund', email: 'erik@aster-marine.example', listId: 'demo-clients', description: 'Демо-компания • Телеметрия для небольших портов. Нужен шлюз с широким температурным диапазоном и двумя Ethernet-портами.', lastContact: '2026-09-25', dueDate: '2026-10-05', status: 'qualified', priority: 2, tagIds: ['demo-gateway', 'demo-pilot'], checklist: [{ text: 'Уточнить питание на объектах', done: false }] },
  { title: 'Kanso Robotics', company: 'Kanso Robotics', country: 'Япония', contactName: 'Yuki Tanaka', email: 'yuki@kanso.example', listId: 'demo-clients', description: 'Демо-компания • Контроллеры автономных складских тележек. Получили образцы, ожидаем результаты нагрузочных тестов.', lastContact: '2026-09-20', status: 'client', priority: 1, starred: true, tagIds: ['demo-industrial'], checklist: [{ text: 'Образцы доставлены', done: true }, { text: 'Получить протокол испытаний', done: false }] },
  { title: 'Cedar Grid', company: 'Cedar Grid', country: 'Израиль', contactName: 'Noa Levi', email: 'noa@cedar-grid.example', listId: 'demo-clients', description: 'Демо-компания • Системы управления солнечными станциями. Запросили коммерческое предложение на серию 120 устройств.', lastContact: '2026-08-12', status: 'proposal', priority: 2, tagIds: ['demo-iot', 'demo-gateway'] },
  { title: 'Bruma Labs', company: 'Bruma Labs', country: 'Испания', contactName: 'Lucía Martín', email: 'lucia@bruma.example', listId: 'demo-clients', description: 'Демо-компания • Разрабатывают датчики качества воздуха для муниципальных зданий. Контакт возобновлён после летней паузы.', lastContact: '2026-07-06', status: 'contacted', priority: 0, tagIds: ['demo-iot'] },
  { title: 'Harbourline Energy', company: 'Harbourline Energy', country: 'Великобритания', contactName: 'Oliver Reed', email: 'oliver@harbourline.example', listId: 'demo-clients', description: 'Демо-компания • Телеметрия распределённых аккумуляторов. Проверить актуальность проекта и новый график закупок.', lastContact: '2025-11-18', status: 'qualified', priority: 1, tagIds: ['demo-gateway', 'demo-industrial'] },
  { title: 'Vela Automation', company: 'Vela Automation', country: 'Италия', contactName: 'Sofia Riva', email: 'sofia@vela.example', listId: 'demo-clients', description: 'Демо-компания • Интеграция производственных линий. Пилот завершён, партия поставлена; поддерживаем отношения.', lastContact: '2025-05-09', status: 'client', completed: true, priority: 0, tagIds: ['demo-industrial'] },
  { title: 'Prairie Sensorics', company: 'Prairie Sensorics', country: 'Канада', contactName: 'Maya Brooks', email: 'maya@prairie.example', listId: 'demo-prospects', description: 'Демо-компания • Автоматизация полива. Сохраняем как перспективный контакт до подтверждения сроков запуска.', lastContact: '2026-09-10', status: 'lead', priority: 0, tagIds: ['demo-iot'] },
  { title: 'Solena Mobility', company: 'Solena Mobility', country: 'Франция', contactName: 'Camille Moreau', email: 'camille@solena.example', listId: 'demo-prospects', description: 'Демо-компания • Мониторинг зарядных станций. Требования ещё формируются, договорились вернуться к обсуждению осенью.', lastContact: '2024-06-14', status: 'contacted', priority: 0, tagIds: ['demo-gateway'] },
  { title: 'Tamarind Controls', company: 'Tamarind Controls', country: 'Индия', contactName: 'Arjun Rao', email: 'arjun@tamarind.example', listId: 'demo-prospects', description: 'Демо-компания • Системы учёта энергии. Старый контакт, перед следующим обращением проверить роль контактного лица.', lastContact: '2023-10-04', status: 'lead', priority: 0, tagIds: ['demo-industrial'] },
  { title: 'Kepler Components', company: 'Kepler Components', country: 'Нидерланды', contactName: 'Lars de Vries', email: 'lars@kepler-components.example', listId: 'demo-partners', description: 'Демо-компания • Региональный дистрибьютор в странах Бенилюкса. Обсудить демонстрационные комплекты для отдела продаж.', lastContact: '2026-09-22', status: 'qualified', priority: 2, starred: true, tagIds: ['demo-distributor', 'demo-gateway'] },
  { title: 'Southern Arc', company: 'Southern Arc', country: 'Австралия', contactName: 'Amelia Cole', email: 'amelia@southern-arc.example', listId: 'demo-partners', description: 'Демо-компания • Партнёр по интеграции. Обменялись материалами по установке шлюзов на удалённых объектах.', lastContact: '2025-02-07', status: 'contacted', priority: 0, tagIds: ['demo-distributor', 'demo-iot'] },
];

export interface ShortcutItem {
  id: string;
  category: 'history' | 'navigation' | 'actions';
  label: string;
  description: string;
  macKeys: string[];
  winKeys: string[];
}

export const SHORTCUTS: ShortcutItem[] = [
  {
    id: 'undo',
    category: 'history',
    label: 'Скасувати дію',
    description: 'Відмінити останню зміну в розкладі чи даних',
    macKeys: ['⌘', 'Z'],
    winKeys: ['Ctrl', 'Z'],
  },
  {
    id: 'redo',
    category: 'history',
    label: 'Повторити дію',
    description: 'Повторити скасовану дію',
    macKeys: ['⇧', '⌘', 'Z'],
    winKeys: ['Ctrl', 'Shift', 'Z'],
  },
  {
    id: 'history',
    category: 'history',
    label: 'Історія змін',
    description: 'Відкрити або закрити бічну панель журналу дій',
    macKeys: ['⌘', 'H'],
    winKeys: ['Ctrl', 'H'],
  },
  {
    id: 'nav_print',
    category: 'navigation',
    label: 'Друк / Звіти',
    description: 'Перейти до сторінки друку та експорту розкладу',
    macKeys: ['⌘', 'P'],
    winKeys: ['Ctrl', 'P'],
  },
  {
    id: 'nav_home',
    category: 'navigation',
    label: 'Головна',
    description: 'Перейти на головну панель',
    macKeys: ['⌥', '1'],
    winKeys: ['Alt', '1'],
  },
  {
    id: 'nav_teachers',
    category: 'navigation',
    label: 'Вчителі',
    description: 'Перейти до списку викладачів',
    macKeys: ['⌥', '2'],
    winKeys: ['Alt', '2'],
  },
  {
    id: 'nav_subjects',
    category: 'navigation',
    label: 'Предмети',
    description: 'Перейти до навчальних предметів',
    macKeys: ['⌥', '3'],
    winKeys: ['Alt', '3'],
  },
  {
    id: 'nav_students',
    category: 'navigation',
    label: 'Класи та групи',
    description: 'Перейти до класів та учнівських груп',
    macKeys: ['⌥', '4'],
    winKeys: ['Alt', '4'],
  },
  {
    id: 'nav_rooms',
    category: 'navigation',
    label: 'Кабінети',
    description: 'Перейти до списку приміщень',
    macKeys: ['⌥', '5'],
    winKeys: ['Alt', '5'],
  },
  {
    id: 'nav_timetable',
    category: 'navigation',
    label: 'Розклад',
    description: 'Перейти до таблиці та генерації розкладу',
    macKeys: ['⌥', '6'],
    winKeys: ['Alt', '6'],
  },
  {
    id: 'nav_settings',
    category: 'navigation',
    label: 'Налаштування',
    description: 'Перейти до параметрів школи та системи',
    macKeys: ['⌥', '7'],
    winKeys: ['Alt', '7'],
  },
  {
    id: 'theme_toggle',
    category: 'actions',
    label: 'Зміна теми',
    description: 'Швидке перемикання між світлою та темною темою',
    macKeys: ['⌥', 'T'],
    winKeys: ['Alt', 'T'],
  },
  {
    id: 'close_modal',
    category: 'actions',
    label: 'Закрити вікно',
    description: 'Закрити активну бічну панель, діалог або меню',
    macKeys: ['Esc'],
    winKeys: ['Esc'],
  },
];

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "uz" | "ru" | "en";

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "uz", label: "O'zbek", flag: "🇺🇿" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

// All UI strings in 3 languages
const translations = {
  uz: {
    // Auth
    signIn: "Kirish",
    email: "Elektron pochta",
    password: "Parol",
    companySlug: "Kompaniya kodi (ixtiyoriy)",
    signing: "Kirilmoqda…",
    superAdmin: "Super Admin",
    companyUser: "Xodim",
    backHome: "← Bosh sahifaga",
    invalidCreds: "Login yoki parol noto'g'ri",

    // Nav
    dashboard: "Bosh sahifa",
    companies: "Kompaniyalar",
    branches: "Filiallar",
    services: "Xizmatlar",
    queueDesigner: "Navbat dizayni",
    counters: "Kabinetlar",
    employees: "Xodimlar",
    devices: "Qurilmalar",
    menuBuilder: "Menyu",
    pageBuilder: "Sahifalar",
    ticketTemplates: "Chipta shablonlari",
    onlineOrders: "Onlayn buyurtmalar",
    analytics: "Tahlil",
    auditLog: "Audit",
    settings: "Sozlamalar",
    logout: "Chiqish",

    // Actions
    create: "Yaratish",
    save: "Saqlash",
    cancel: "Bekor qilish",
    delete: "O'chirish",
    edit: "Tahrirlash",
    add: "Qo'shish",
    search: "Qidirish",

    // Queue / Ticket
    callNext: "Keyingini chaqirish",
    complete: "Tugatish",
    recall: "Qayta chaqirish",
    noShow: "Kelmadi",
    transfer: "Ko'chirish",
    waiting: "Kutmoqda",
    serving: "Xizmat ko'rsatilmoqda",
    called: "Chaqirildi",
    completed: "Tugadi",
    cancelled: "Bekor qilindi",
    noShowStatus: "Kelmadi",
    yourTicket: "Sizning chiptangiz",
    peopleAhead: "Oldingizda",
    estWait: "Taxminiy kutish",
    minutes: "daqiqa",
    chooseService: "Xizmat tanlang",
    issueAnother: "Yana bitta",
    noQueues: "Navbat topilmadi",
    noTicket: "Aktiv chipta yo'q",

    // Kiosk
    kioskTitle: "Xizmat tanlang",
    kioskSubtitle: "O'z-xizmat kiosk",
    avgTime: "Taxm",
    prefix: "Prefiks",
    thanks: "Rahmat",
    thanksSubtitle: "Iltimos, boshqa xizmatni tanlang",

    // Display
    nowServing: "Xizmat ko'rsatilmoqda",
    counterStatus: "Kabinet holati",
    recentCalls: "So'nggi chaqiruvlar",
    awaiting: "Birinchi chaqiruv kutilmoqda…",

    // Operator
    operatorConsole: "Operator konsoli",
    counter: "Kabinet",
    pickCounter: "Kabinet tanlang",
    noActiveTkt: "Aktiv chipta yo'q. \"Keyingini chaqirish\" tugmasini bosing.",
    apiMode: "API rejimi",
    demoMode: "Demo rejimi",

    // Errors
    noCompanyId: "Kompaniya tanlanmagan",
    required: "majburiy",

    // Language
    language: "Til",

    // Roles
    superAdminRole: "Super Admin",
    companyAdmin: "Kompaniya admin",
    operator: "Operator",
    manager: "Menejer",
    viewer: "Kuzatuvchi",

    // Operator page
    startWork: "Ishni boshlash",
    endWork: "Ishni tugatish",
    sessionActive: "Seans faol",
    sessionInactive: "Seans yopilgan",
    myCounter: "Mening kabinetim",
    goToWindow: "Kabinетga boring",
    windowLabel: "Kabinet",
    notAssigned: "Tayinlanmagan",
    myAudit: "Mening tarixim",
    workedTime: "Ishlagan vaqt",
    sessionsCount: "Seanslar soni",
    ticketsServed: "Xizmat ko'rsatilgan",
    avgServiceTime: "O'rtacha xizmat vaqti",

    // Kiosk
    waitPosition: "Navbatdagi o'rningiz",
    estWaitTime: "Taxminiy kutish vaqti",
    yourNumber: "Sizning raqamingiz",
    printTicket: "Chiptani chop etish",

    // Display
    goToWindowAnnounce: "Kabinetga boring",
    calledToWindow: "chaqirildi",

    // Devices
    openKiosk: "Kiosk ochish",
    openDisplay: "Displey ochish",
    copyLink: "Havolani nusxalash",
    deviceLink: "Qurilma havolasi",
    connectViaUrl: "URL orqali ulash",
  },
  ru: {
    signIn: "Войти",
    email: "Эл. почта",
    password: "Пароль",
    companySlug: "Код компании (необязательно)",
    signing: "Вход…",
    superAdmin: "Супер Админ",
    companyUser: "Сотрудник",
    backHome: "← На главную",
    invalidCreds: "Неверный логин или пароль",

    dashboard: "Главная",
    companies: "Компании",
    branches: "Филиалы",
    services: "Услуги",
    queueDesigner: "Конструктор очередей",
    counters: "Кабинеты",
    employees: "Сотрудники",
    devices: "Устройства",
    menuBuilder: "Меню",
    pageBuilder: "Страницы",
    ticketTemplates: "Шаблоны талонов",
    onlineOrders: "Онлайн заказы",
    analytics: "Аналитика",
    auditLog: "Журнал аудита",
    settings: "Настройки",
    logout: "Выход",

    create: "Создать",
    save: "Сохранить",
    cancel: "Отмена",
    delete: "Удалить",
    edit: "Изменить",
    add: "Добавить",
    search: "Поиск",

    callNext: "Вызвать следующего",
    complete: "Завершить",
    recall: "Перевызвать",
    noShow: "Не явился",
    transfer: "Перевести",
    waiting: "Ожидает",
    serving: "Обслуживается",
    called: "Вызван",
    completed: "Завершён",
    cancelled: "Отменён",
    noShowStatus: "Не явился",
    yourTicket: "Ваш талон",
    peopleAhead: "Впереди вас",
    estWait: "Примерное ожидание",
    minutes: "мин",
    chooseService: "Выберите услугу",
    issueAnother: "Ещё один",
    noQueues: "Очереди не найдены",
    noTicket: "Нет активного талона",

    kioskTitle: "Выберите услугу",
    kioskSubtitle: "Самообслуживание",
    avgTime: "Прим",
    prefix: "Префикс",
    thanks: "Спасибо",
    thanksSubtitle: "Пожалуйста, выберите другую услугу",

    nowServing: "Обслуживается",
    counterStatus: "Статус кабинетов",
    recentCalls: "Последние вызовы",
    awaiting: "Ожидание первого вызова…",

    operatorConsole: "Консоль оператора",
    counter: "Кабинет",
    pickCounter: "Выберите кабинет",
    noActiveTkt: "Нет активного талона. Нажмите «Вызвать следующего».",
    apiMode: "API режим",
    demoMode: "Демо режим",

    noCompanyId: "Компания не выбрана",
    required: "обязательно",

    language: "Язык",

    superAdminRole: "Супер Админ",
    companyAdmin: "Администратор",
    operator: "Оператор",
    manager: "Менеджер",
    viewer: "Наблюдатель",

    // Operator page
    startWork: "Начать работу",
    endWork: "Завершить работу",
    sessionActive: "Сеанс активен",
    sessionInactive: "Сеанс закрыт",
    myCounter: "Мой кабинет",
    goToWindow: "Пройдите в кабинет",
    windowLabel: "Кабинет",
    notAssigned: "Не назначен",
    myAudit: "Моя история",
    workedTime: "Отработанное время",
    sessionsCount: "Количество сеансов",
    ticketsServed: "Обслужено талонов",
    avgServiceTime: "Среднее время обслуживания",

    // Kiosk
    waitPosition: "Ваше место в очереди",
    estWaitTime: "Примерное время ожидания",
    yourNumber: "Ваш номер",
    printTicket: "Распечатать талон",

    // Display
    goToWindowAnnounce: "Пройдите в кабинет",
    calledToWindow: "вызван",

    // Devices
    openKiosk: "Открыть киоск",
    openDisplay: "Открыть дисплей",
    copyLink: "Копировать ссылку",
    deviceLink: "Ссылка устройства",
    connectViaUrl: "Подключить через URL",
  },
  en: {
    signIn: "Sign In",
    email: "Email",
    password: "Password",
    companySlug: "Company slug (optional)",
    signing: "Signing in…",
    superAdmin: "Super Admin",
    companyUser: "Employee",
    backHome: "← Back to home",
    invalidCreds: "Invalid email or password",

    dashboard: "Dashboard",
    companies: "Companies",
    branches: "Branches",
    services: "Services",
    queueDesigner: "Queue Designer",
    counters: "Counters",
    employees: "Employees",
    devices: "Devices",
    menuBuilder: "Menu Builder",
    pageBuilder: "Page Builder",
    ticketTemplates: "Ticket Templates",
    onlineOrders: "Online Orders",
    analytics: "Analytics",
    auditLog: "Audit Log",
    settings: "Settings",
    logout: "Sign Out",

    create: "Create",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    search: "Search",

    callNext: "Call Next",
    complete: "Complete",
    recall: "Recall",
    noShow: "No Show",
    transfer: "Transfer",
    waiting: "Waiting",
    serving: "Serving",
    called: "Called",
    completed: "Completed",
    cancelled: "Cancelled",
    noShowStatus: "No Show",
    yourTicket: "Your Ticket",
    peopleAhead: "Ahead of you",
    estWait: "Est. wait",
    minutes: "min",
    chooseService: "Choose a service",
    issueAnother: "Issue another",
    noQueues: "No queues found",
    noTicket: "No active ticket",

    kioskTitle: "Choose a service",
    kioskSubtitle: "Self-service kiosk",
    avgTime: "Avg",
    prefix: "Prefix",
    thanks: "Thanks",
    thanksSubtitle: "Please choose another service",

    nowServing: "Now Serving",
    counterStatus: "Counter Status",
    recentCalls: "Recent Calls",
    awaiting: "Awaiting first call…",

    operatorConsole: "Operator Console",
    counter: "Counter",
    pickCounter: "Pick a counter",
    noActiveTkt: "No active ticket. Press \"Call next\".",
    apiMode: "API mode",
    demoMode: "Demo mode",

    noCompanyId: "No company selected",
    required: "required",

    language: "Language",

    superAdminRole: "Super Admin",
    companyAdmin: "Company Admin",
    operator: "Operator",
    manager: "Manager",
    viewer: "Viewer",

    // Operator page
    startWork: "Start Work",
    endWork: "End Work",
    sessionActive: "Session Active",
    sessionInactive: "Session Closed",
    myCounter: "My Counter",
    goToWindow: "Go to window",
    windowLabel: "Window",
    notAssigned: "Not Assigned",
    myAudit: "My History",
    workedTime: "Time Worked",
    sessionsCount: "Sessions",
    ticketsServed: "Tickets Served",
    avgServiceTime: "Avg. Service Time",

    // Kiosk
    waitPosition: "Your position in queue",
    estWaitTime: "Estimated wait time",
    yourNumber: "Your number",
    printTicket: "Print ticket",

    // Display
    goToWindowAnnounce: "Please go to window",
    calledToWindow: "called",

    // Devices
    openKiosk: "Open Kiosk",
    openDisplay: "Open Display",
    copyLink: "Copy Link",
    deviceLink: "Device Link",
    connectViaUrl: "Connect via URL",
  },
} as const;

export type TKey = keyof typeof translations.en;

export type TFn = (key: TKey) => string;

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
}

export const useLang = create<LangState>()(
  persist(
    (set, get) => ({
      lang: "en" as Lang,
      setLang: (lang) => set({ lang }),
      t: (key) => (translations[get().lang] as Record<string, string>)[key] ?? (translations.en as Record<string, string>)[key] ?? key,
    }),
    {
      name: "qms-lang-v1",
      // Prevent rehydrating persisted language during SSR/hydration to avoid
      // server/client text mismatch. Persisted language will be applied after
      // the client mounts, avoiding hydration errors.
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.lang = (state.lang ?? "en") as Lang;
        }
      },
    }
  )
);

/** Helper to pick localised field from a DB object */
export function loc(obj: Record<string, unknown> | null | undefined, field: string, lang: Lang): string {
  if (!obj) return "";
  return (obj[`${field}_${lang}`] as string) || (obj[`${field}_uz`] as string) || (obj[`${field}_en`] as string) || "";
}

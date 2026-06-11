import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ID = string;
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

export interface Company { id: ID; name: string; industry: string; logo?: string; createdAt: string; }
export interface Branch { id: ID; companyId: ID; name: string; address: string; phone: string; hours: string; }
export interface Service { id: ID; companyId: ID; name: string; description: string; avgTime: number; priority: number; prefix: string; }
export interface Queue { id: ID; companyId: ID; branchId: ID; serviceId: ID; name: string; prefix: string; format: string; counter: number; online: boolean; dailyLimit: number; }
export interface Counter { id: ID; branchId: ID; name: string; number: number; queueIds: ID[]; operatorId?: ID; }
export interface Employee { id: ID; companyId: ID; branchId?: ID; name: string; email: string; role: "manager" | "supervisor" | "operator" | "viewer"; counterId?: ID; }
export interface Device { id: ID; branchId: ID; name: string; type: "kiosk" | "printer" | "display" | "counter-display" | "keyboard" | "qr-scanner" | "media"; status: "online" | "offline"; ip: string; }
export interface MenuItem { id: ID; companyId: ID; label: string; icon: string; href: string; visible: boolean; order: number; }
export interface PageBlock { id: ID; type: "heading" | "text" | "image" | "button" | "form" | "queue-button" | "faq" | "banner"; content: string; }
export interface Page { id: ID; companyId: ID; title: string; slug: string; blocks: PageBlock[]; }
export interface TicketTemplate { id: ID; companyId: ID; name: string; header: string; footer: string; showQR: boolean; showBarcode: boolean; }
export interface Ticket {
  id: ID; number: string; queueId: ID; branchId: ID; serviceId: ID;
  status: "waiting" | "called" | "serving" | "completed" | "cancelled" | "no-show";
  counterId?: ID; operatorId?: ID;
  source: "kiosk" | "online";
  createdAt: string; calledAt?: string; completedAt?: string;
  customerName?: string;
}
export interface Order { id: ID; branchId: ID; number: string; items: { name: string; qty: number; price: number }[]; total: number; status: "pending" | "accepted" | "preparing" | "ready" | "completed" | "cancelled"; createdAt: string; }
export interface AuditEntry { id: ID; user: string; action: string; target: string; at: string; ip: string; }
export interface Notification { id: ID; title: string; body: string; at: string; read: boolean; channel: "push" | "sms" | "telegram" | "email"; }

interface State {
  companies: Company[];
  branches: Branch[];
  services: Service[];
  queues: Queue[];
  counters: Counter[];
  employees: Employee[];
  devices: Device[];
  menus: MenuItem[];
  pages: Page[];
  ticketTemplates: TicketTemplate[];
  tickets: Ticket[];
  orders: Order[];
  audit: AuditEntry[];
  notifications: Notification[];
  currentCompanyId?: ID;
  currentBranchId?: ID;

  setCurrentCompany: (id: ID) => void;
  setCurrentBranch: (id: ID) => void;

  addCompany: (c: Omit<Company, "id" | "createdAt">) => Company;
  removeCompany: (id: ID) => void;

  addBranch: (b: Omit<Branch, "id">) => Branch;
  removeBranch: (id: ID) => void;
  updateBranch: (id: ID, patch: Partial<Branch>) => void;

  addService: (s: Omit<Service, "id">) => Service;
  removeService: (id: ID) => void;

  addQueue: (q: Omit<Queue, "id">) => Queue;
  removeQueue: (id: ID) => void;
  updateQueue: (id: ID, patch: Partial<Queue>) => void;

  addCounter: (c: Omit<Counter, "id">) => Counter;
  removeCounter: (id: ID) => void;
  updateCounter: (id: ID, patch: Partial<Counter>) => void;

  addEmployee: (e: Omit<Employee, "id">) => Employee;
  removeEmployee: (id: ID) => void;
  updateEmployee: (id: ID, patch: Partial<Employee>) => void;

  addDevice: (d: Omit<Device, "id">) => Device;
  removeDevice: (id: ID) => void;
  toggleDevice: (id: ID) => void;

  addMenu: (m: Omit<MenuItem, "id">) => MenuItem;
  removeMenu: (id: ID) => void;
  updateMenu: (id: ID, patch: Partial<MenuItem>) => void;
  reorderMenu: (ids: ID[]) => void;

  addPage: (p: Omit<Page, "id">) => Page;
  removePage: (id: ID) => void;
  updatePage: (id: ID, patch: Partial<Page>) => void;
  addBlock: (pageId: ID, b: Omit<PageBlock, "id">) => void;
  removeBlock: (pageId: ID, blockId: ID) => void;

  addTicketTemplate: (t: Omit<TicketTemplate, "id">) => TicketTemplate;
  updateTicketTemplate: (id: ID, patch: Partial<TicketTemplate>) => void;
  removeTicketTemplate: (id: ID) => void;

  issueTicket: (input: { queueId: ID; source: "kiosk" | "online"; customerName?: string }) => Ticket | null;
  callNext: (counterId: ID, operatorId?: ID) => Ticket | null;
  recall: (ticketId: ID) => void;
  completeTicket: (ticketId: ID) => void;
  cancelTicket: (ticketId: ID) => void;
  noShow: (ticketId: ID) => void;
  transferTicket: (ticketId: ID, newCounterId: ID) => void;

  placeOrder: (input: { branchId: ID; items: Order["items"] }) => Order;
  updateOrderStatus: (id: ID, status: Order["status"]) => void;

  log: (user: string, action: string, target: string) => void;
  pushNotification: (n: Omit<Notification, "id" | "at" | "read">) => void;
  markAllRead: () => void;

  seed: () => void;
  reset: () => void;
}

const seedData = (): Partial<State> => {
  const company: Company = { id: uid(), name: "ABC Bank", industry: "Banking", createdAt: now() };
  const b1: Branch = { id: uid(), companyId: company.id, name: "Main Branch", address: "Amir Temur 1", phone: "+998 71 000 0000", hours: "09:00 - 18:00" };
  const b2: Branch = { id: uid(), companyId: company.id, name: "Airport Branch", address: "Airport Rd", phone: "+998 71 111 1111", hours: "08:00 - 22:00" };
  const services: Service[] = [
    { id: uid(), companyId: company.id, name: "Loans", description: "Personal & business loans", avgTime: 15, priority: 1, prefix: "L" },
    { id: uid(), companyId: company.id, name: "Cards", description: "Debit & credit cards", avgTime: 10, priority: 2, prefix: "C" },
    { id: uid(), companyId: company.id, name: "VIP", description: "Priority service", avgTime: 8, priority: 0, prefix: "V" },
  ];
  const queues: Queue[] = services.map((s) => ({
    id: uid(), companyId: company.id, branchId: b1.id, serviceId: s.id,
    name: `${s.name} Queue`, prefix: s.prefix, format: `${s.prefix}{000}`, counter: 0, online: true, dailyLimit: 200,
  }));
  const counters: Counter[] = [
    { id: uid(), branchId: b1.id, name: "Counter 1", number: 1, queueIds: [queues[0].id] },
    { id: uid(), branchId: b1.id, name: "Counter 2", number: 2, queueIds: [queues[1].id] },
    { id: uid(), branchId: b1.id, name: "Counter 3", number: 3, queueIds: [queues[2].id] },
  ];
  const employees: Employee[] = [
    { id: uid(), companyId: company.id, branchId: b1.id, name: "Aziz Karimov", email: "aziz@abc.uz", role: "operator", counterId: counters[0].id },
    { id: uid(), companyId: company.id, branchId: b1.id, name: "Dilnoza Yusupova", email: "dilnoza@abc.uz", role: "operator", counterId: counters[1].id },
    { id: uid(), companyId: company.id, branchId: b1.id, name: "Sardor Mirzaev", email: "sardor@abc.uz", role: "manager" },
  ];
  const devices: Device[] = [
    { id: uid(), branchId: b1.id, name: "Lobby Kiosk", type: "kiosk", status: "online", ip: "10.0.0.10" },
    { id: uid(), branchId: b1.id, name: "Main Display", type: "display", status: "online", ip: "10.0.0.11" },
    { id: uid(), branchId: b1.id, name: "Ticket Printer", type: "printer", status: "online", ip: "10.0.0.12" },
  ];
  const menus: MenuItem[] = [
    { id: uid(), companyId: company.id, label: "Home", icon: "Home", href: "/", visible: true, order: 0 },
    { id: uid(), companyId: company.id, label: "Services", icon: "Layers", href: "/services", visible: true, order: 1 },
    { id: uid(), companyId: company.id, label: "Online Queue", icon: "Ticket", href: "/queue", visible: true, order: 2 },
    { id: uid(), companyId: company.id, label: "Contact", icon: "Phone", href: "/contact", visible: true, order: 3 },
  ];
  const templates: TicketTemplate[] = [
    { id: uid(), companyId: company.id, name: "Default", header: "{{company_name}} — {{branch_name}}", footer: "Thank you for your visit", showQR: true, showBarcode: false },
  ];
  return {
    companies: [company], branches: [b1, b2], services, queues, counters, employees, devices,
    menus, pages: [], ticketTemplates: templates,
    currentCompanyId: company.id, currentBranchId: b1.id,
  };
};

const formatNumber = (q: Queue, seq: number) => {
  if (q.format.includes("{000}")) return q.format.replace("{000}", String(seq).padStart(3, "0"));
  if (q.format.includes("{0000}")) return q.format.replace("{0000}", String(seq).padStart(4, "0"));
  return `${q.prefix}${String(seq).padStart(3, "0")}`;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      companies: [], branches: [], services: [], queues: [], counters: [],
      employees: [], devices: [], menus: [], pages: [], ticketTemplates: [],
      tickets: [], orders: [], audit: [], notifications: [],

      setCurrentCompany: (id) => set({ currentCompanyId: id }),
      setCurrentBranch: (id) => set({ currentBranchId: id }),

      addCompany: (c) => {
        const company: Company = { ...c, id: uid(), createdAt: now() };
        set((s) => ({ companies: [...s.companies, company] }));
        get().log("admin", "Created company", company.name);
        return company;
      },
      removeCompany: (id) => set((s) => ({ companies: s.companies.filter((c) => c.id !== id) })),

      addBranch: (b) => { const x = { ...b, id: uid() }; set((s) => ({ branches: [...s.branches, x] })); get().log("admin", "Created branch", x.name); return x; },
      removeBranch: (id) => set((s) => ({ branches: s.branches.filter((b) => b.id !== id) })),
      updateBranch: (id, patch) => set((s) => ({ branches: s.branches.map((b) => b.id === id ? { ...b, ...patch } : b) })),

      addService: (s2) => { const x = { ...s2, id: uid() }; set((s) => ({ services: [...s.services, x] })); get().log("admin", "Created service", x.name); return x; },
      removeService: (id) => set((s) => ({ services: s.services.filter((x) => x.id !== id) })),

      addQueue: (q) => { const x = { ...q, id: uid() }; set((s) => ({ queues: [...s.queues, x] })); get().log("admin", "Created queue", x.name); return x; },
      removeQueue: (id) => set((s) => ({ queues: s.queues.filter((q) => q.id !== id) })),
      updateQueue: (id, patch) => set((s) => ({ queues: s.queues.map((q) => q.id === id ? { ...q, ...patch } : q) })),

      addCounter: (c) => { const x = { ...c, id: uid() }; set((s) => ({ counters: [...s.counters, x] })); get().log("admin", "Created counter", x.name); return x; },
      removeCounter: (id) => set((s) => ({ counters: s.counters.filter((c) => c.id !== id) })),
      updateCounter: (id, patch) => set((s) => ({ counters: s.counters.map((c) => c.id === id ? { ...c, ...patch } : c) })),

      addEmployee: (e) => { const x = { ...e, id: uid() }; set((s) => ({ employees: [...s.employees, x] })); get().log("admin", "Created employee", x.name); return x; },
      removeEmployee: (id) => set((s) => ({ employees: s.employees.filter((e) => e.id !== id) })),
      updateEmployee: (id, patch) => set((s) => ({ employees: s.employees.map((e) => e.id === id ? { ...e, ...patch } : e) })),

      addDevice: (d) => { const x = { ...d, id: uid() }; set((s) => ({ devices: [...s.devices, x] })); get().log("admin", "Registered device", x.name); return x; },
      removeDevice: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),
      toggleDevice: (id) => set((s) => ({ devices: s.devices.map((d) => d.id === id ? { ...d, status: d.status === "online" ? "offline" : "online" } : d) })),

      addMenu: (m) => { const x = { ...m, id: uid() }; set((s) => ({ menus: [...s.menus, x] })); return x; },
      removeMenu: (id) => set((s) => ({ menus: s.menus.filter((m) => m.id !== id) })),
      updateMenu: (id, patch) => set((s) => ({ menus: s.menus.map((m) => m.id === id ? { ...m, ...patch } : m) })),
      reorderMenu: (ids) => set((s) => ({ menus: s.menus.map((m) => ({ ...m, order: ids.indexOf(m.id) })) })),

      addPage: (p) => { const x = { ...p, id: uid() }; set((s) => ({ pages: [...s.pages, x] })); return x; },
      removePage: (id) => set((s) => ({ pages: s.pages.filter((p) => p.id !== id) })),
      updatePage: (id, patch) => set((s) => ({ pages: s.pages.map((p) => p.id === id ? { ...p, ...patch } : p) })),
      addBlock: (pageId, b) => set((s) => ({ pages: s.pages.map((p) => p.id === pageId ? { ...p, blocks: [...p.blocks, { ...b, id: uid() }] } : p) })),
      removeBlock: (pageId, blockId) => set((s) => ({ pages: s.pages.map((p) => p.id === pageId ? { ...p, blocks: p.blocks.filter((b) => b.id !== blockId) } : p) })),

      addTicketTemplate: (t) => { const x = { ...t, id: uid() }; set((s) => ({ ticketTemplates: [...s.ticketTemplates, x] })); return x; },
      updateTicketTemplate: (id, patch) => set((s) => ({ ticketTemplates: s.ticketTemplates.map((t) => t.id === id ? { ...t, ...patch } : t) })),
      removeTicketTemplate: (id) => set((s) => ({ ticketTemplates: s.ticketTemplates.filter((t) => t.id !== id) })),

      issueTicket: ({ queueId, source, customerName }) => {
        const s = get();
        const q = s.queues.find((x) => x.id === queueId);
        if (!q) return null;
        const today = new Date().toDateString();
        const seq = s.tickets.filter((t) => t.queueId === queueId && new Date(t.createdAt).toDateString() === today).length + 1;
        const ticket: Ticket = {
          id: uid(), number: formatNumber(q, seq), queueId, branchId: q.branchId, serviceId: q.serviceId,
          status: "waiting", source, customerName, createdAt: now(),
        };
        set((s2) => ({ tickets: [...s2.tickets, ticket] }));
        get().log(source === "online" ? "customer" : "kiosk", "Issued ticket", ticket.number);
        get().pushNotification({ title: "Ticket issued", body: `${ticket.number} — ${q.name}`, channel: "push" });
        return ticket;
      },

      callNext: (counterId, operatorId) => {
        const s = get();
        const counter = s.counters.find((c) => c.id === counterId);
        if (!counter) return null;
        // Mark previous serving as completed automatically? No, operator completes explicitly.
        const candidates = s.tickets
          .filter((t) => t.status === "waiting" && counter.queueIds.includes(t.queueId))
          .sort((a, b) => {
            const sa = s.services.find((x) => x.id === a.serviceId)?.priority ?? 99;
            const sb = s.services.find((x) => x.id === b.serviceId)?.priority ?? 99;
            if (sa !== sb) return sa - sb;
            return a.createdAt.localeCompare(b.createdAt);
          });
        const next = candidates[0];
        if (!next) return null;
        const updated: Ticket = { ...next, status: "called", counterId, operatorId, calledAt: now() };
        set((s2) => ({ tickets: s2.tickets.map((t) => t.id === next.id ? updated : t) }));
        get().log(operatorId ?? "operator", `Called ${next.number}`, counter.name);
        get().pushNotification({ title: "Now serving", body: `${next.number} → ${counter.name}`, channel: "push" });
        return updated;
      },

      recall: (ticketId) => {
        set((s) => ({ tickets: s.tickets.map((t) => t.id === ticketId ? { ...t, status: "called", calledAt: now() } : t) }));
        get().log("operator", "Recalled", ticketId);
      },
      completeTicket: (ticketId) => {
        set((s) => ({ tickets: s.tickets.map((t) => t.id === ticketId ? { ...t, status: "completed", completedAt: now() } : t) }));
        get().log("operator", "Completed", ticketId);
      },
      cancelTicket: (ticketId) => {
        set((s) => ({ tickets: s.tickets.map((t) => t.id === ticketId ? { ...t, status: "cancelled" } : t) }));
      },
      noShow: (ticketId) => {
        set((s) => ({ tickets: s.tickets.map((t) => t.id === ticketId ? { ...t, status: "no-show" } : t) }));
      },
      transferTicket: (ticketId, newCounterId) => {
        set((s) => ({ tickets: s.tickets.map((t) => t.id === ticketId ? { ...t, counterId: newCounterId, status: "waiting" } : t) }));
      },

      placeOrder: ({ branchId, items }) => {
        const total = items.reduce((a, b) => a + b.qty * b.price, 0);
        const seq = get().orders.filter((o) => o.branchId === branchId).length + 1;
        const o: Order = { id: uid(), branchId, number: `O${String(seq).padStart(3, "0")}`, items, total, status: "pending", createdAt: now() };
        set((s) => ({ orders: [...s.orders, o] }));
        get().log("customer", "Placed order", o.number);
        return o;
      },
      updateOrderStatus: (id, status) => {
        set((s) => ({ orders: s.orders.map((o) => o.id === id ? { ...o, status } : o) }));
      },

      log: (user, action, target) => set((s) => ({
        audit: [{ id: uid(), user, action, target, at: now(), ip: "127.0.0.1" }, ...s.audit].slice(0, 500),
      })),
      pushNotification: (n) => set((s) => ({
        notifications: [{ ...n, id: uid(), at: now(), read: false }, ...s.notifications].slice(0, 100),
      })),
      markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      seed: () => set(() => ({ ...(seedData() as State) })),
      reset: () => set({
        companies: [], branches: [], services: [], queues: [], counters: [], employees: [],
        devices: [], menus: [], pages: [], ticketTemplates: [], tickets: [], orders: [],
        audit: [], notifications: [], currentCompanyId: undefined, currentBranchId: undefined,
      }),
    }),
    {
      name: "qms-store-v1",
      onRehydrateStorage: () => (state) => {
        if (state && state.companies.length === 0) state.seed();
      },
    }
  )
);

import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers, Smartphone, Monitor, Ticket, BarChart3, Cpu } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Qubit — Universal Queue Management Platform" },
      { name: "description", content: "One platform to manage physical and online queues, tickets, displays, ordering, notifications and analytics." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Layers, title: "Queue Designer", desc: "Unlimited queues, custom prefixes and number formats." },
  { icon: Ticket, title: "Ticket Builder", desc: "Drag-and-drop ticket layouts with dynamic variables." },
  { icon: Monitor, title: "Live Displays", desc: "Waiting area and counter displays update in real time." },
  { icon: Smartphone, title: "Customer Portal", desc: "Online tickets, QR arrival verification, order ahead." },
  { icon: Cpu, title: "Device Management", desc: "Kiosks, printers, scanners and media displays in one place." },
  { icon: BarChart3, title: "Analytics", desc: "Wait times, peak hours, no-show rate and operator efficiency." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">Q</div>
            <span>Qubit</span>
          </Link>
          <nav className="hidden gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <Link to="/customer" className="hover:text-foreground">Customer App</Link>
            <Link to="/display" className="hover:text-foreground">Display</Link>
            <Link to="/kiosk" className="hover:text-foreground">Kiosk</Link>
            <Link to="/operator" className="hover:text-foreground">Operator</Link>
          </nav>
          <Link to="/app"><Button>Open Dashboard <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,oklch(0.72_0.16_180/0.18),transparent_50%),radial-gradient(circle_at_70%_60%,oklch(0.55_0.18_230/0.18),transparent_50%)]" />
        <div className="mx-auto max-w-7xl px-6 py-24 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Multi-company SaaS · Real-time
          </div>
          <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
            Run every queue, ticket and counter from one platform.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Qubit is a universal queue management & customer flow platform for banks, clinics, restaurants, government and retail. Configure everything yourself — no developer required.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/app"><Button size="lg">Launch Admin Dashboard</Button></Link>
            <Link to="/customer"><Button size="lg" variant="outline">Try Customer App</Button></Link>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group rounded-2xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-lg">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t bg-card/30">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-12 md:grid-cols-4">
          {[
            { label: "Admin Dashboard", to: "/app", desc: "Configure companies, branches, queues, devices." },
            { label: "Operator", to: "/operator", desc: "Call, recall, transfer and complete tickets." },
            { label: "Kiosk", to: "/kiosk", desc: "Self-service ticket issuing terminal." },
            { label: "Display", to: "/display", desc: "Live waiting-area screen." },
          ].map((c) => (
            <Link key={c.to} to={c.to} className="rounded-xl border bg-card p-5 transition hover:border-primary/40">
              <div className="text-sm text-muted-foreground">Open</div>
              <div className="mt-1 font-semibold">{c.label}</div>
              <div className="mt-2 text-sm text-muted-foreground">{c.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-muted-foreground">© Qubit Platform — Demo Build</div>
      </footer>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useStore, type PageBlock } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/qms/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/pages")({ component: Pages });

const BLOCK_TYPES: PageBlock["type"][] = ["heading", "text", "image", "button", "form", "queue-button", "faq", "banner"];

function Pages() {
  const { pages, currentCompanyId, addPage, removePage, addBlock, removeBlock } = useStore();
  const list = pages.filter((p) => p.companyId === currentCompanyId);
  const [selected, setSelected] = useState<string | undefined>(list[0]?.id);
  const page = list.find((p) => p.id === selected) ?? list[0];
  const [title, setTitle] = useState("");
  const [blockType, setBlockType] = useState<PageBlock["type"]>("heading");
  const [blockContent, setBlockContent] = useState("");

  return (
    <div>
      <PageHeader title="Page Builder" description="Drag-friendly visual pages — no code required" />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-sm">Pages</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input placeholder="New page title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Button size="icon" onClick={() => {
                if (!currentCompanyId || !title) return;
                const p = addPage({ companyId: currentCompanyId, title, slug: title.toLowerCase().replace(/\s+/g, "-"), blocks: [] });
                setSelected(p.id); setTitle("");
              }}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1">
              {list.map((p) => (
                <button key={p.id} onClick={() => setSelected(p.id)} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${page?.id === p.id ? "bg-secondary" : "hover:bg-secondary/50"}`}>
                  <span>{p.title}</span>
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); removePage(p.id); }} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">{page ? `Editing: ${page.title}` : "Select a page"}</CardTitle></CardHeader>
          <CardContent>
            {!page ? <EmptyState title="No page selected" /> : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Select value={blockType} onValueChange={(v) => setBlockType(v as PageBlock["type"])}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>{BLOCK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Block content / text / URL" value={blockContent} onChange={(e) => setBlockContent(e.target.value)} />
                  <Button onClick={() => { if (!blockContent) return toast.error("Enter content"); addBlock(page.id, { type: blockType, content: blockContent }); setBlockContent(""); }}>Add block</Button>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  {page.blocks.length === 0 ? <div className="text-sm text-muted-foreground">No blocks yet. Add headings, text, images, buttons, queue buttons, FAQs…</div> : (
                    <div className="space-y-3">
                      {page.blocks.map((b) => (
                        <div key={b.id} className="group flex items-start justify-between gap-2 rounded-md border bg-card p-3">
                          <div className="flex-1">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{b.type}</div>
                            {b.type === "heading" && <h2 className="text-2xl font-bold">{b.content}</h2>}
                            {b.type === "text" && <p>{b.content}</p>}
                            {b.type === "image" && <img src={b.content} alt="" className="max-h-40 rounded" />}
                            {b.type === "button" && <Button>{b.content}</Button>}
                            {b.type === "queue-button" && <Button variant="default">Take a ticket — {b.content}</Button>}
                            {b.type === "banner" && <div className="rounded-md bg-gradient-to-r from-primary to-accent p-4 text-primary-foreground">{b.content}</div>}
                            {b.type === "form" && <Textarea readOnly value={b.content} />}
                            {b.type === "faq" && <details className="rounded-md border p-3"><summary className="cursor-pointer font-medium">{b.content}</summary></details>}
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeBlock(page.id, b.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

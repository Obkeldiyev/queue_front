import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/lib/i18n";

export type CanvasBlock = {
  id: string;
  type: "text" | "image" | "services" | "queue";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  background: string;
  fontSize: number;
};
export type CanvasPage = {
  width: number;
  height: number;
  background: string;
  blocks: CanvasBlock[];
};
export const blankPage = (): CanvasPage => ({
  width: 1280,
  height: 800,
  background: "#f3f6fc",
  blocks: [],
});
export function CanvasView({
  page,
  slots = {},
  variables = {},
}: {
  page: CanvasPage;
  slots?: Record<string, ReactNode>;
  variables?: Record<string, string>;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${page.width}/${page.height}`,
        background: page.background,
        overflow: "hidden",
      }}
    >
      {page.blocks.map((b) => (
        <div
          key={b.id}
          style={{
            position: "absolute",
            left: `${(b.x / page.width) * 100}%`,
            top: `${(b.y / page.height) * 100}%`,
            width: `${(b.width / page.width) * 100}%`,
            height: `${(b.height / page.height) * 100}%`,
            color: b.color,
            background: b.background,
            fontSize: `${(b.fontSize / page.width) * 100}cqw`,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {b.type === "image" ? (
            <img
              draggable={false}
              src={b.content}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            (slots[b.type] ?? b.content.replace(/\{\{(\w+)\}\}/g, (m, key) => variables[key] ?? m))
          )}
        </div>
      ))}
    </div>
  );
}

export function CanvasDesigner({
  value,
  onChange,
  receipt = false,
}: {
  value: CanvasPage;
  onChange: (v: CanvasPage) => void;
  receipt?: boolean;
}) {
  const { lang } = useLang();
  const label = (en: string, ru: string, uz: string) =>
    lang === "ru" ? ru : lang === "uz" ? uz : en;
  const [selected, select] = useState<string>();
  const [past, setPast] = useState<CanvasPage[]>([]);
  const [future, setFuture] = useState<CanvasPage[]>([]);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    block: CanvasBlock;
    page: CanvasPage;
    resize: boolean;
  } | null>(null);
  const commit = (next: CanvasPage) => {
    setPast((p) => [...p.slice(-49), value]);
    setFuture([]);
    onChange(next);
  };
  const block = value.blocks.find((b) => b.id === selected);
  const update = (patch: Partial<CanvasBlock>) =>
    commit({
      ...value,
      blocks: value.blocks.map((b) => (b.id === selected ? { ...b, ...patch } : b)),
    });
  const add = (type: CanvasBlock["type"], content = "") => {
    const b: CanvasBlock = {
      id: crypto.randomUUID(),
      type,
      x: 10,
      y: 10,
      width: Math.min(value.width - 20, receipt ? 200 : 400),
      height: receipt ? 45 : 100,
      content: content || (type === "text" ? label("Your text", "Ваш текст", "Matningiz") : type),
      color: "#0f172a",
      background: "transparent",
      fontSize: receipt ? 16 : 30,
    };
    commit({ ...value, blocks: [...value.blocks, b] });
    select(b.id);
  };
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => add("text")}>
          {label("Add text", "Добавить текст", "Matn qo‘shish")}
        </Button>
        <label className="cursor-pointer rounded-md border px-3 py-2 text-sm">
          {label("Upload photo", "Загрузить фото", "Rasm yuklash")}
          <input
            className="hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) {
                alert(label("Maximum image size: 2 MB", "Максимум: 2 МБ", "Maksimum: 2 MB"));
                return;
              }
              const reader = new FileReader();
              reader.onload = () => add("image", String(reader.result));
              reader.readAsDataURL(file);
              e.target.value = "";
            }}
          />
        </label>
        {!receipt && (
          <>
            <Button variant="outline" onClick={() => add("services")}>
              {label("Services / menus", "Услуги / меню", "Xizmatlar / menyu")}
            </Button>
            <Button variant="outline" onClick={() => add("queue")}>
              {label("Live queue", "Живая очередь", "Jonli navbat")}
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          disabled={!past.length}
          onClick={() => {
            setFuture((f) => [value, ...f]);
            onChange(past[past.length - 1]);
            setPast((p) => p.slice(0, -1));
          }}
        >
          {label("Undo", "Отменить", "Bekor qilish")}
        </Button>
        <Button
          variant="ghost"
          disabled={!future.length}
          onClick={() => {
            setPast((p) => [...p, value]);
            onChange(future[0]);
            setFuture((f) => f.slice(1));
          }}
        >
          {label("Redo", "Повторить", "Qaytarish")}
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_230px]">
        <div className="min-w-0 overflow-auto rounded-xl bg-slate-200 p-4">
          <div
            ref={frame}
            tabIndex={0}
            style={{
              position: "relative",
              aspectRatio: `${value.width}/${value.height}`,
              width: "100%",
              background: value.background,
              touchAction: "none",
              containerType: "inline-size",
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || !frame.current) return;
              const r = frame.current.getBoundingClientRect();
              const dx = ((e.clientX - d.x) * value.width) / r.width,
                dy = ((e.clientY - d.y) * value.height) / r.height;
              const patch = d.resize
                ? {
                    width: Math.max(20, Math.min(value.width - d.block.x, d.block.width + dx)),
                    height: Math.max(20, Math.min(value.height - d.block.y, d.block.height + dy)),
                  }
                : {
                    x: Math.max(0, Math.min(value.width - d.block.width, d.block.x + dx)),
                    y: Math.max(0, Math.min(value.height - d.block.height, d.block.y + dy)),
                  };
              onChange({
                ...value,
                blocks: value.blocks.map((b) => (b.id === d.block.id ? { ...b, ...patch } : b)),
              });
            }}
            onPointerUp={() => {
              if (drag.current) {
                setPast((p) => [...p.slice(-49), drag.current!.page]);
                setFuture([]);
                drag.current = null;
              }
            }}
            onPointerCancel={() => {
              if (drag.current) onChange(drag.current.page);
              drag.current = null;
            }}
            onKeyDown={(e) => {
              if (!block || e.target !== e.currentTarget) return;
              if (e.key === "Delete") {
                commit({ ...value, blocks: value.blocks.filter((b) => b.id !== selected) });
              }
              if (e.key.startsWith("Arrow")) {
                e.preventDefault();
                update({
                  x: Math.max(
                    0,
                    Math.min(
                      value.width - block.width,
                      block.x +
                        (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0) *
                          (e.shiftKey ? 10 : 1),
                    ),
                  ),
                  y: Math.max(
                    0,
                    Math.min(
                      value.height - block.height,
                      block.y +
                        (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0) *
                          (e.shiftKey ? 10 : 1),
                    ),
                  ),
                });
              }
            }}
          >
            <CanvasView page={value} />
            {value.blocks.map((b) => (
              <div
                key={b.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  frame.current?.focus();
                  select(b.id);
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = {
                    x: e.clientX,
                    y: e.clientY,
                    block: { ...b },
                    page: value,
                    resize: (e.target as HTMLElement).dataset.resize === "true",
                  };
                }}
                style={{
                  position: "absolute",
                  left: `${(b.x / value.width) * 100}%`,
                  top: `${(b.y / value.height) * 100}%`,
                  width: `${(b.width / value.width) * 100}%`,
                  height: `${(b.height / value.height) * 100}%`,
                  border: `2px solid ${selected === b.id ? "#2563eb" : "transparent"}`,
                  cursor: "move",
                }}
              >
                {selected === b.id && (
                  <span
                    data-resize="true"
                    style={{
                      position: "absolute",
                      right: -7,
                      bottom: -7,
                      width: 16,
                      height: 16,
                      background: "#2563eb",
                      cursor: "nwse-resize",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <strong>{label("Canvas & layers", "Холст и слои", "Kanvas va qatlamlar")}</strong>
          <div className="grid grid-cols-2 gap-2">
            {(["width", "height"] as const).map((key) => (
              <label key={key}>
                {key} (px)
                <Input
                  type="number"
                  min={50}
                  max={4000}
                  value={value[key]}
                  onChange={(e) =>
                    commit({
                      ...value,
                      [key]: Math.max(50, Math.min(4000, Number(e.target.value))),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <input
            aria-label="Canvas background"
            type="color"
            value={value.background}
            onChange={(e) => commit({ ...value, background: e.target.value })}
          />
          {value.blocks.map((b) => (
            <button
              key={b.id}
              className={`block w-full truncate rounded border p-2 text-left ${selected === b.id ? "border-blue-500 bg-blue-50 text-slate-900" : ""}`}
              onClick={() => select(b.id)}
            >
              {b.type} · {b.type === "image" ? "Photo" : b.content}
            </button>
          ))}
          {block && (
            <div className="space-y-2 border-t pt-3">
              {block.type === "text" && (
                <textarea
                  className="w-full rounded border bg-background p-2"
                  value={block.content}
                  onChange={(e) => update({ content: e.target.value })}
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "width", "height", "fontSize"] as const).map((key) => (
                  <label key={key}>
                    {key}
                    <Input
                      type="number"
                      value={Math.round(block[key])}
                      onChange={(e) =>
                        update({
                          [key]: Math.max(
                            key === "x" || key === "y" ? 0 : 1,
                            Number(e.target.value),
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <input
                aria-label="Text color"
                type="color"
                value={block.color}
                onChange={(e) => update({ color: e.target.value })}
              />
              <Button
                variant="outline"
                onClick={() =>
                  commit({
                    ...value,
                    blocks: [...value.blocks.filter((b) => b.id !== selected), block],
                  })
                }
              >
                {label("Bring forward", "На передний план", "Oldinga")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  commit({ ...value, blocks: value.blocks.filter((b) => b.id !== selected) });
                  select(undefined);
                }}
              >
                {label("Delete layer", "Удалить слой", "Qatlamni o‘chirish")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

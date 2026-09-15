import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export function OperationsPanel({ admin = false }: { admin?: boolean }) {
  const { lang } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const qc = useQueryClient();
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("telegram");
  const [evidence, setEvidence] = useState<{ name: string; data: string } | null>(null);
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [page, setPage] = useState(1);
  const { data: list } = useQuery({
    queryKey: ["conversations", page],
    queryFn: () => api.get<any[]>(`/operations/conversations?page=${page}`),
    refetchInterval: 5000,
  });
  const { data: chat } = useQuery({
    queryKey: ["conversation", selected],
    enabled: !!selected,
    queryFn: () => api.get<any>(`/operations/conversations/${selected}`).then((r) => r.data),
    refetchInterval: 2000,
  });
  const action = useMutation({
    mutationFn: ({ url, body }: { url: string; body?: unknown }) => api.post<any>(url, body),
    onSuccess: (r) => {
      void qc.invalidateQueries({
        predicate: (q) =>
          /^(conversation|operations|operator-self-stats)/.test(String(q.queryKey[0])),
      });
      if (r.data?.id) setSelected(r.data.id);
      setMessage("");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-bold">
        {admin
          ? L("Customer conversations", "Разговоры с клиентами", "Mijoz suhbatlari")
          : L(
              "Online & external services",
              "Онлайн и внешние обращения",
              "Onlayn va tashqi xizmatlar",
            )}
      </h2>
      {!admin && (
        <Button
          disabled={action.isPending}
          onClick={() =>
            action.mutate({ url: "/operations/conversations", body: { channel: "online" } })
          }
        >
          {L("Create customer chat link", "Создать ссылку на чат", "Mijoz uchun chat havolasi")}
        </Button>
      )}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {list?.data.map((c) => (
            <button
              key={c.id}
              className={`block w-full rounded-xl border p-3 text-left ${selected === c.id ? "border-primary bg-primary/10" : ""}`}
              onClick={() => setSelected(c.id)}
            >
              <strong>
                {c.customer_name || L("Awaiting customer", "Ожидание клиента", "Mijoz kutilmoqda")}
              </strong>
              <div className="text-xs text-muted-foreground">
                {c.channel} · {c.status} · {new Date(c.created_at).toLocaleDateString()}
              </div>
            </button>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              ←
            </Button>
            <span className="p-2">{page}</span>
            <Button
              variant="outline"
              disabled={page * 30 >= (list?.meta?.total || 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              →
            </Button>
          </div>
        </div>
        {chat && (
          <div className="space-y-3 rounded-xl border p-4">
            {chat.channel === "online" && (
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(`${window.location.origin}/chat?token=${chat.token}`)
                    .then(() =>
                      toast.success(L("Link copied", "Ссылка скопирована", "Havola nusxalandi")),
                    )
                    .catch(() => toast.error("Clipboard unavailable"))
                }
              >
                {L("Copy invitation link", "Копировать приглашение", "Taklif havolasini nusxalash")}
              </Button>
            )}
            <div className="max-h-96 space-y-2 overflow-auto" aria-live="polite">
              {chat.messages?.map((m: any) => (
                <div
                  key={m.id}
                  className={`rounded-xl p-3 ${m.sender === "operator" ? "ml-10 bg-primary/10" : "mr-10 bg-muted"}`}
                >
                  <small>
                    {m.sender} · {new Date(m.created_at).toLocaleTimeString()}
                  </small>
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                </div>
              ))}
            </div>
            {chat.evidence && (
              <a
                className="text-primary underline"
                href={chat.evidence.data}
                download={chat.evidence.name}
              >
                {L("Download evidence", "Скачать подтверждение", "Dalilni yuklab olish")}:{" "}
                {chat.evidence.name}
              </a>
            )}
            {!admin && chat.status === "ACTIVE" && (
              <>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    action.mutate({
                      url: `/operations/conversations/${selected}/messages`,
                      body: { text: message },
                    });
                  }}
                >
                  <Input
                    aria-label="Message"
                    maxLength={4000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <Button disabled={!message.trim() || action.isPending}>
                    {L("Send", "Отправить", "Yuborish")}
                  </Button>
                </form>
                <Button
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate({ url: `/operations/conversations/${selected}/complete` })
                  }
                >
                  {L("End & count as served", "Завершить обслуживание", "Yakunlash va hisoblash")}
                </Button>
              </>
            )}
            <p className="text-sm text-muted-foreground">{chat.status}</p>
          </div>
        )}
      </div>
      {!admin && (
        <>
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-semibold">
              {L(
                "Record Telegram / other service",
                "Записать обращение из Telegram / другого канала",
                "Telegram / boshqa xizmatni qayd etish",
              )}
            </summary>
            <div className="mt-3 grid gap-3">
              <Input
                placeholder={L("Customer name", "Имя клиента", "Mijoz ismi")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <select
                className="rounded border bg-background p-2"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="telegram">Telegram</option>
                <option value="phone">Phone</option>
                <option value="other">Other</option>
              </select>
              <input
                type="file"
                accept=".pdf,.txt,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 2 * 1024 * 1024) {
                    toast.error("Maximum 2 MB");
                    return;
                  }
                  const r = new FileReader();
                  r.onload = () => setEvidence({ name: f.name, data: String(r.result) });
                  r.readAsDataURL(f);
                }}
              />
              <Button
                disabled={!name.trim() || !evidence || action.isPending}
                onClick={() =>
                  action.mutate(
                    {
                      url: "/operations/conversations",
                      body: { channel, customer_name: name, evidence },
                    },
                    {
                      onSuccess: () => {
                        setName("");
                        setEvidence(null);
                        toast.success(
                          L("Service recorded", "Обращение записано", "Xizmat qayd etildi"),
                        );
                      },
                    },
                  )
                }
              >
                {L(
                  "Save completed service",
                  "Сохранить обслуживание",
                  "Bajarilgan xizmatni saqlash",
                )}
              </Button>
            </div>
          </details>
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-semibold">
              {L(
                "My profile · Change password",
                "Мой профиль · Сменить пароль",
                "Profilim · Parolni o‘zgartirish",
              )}
            </summary>
            <form
              className="mt-3 flex flex-wrap gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                action.mutate(
                  {
                    url: "/operations/password",
                    body: { current_password: password, new_password: nextPassword },
                  },
                  {
                    onSuccess: () => {
                      setPassword("");
                      setNextPassword("");
                      toast.success(L("Password changed", "Пароль изменён", "Parol o‘zgartirildi"));
                    },
                  },
                );
              }}
            >
              <Input
                className="max-w-xs"
                type="password"
                autoComplete="current-password"
                placeholder={L("Current password", "Текущий пароль", "Joriy parol")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                className="max-w-xs"
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder={L("New password", "Новый пароль", "Yangi parol")}
                value={nextPassword}
                onChange={(e) => setNextPassword(e.target.value)}
              />
              <Button disabled={action.isPending || !password || nextPassword.length < 8}>
                {L("Change password", "Сменить пароль", "Parolni almashtirish")}
              </Button>
            </form>
          </details>
        </>
      )}
    </section>
  );
}

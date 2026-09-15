import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, employeesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { attachmentLabel, isImageAttachment, readChatAttachment, type ChatAttachment } from "@/lib/chat-attachments";
export function OperationsPanel({ admin = false }: { admin?: boolean }) {
  const { user, setUser } = useAuthStore();
  const { lang } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const qc = useQueryClient();
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [chatAttachment, setChatAttachment] = useState<ChatAttachment | null>(null);
  const [chatFileError, setChatFileError] = useState("");
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("telegram");
  const [evidence, setEvidence] = useState<{ name: string; data: string } | null>(null);
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [avatarError, setAvatarError] = useState("");
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

  const avatarMutation = useMutation({
    mutationFn: (avatar_url: string | null) => {
      if (!user?.id) throw new Error("No operator profile loaded");
      return employeesApi.update(user.id, { avatar_url });
    },
    onSuccess: (res) => {
      setUser(user ? { ...user, avatar_url: res.data.avatar_url ?? null } : user);
      toast.success(L("Profile photo updated", "Фото профиля обновлено", "Profil rasmi yangilandi"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L("Failed to update photo", "Не удалось обновить фото", "Rasmni yangilab bo‘lmadi")),
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
      setChatAttachment(null);
      setChatFileError("");
      if (chatFileInputRef.current) chatFileInputRef.current.value = "";
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
                    .catch(() => toast.error(L("Clipboard unavailable", "Буфер обмена недоступен", "Bufer mavjud emas")))
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
                  {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                  {m.attachment && (
                    <div className="mt-2 rounded-lg border bg-background/80 p-2">
                      {isImageAttachment(m.attachment) && (
                        <img
                          className="mb-2 max-h-48 rounded-md object-contain"
                          src={m.attachment.data}
                          alt={m.attachment.name || "attachment"}
                        />
                      )}
                      <a
                        className="font-medium text-primary underline"
                        href={m.attachment.data}
                        download={m.attachment.name || "attachment"}
                      >
                        📎 {attachmentLabel(m.attachment)}
                      </a>
                    </div>
                  )}
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
                  className="grid gap-2 sm:grid-cols-[1fr_auto]"
                  onSubmit={(e) => {
                    e.preventDefault();
                    action.mutate({
                      url: `/operations/conversations/${selected}/messages`,
                      body: { text: message, attachment: chatAttachment },
                    });
                  }}
                >
                  <Input
                    aria-label="Message"
                    maxLength={4000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <Button disabled={(!message.trim() && !chatAttachment) || action.isPending}>
                    {L("Send", "Отправить", "Yuborish")}
                  </Button>
                  <div className="sm:col-span-2">
                    <input
                      ref={chatFileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                          setChatAttachment(null);
                          return;
                        }
                        readChatAttachment(file)
                          .then((next) => {
                            setChatAttachment(next);
                            setChatFileError("");
                          })
                          .catch((err) => {
                            setChatAttachment(null);
                            setChatFileError(err instanceof Error ? err.message : L("Invalid file", "Недопустимый файл", "Noto‘g‘ri fayl"));
                            e.currentTarget.value = "";
                          });
                      }}
                    />
                    {chatAttachment && (
                      <button
                        type="button"
                        className="mt-1 block text-left text-sm text-primary underline"
                        onClick={() => {
                          setChatAttachment(null);
                          if (chatFileInputRef.current) chatFileInputRef.current.value = "";
                        }}
                      >
                        {L("Remove", "Удалить", "Olib tashlash")} {attachmentLabel(chatAttachment)}
                      </button>
                    )}
                    {chatFileError && <p className="text-sm text-destructive">{chatFileError}</p>}
                  </div>
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
                <option value="phone">{L("Phone", "Телефон", "Telefon")}</option>
                <option value="other">{L("Other", "Другое", "Boshqa")}</option>
              </select>
              <input
                type="file"
                accept=".pdf,.txt,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 2 * 1024 * 1024) {
                    toast.error(L("Maximum 2 MB", "Максимум 2 МБ", "Maksimum 2 MB"));
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
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 p-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-bold text-primary">
                {user?.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="text-xs"
                  disabled={avatarMutation.isPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1024 * 1024) {
                      setAvatarError(L("Maximum image size is 1 MB", "Максимум 1 МБ", "Maksimum 1 MB"));
                      e.currentTarget.value = "";
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setAvatarError("");
                      avatarMutation.mutate(String(reader.result));
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                {user?.avatar_url && <button type="button" className="block text-xs text-destructive underline" onClick={() => avatarMutation.mutate(null)}>{L("Remove photo", "Удалить фото", "Rasmni olib tashlash")}</button>}
                {avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
              </div>
            </div>
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

import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang, LANGS } from "@/lib/i18n";
import {
  attachmentLabel,
  isImageAttachment,
  readChatAttachment,
  type ChatAttachment,
} from "@/lib/chat-attachments";

export const Route = createFileRoute("/chat")({ component: Chat });

function Chat() {
  const { lang, setLang } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const qc = useQueryClient();
  const token =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("token") || "";
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [joined, setJoined] = useState(false);
  const { data: chat, error } = useQuery({
    queryKey: ["customer-chat", token],
    enabled: !!token,
    queryFn: () => api.get<any>(`/operations/chat/${token}`).then((r) => r.data),
    refetchInterval: 2000,
    retry: false,
  });
  const send = useMutation({
    mutationFn: (join: boolean) =>
      api.post(
        `/operations/chat/${token}/${join ? "join" : "messages"}`,
        join ? { name } : { text, attachment },
      ),
    onSuccess: (_, join) => {
      if (join) setJoined(true);
      setText("");
      setAttachment(null);
      setFileError("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      void qc.invalidateQueries({ queryKey: ["customer-chat", token] });
    },
  });
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_35%),linear-gradient(135deg,#eef2ff,#f8fafc_45%,#ecfeff)] px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[82vh] max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-2xl shadow-slate-300/60 backdrop-blur">
        <div className="flex items-center justify-between border-b bg-slate-950 px-5 py-4 text-white">
          <strong className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400 text-slate-950">Q</span>
            Qubit · {L("Customer care", "Поддержка", "Mijozlar yordami")}
          </strong>
          <div className="flex gap-1 rounded-full bg-white/10 p-1 text-xs">
            {LANGS.map((l) => (
              <button
                key={l.code}
                className={`rounded-full px-2 py-1 ${lang === l.code ? "bg-cyan-400 text-slate-950" : "text-white/70"}`}
                onClick={() => setLang(l.code)}
              >
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
          <div>
            <h1 className="text-2xl font-bold">
              {L(
                "Welcome. How can we help?",
                "Здравствуйте. Чем помочь?",
                "Xush kelibsiz. Qanday yordam beramiz?",
              )}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {L("Send a message or attach a document/photo.", "Напишите сообщение или прикрепите документ/фото.", "Xabar yozing yoki hujjat/rasm biriktiring.")}
            </p>
          </div>
          {(!token || error) && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
              {error?.message ||
                L("Invalid invitation", "Недействительное приглашение", "Noto‘g‘ri taklif")}
            </p>
          )}
          {chat?.status === "COMPLETED" ? (
            <p className="rounded-xl bg-emerald-50 p-4 text-emerald-700">
              {L(
                "This conversation has ended. Thank you!",
                "Разговор завершён. Спасибо!",
                "Suhbat yakunlandi. Rahmat!",
              )}
            </p>
          ) : chat && !chat.customer_name ? (
            <form
              className="mt-auto space-y-3 rounded-2xl border bg-white p-4 shadow-sm"
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate(true);
              }}
            >
              <label className="block text-sm font-medium">
                {L("Your name", "Ваше имя", "Ismingiz")}
                <Input
                  className="mt-1"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <Button className="w-full" disabled={send.isPending}>
                {L("Start conversation", "Начать разговор", "Suhbatni boshlash")}
              </Button>
            </form>
          ) : (
            chat && (
              <>
                <div className="min-h-[42vh] flex-1 space-y-3 overflow-auto rounded-3xl bg-slate-100/80 p-3" aria-live="polite">
                  {chat.messages.map((m: any) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${m.sender === "customer" ? "ml-auto rounded-br-md bg-blue-600 text-white" : "mr-auto rounded-bl-md bg-white text-slate-900"}`}
                    >
                      <small className="mb-1 block text-[11px] opacity-70">
                        {m.sender === "customer"
                          ? chat.customer_name
                          : L("Operator", "Оператор", "Operator")}
                      </small>
                      {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                      {m.attachment && (
                        <div className="mt-2 rounded-xl border bg-white/85 p-2 text-slate-900">
                          {isImageAttachment(m.attachment) && (
                            <img
                              className="mb-2 max-h-48 rounded-lg object-contain"
                              src={m.attachment.data}
                              alt={m.attachment.name || "attachment"}
                            />
                          )}
                          <a
                            className="font-medium text-blue-700 underline"
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
                <form
                  className="grid gap-3 rounded-3xl border bg-white p-3 shadow-sm sm:grid-cols-[1fr_auto]"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send.mutate(false);
                  }}
                >
                  <Input
                    aria-label="Message"
                    maxLength={4000}
                    placeholder={L("Write a message…", "Напишите сообщение…", "Xabar yozing…")}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <Button disabled={send.isPending || (!text.trim() && !attachment)}>
                    {L("Send", "Отправить", "Yuborish")}
                  </Button>
                  <div className="sm:col-span-2">
                    <input
                      ref={fileInputRef}
                      className="block w-full rounded-xl border border-dashed p-2 text-sm"
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                          setAttachment(null);
                          return;
                        }
                        readChatAttachment(file)
                          .then((next) => {
                            setAttachment(next);
                            setFileError("");
                          })
                          .catch((err) => {
                            setAttachment(null);
                            setFileError(err instanceof Error ? err.message : L("Invalid file", "Недопустимый файл", "Noto‘g‘ri fayl"));
                            e.currentTarget.value = "";
                          });
                      }}
                    />
                    {attachment && (
                      <button
                        type="button"
                        className="mt-1 block text-left text-sm text-blue-700 underline"
                        onClick={() => {
                          setAttachment(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        {L("Remove", "Удалить", "Olib tashlash")} {attachmentLabel(attachment)}
                      </button>
                    )}
                    {fileError && <p className="text-sm text-red-600">{fileError}</p>}
                  </div>
                </form>
              </>
            )
          )}
          {send.error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
              {send.error.message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
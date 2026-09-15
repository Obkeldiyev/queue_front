import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang, LANGS } from "@/lib/i18n";
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
        join ? { name } : { text },
      ),
    onSuccess: (_, join) => {
      if (join) setJoined(true);
      setText("");
      void qc.invalidateQueries({ queryKey: ["customer-chat", token] });
    },
  });
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-xl space-y-5 rounded-3xl bg-white p-6 shadow-lg">
        <div className="flex justify-between">
          <strong>Qubit · {L("Customer care", "Поддержка", "Mijozlar yordami")}</strong>
          <div className="flex gap-2">
            {LANGS.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)}>
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <h1 className="text-2xl font-bold">
          {L(
            "Welcome. How can we help?",
            "Здравствуйте. Чем помочь?",
            "Xush kelibsiz. Qanday yordam beramiz?",
          )}
        </h1>
        {(!token || error) && (
          <p role="alert">
            {error?.message ||
              L("Invalid invitation", "Недействительное приглашение", "Noto‘g‘ri taklif")}
          </p>
        )}
        {chat?.status === "COMPLETED" ? (
          <p>
            {L(
              "This conversation has ended. Thank you!",
              "Разговор завершён. Спасибо!",
              "Suhbat yakunlandi. Rahmat!",
            )}
          </p>
        ) : chat && !joined ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              send.mutate(true);
            }}
          >
            <label>
              {L("Your name", "Ваше имя", "Ismingiz")}
              <Input
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <Button disabled={send.isPending}>
              {L("Start conversation", "Начать разговор", "Suhbatni boshlash")}
            </Button>
          </form>
        ) : (
          chat && (
            <>
              <div className="max-h-[55vh] space-y-3 overflow-auto" aria-live="polite">
                {chat.messages.map((m: any) => (
                  <div
                    key={m.id}
                    className={`rounded-xl p-3 ${m.sender === "customer" ? "ml-8 bg-blue-100" : "mr-8 bg-slate-100"}`}
                  >
                    <small>
                      {m.sender === "customer"
                        ? chat.customer_name
                        : L("Operator", "Оператор", "Operator")}
                    </small>
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  </div>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send.mutate(false);
                }}
              >
                <Input
                  aria-label="Message"
                  maxLength={4000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <Button disabled={send.isPending || !text.trim()}>
                  {L("Send", "Отправить", "Yuborish")}
                </Button>
              </form>
            </>
          )
        )}
        {send.error && (
          <p role="alert" className="text-red-600">
            {send.error.message}
          </p>
        )}
      </div>
    </main>
  );
}

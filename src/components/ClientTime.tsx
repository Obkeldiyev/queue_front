import { useEffect, useState } from "react";

export default function ClientTime({ iso }: { iso: string }) {
  const [time, setTime] = useState<string>("");
  useEffect(() => {
    try {
      setTime(new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setTime(iso);
    }
  }, [iso]);
  return <>{time}</>;
}

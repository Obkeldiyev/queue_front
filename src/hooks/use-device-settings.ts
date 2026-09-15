import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { devicesApi } from "@/lib/api";
import type { CanvasPage } from "@/components/qms/CanvasDesigner";
export type DeviceDesign = {
  theme?: string;
  displayTheme?: string;
  menu_id?: string;
  pages?: Record<string, CanvasPage>;
  ticket_template_id?: string;
};
export function useDeviceSettings(id: string | null) {
  const query = useQuery({
    queryKey: ["device-settings", id],
    enabled: !!id,
    queryFn: () => devicesApi.get(id!).then((r) => r.data),
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (query.data && id) {
      localStorage.setItem(`paired_device_${id}`, JSON.stringify(query.data));
      window.dispatchEvent(
        new CustomEvent("qubit:settings-changed", {
          detail: { deviceId: id, settings: query.data.settings ?? {} },
        }),
      );
    }
  }, [query.data, id]);
  return { device: query.data, settings: (query.data?.settings ?? {}) as DeviceDesign };
}

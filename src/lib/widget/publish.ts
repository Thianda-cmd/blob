import { blobApp, isPhoneApp, setWidget } from "@/lib/native";
import type { WidgetData } from "./snapshot";

/** What the widgets were last given (without its time), so nothing is sent twice. */
let last: string | undefined;

/** Gives the phone's widgets their data, or empties them (null: signed out). */
export async function publishWidget(data: WidgetData | null): Promise<void> {
  if (!isPhoneApp(blobApp())) return;
  const key = data ? JSON.stringify({ ...data, at: 0 }) : "";
  if (key === last) return;
  last = key;
  await setWidget(data ? JSON.stringify(data) : "");
}

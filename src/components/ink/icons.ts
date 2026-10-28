import { Feather, Highlighter, Pencil, PenLine, PenTool } from "lucide-react";
import type { PenTool as Pen } from "@/ink/model";

/** Each pen's icon (the toolbar shows the pen in use). */
export const PEN_ICONS: Record<Pen, typeof PenLine> = { pen: PenLine, fountain: PenTool, pencil: Pencil, calligraphy: Feather, highlighter: Highlighter };

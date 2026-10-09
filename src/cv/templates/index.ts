import type { CvTemplateId } from "../types";
import { classic } from "./classic";
import { compact } from "./compact";
import { creative } from "./creative";
import { elegant } from "./elegant";
import { minimal } from "./minimal";
import { modern } from "./modern";
import type { CvTemplate } from "./types";

const TEMPLATES: Record<CvTemplateId, CvTemplate> = { classic, modern, minimal, creative, compact, elegant };

export const templateFor = (id: CvTemplateId): CvTemplate => TEMPLATES[id] ?? classic;

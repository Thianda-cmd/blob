import { stepsView, timelineView } from "../../build";
import type { AtlasModel } from "../../types";
import { KOCH, PASTEUR, TIMELINE } from "./content";
import * as d from "./drawings";

const model: AtlasModel = {
  slug: "history",
  views: [
    timelineView("timeline", TIMELINE),
    stepsView("pasteur", PASTEUR, { width: d.PASTEUR_W, height: d.PASTEUR_H, Drawing: d.Pasteur }),
    stepsView("koch", KOCH, { width: d.KOCH_W, height: d.KOCH_H, Drawing: d.Koch }),
  ],
};

export default model;

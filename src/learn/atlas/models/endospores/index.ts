import { partsView, stepsView } from "../../build";
import type { AtlasModel } from "../../types";
import { GERMINATION, POSITION, SPORULATION, STRUCTURE } from "./content";
import * as d from "./drawings";

const model: AtlasModel = {
  slug: "endospores",
  views: [
    partsView("structure", STRUCTURE, { width: d.STRUCT_W, height: d.STRUCT_H, spots: d.STRUCT_SPOTS, Drawing: d.SporeStructure, fit: [24, 28, 560, 470] }),
    stepsView("sporulation", SPORULATION, { width: d.SPOR_W, height: d.SPOR_H, Drawing: d.Sporulation }),
    stepsView("germination", GERMINATION, { width: d.GERM_W, height: d.GERM_H, Drawing: d.Germination }),
    partsView("position", POSITION, { width: d.POS_W, height: d.POS_H, spots: d.POS_SPOTS, Drawing: d.Position }),
  ],
};

export default model;

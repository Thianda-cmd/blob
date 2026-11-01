import { partsView } from "../../build";
import type { AtlasModel } from "../../types";
import { ACTIVE, PASSIVE, VESICLES } from "./content";
import * as d from "./drawings";

const model: AtlasModel = {
  slug: "membrane-transport",
  views: [
    partsView("passive", PASSIVE, { width: d.W, height: d.H, spots: d.PASSIVE_SPOTS, Drawing: d.Passive, fit: [0, 40, 900, 436] }),
    partsView("active", ACTIVE, { width: d.W, height: d.H, spots: d.ACTIVE_SPOTS, Drawing: d.Active, fit: [0, 48, 900, 428] }),
    partsView("vesicles", VESICLES, { width: d.W, height: d.H, spots: d.VESICLE_SPOTS, Drawing: d.Vesicles, fit: [0, 48, 900, 420] }),
  ],
};

export default model;

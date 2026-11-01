import { partsView } from "../../build";
import type { AtlasModel } from "../../types";
import { GRAM_NEGATIVE, GRAM_POSITIVE, MUREIN } from "./content";
import * as d from "./drawings";

const model: AtlasModel = {
  slug: "cell-wall",
  views: [
    partsView("gram-positive", GRAM_POSITIVE, { width: d.W, height: d.POS_H, spots: d.POS_SPOTS, Drawing: d.GramPositive, fit: [0, 28, 900, 424] }),
    partsView("gram-negative", GRAM_NEGATIVE, { width: d.W, height: d.NEG_H, spots: d.NEG_SPOTS, Drawing: d.GramNegative, fit: [0, 36, 900, 404] }),
    partsView("murein", MUREIN, { width: d.W, height: d.MUR_H, spots: d.MUR_SPOTS, Drawing: d.Murein, fit: [0, 64, 900, 450] }),
  ],
};

export default model;

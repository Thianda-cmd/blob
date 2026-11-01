import { stepsView } from "../../build";
import type { AtlasModel } from "../../types";
import { PROCEDURE } from "./content";
import { GramStain, H, W } from "./drawing";

const model: AtlasModel = {
  slug: "gram-stain",
  views: [stepsView("procedure", PROCEDURE, { width: W, height: H, Drawing: GramStain })],
};

export default model;

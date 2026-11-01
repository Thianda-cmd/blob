import { partsView } from "../../build";
import type { AtlasModel } from "../../types";
import { ANIMAL, PLANT } from "./content";
import * as d from "./drawings";

const model: AtlasModel = {
  slug: "eukaryotic-cell",
  views: [
    partsView("animal", ANIMAL, { width: d.W, height: d.H, spots: d.ANIMAL_SPOTS, Drawing: d.AnimalCell, fit: [164, 44, 590, 528] }),
    partsView("plant", PLANT, { width: d.W, height: d.H, spots: d.PLANT_SPOTS, Drawing: d.PlantCell, fit: [160, 22, 580, 556] }),
  ],
};

export default model;

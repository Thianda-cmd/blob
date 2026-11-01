import { partsView } from "../../build";
import type { AtlasModel } from "../../types";
import { FLAGELLA, MOTOR, SHAPES, STRUCTURE } from "./content";
import * as flagella from "./flagella";
import * as motor from "./motor";
import * as shapes from "./shapes";
import * as structure from "./structure";

const model: AtlasModel = {
  slug: "bacterial-cell",
  views: [
    partsView("structure", STRUCTURE, { width: structure.W, height: structure.H, spots: structure.SPOTS, Drawing: structure.Structure, fit: [0, 108, 900, 330] }),
    partsView("shapes", SHAPES, { width: shapes.W, height: shapes.H, spots: shapes.SPOTS, Drawing: shapes.Shapes }),
    partsView("flagella", FLAGELLA, { width: flagella.W, height: flagella.H, spots: flagella.SPOTS, Drawing: flagella.Flagella }),
    partsView("motor", MOTOR, { width: motor.W, height: motor.H, spots: motor.SPOTS, Drawing: motor.Motor }),
  ],
};

export default model;

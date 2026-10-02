import type { Topic } from "@/learn/types";
import acidsBases from "./acids-bases";
import alkanes from "./alkanes";
import atoms from "./atoms";
import balancing from "./balancing";
import covalentBonds from "./covalent-bonds";
import ionicBonds from "./ionic-bonds";
import mixtures from "./mixtures";
import moles from "./moles";
import particles from "./particles";
import periodicTable from "./periodic-table";
import reactions from "./reactions";
import redox from "./redox";

/** Chemistry topics in the order they're suggested (same order as CHEMISTRY_CATALOG). */
export const CHEMISTRY: Topic[] = [
  particles,
  mixtures,
  atoms,
  periodicTable,
  ionicBonds,
  covalentBonds,
  reactions,
  balancing,
  acidsBases,
  redox,
  moles,
  alkanes,
];

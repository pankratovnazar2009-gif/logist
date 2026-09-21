import { REGION_CODES, TRUCK_VALUES } from "../types";
import type { Messages } from "./messages";

export interface Option {
  value: string;
  label: string;
}

/** Регионы и кузова с подписями на выбранном языке. */
export const regionOptions = (m: Messages): Option[] => REGION_CODES.map((code) => ({ value: code, label: m.regions[code] }));
export const truckOptions = (m: Messages): Option[] => TRUCK_VALUES.map((value) => ({ value, label: m.trucks[value] }));

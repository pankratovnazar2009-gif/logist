import type { Locale } from "../locales";
import { en } from "./en";
import { pl, type Messages } from "./pl";
import { ru } from "./ru";
import { uk } from "./uk";

export type { Messages };

const MESSAGES: Record<Locale, Messages> = { pl, en, ru, uk };

export const getMessages = (locale: Locale): Messages => MESSAGES[locale];

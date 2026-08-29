import type { Db } from "mongodb";
import type { GeneralSettings } from "../app/domain.ts";

export const GENERAL_SETTINGS_ID = "general-preferences";
export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = { hideFinancialAmountsByDefault: true };

export function validateGeneralSettings(value: unknown): GeneralSettings {
  const hideFinancialAmountsByDefault = (value as Record<string, unknown> | null)?.hideFinancialAmountsByDefault;
  if (typeof hideFinancialAmountsByDefault !== "boolean") throw new Error("قيمة خصوصية المبالغ غير صالحة");
  return { hideFinancialAmountsByDefault };
}

export async function getGeneralSettings(db: Db): Promise<GeneralSettings> {
  const value = await db.collection<{ _id: string; [key: string]: unknown }>("appSettings").findOne({ _id: GENERAL_SETTINGS_ID });
  if (!value) return DEFAULT_GENERAL_SETTINGS;
  try { return validateGeneralSettings(value); } catch { return DEFAULT_GENERAL_SETTINGS; }
}

export async function saveGeneralSettings(db: Db, value: unknown) {
  const settings = validateGeneralSettings(value);
  await db.collection<{ _id: string; [key: string]: unknown }>("appSettings").updateOne(
    { _id: GENERAL_SETTINGS_ID },
    { $set: { ...settings, schemaVersion: 1, updatedAt: new Date() } },
    { upsert: true },
  );
  return settings;
}

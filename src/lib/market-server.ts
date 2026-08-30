import "server-only";
import { getMarket, getMandiRows, type CropMarket, type MandiRow } from "./market";

/**
 * `getMarket` / `getMandiRows` with the data.gov.in key read here and nowhere
 * else.
 *
 * The key is server-only, but page and route components were reading
 * `process.env.DATA_GOV_API_KEY` inline — safe today (they are Server
 * Components) but one `"use client"` away from bundling the key. Funnelling the
 * read through this `server-only` module removes that footgun: a client
 * component that imports this file fails the build instead.
 */
const key = () => process.env.DATA_GOV_API_KEY ?? null;

export function getMarketForState(state: string | null): Promise<CropMarket[]> {
  return getMarket(state, key());
}

export function getMandiRowsForState(
  cropName: string,
  state: string | null
): Promise<MandiRow[]> {
  return getMandiRows(cropName, state, key());
}

/** Whether live Agmarknet data is configured — for the "demo mode" badge. */
export function hasMarketKey(): boolean {
  return !!process.env.DATA_GOV_API_KEY;
}

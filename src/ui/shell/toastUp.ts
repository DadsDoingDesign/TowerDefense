import { create } from 'zustand'

/**
 * Whether the receipt toast (`ReceiptToast`, "… joins your heroes") is on
 * screen. View state only, never saved: the Coach's top-edge pill waits on it
 * (job critique leftovers, Oct 2026) — the toast takes the band under the
 * header, and a pill that came up with it stepped under it and over the
 * field's top row. The pill speaks once the toast has cleared.
 */
export const useToastUp = create<{ up: boolean }>(() => ({ up: false }))

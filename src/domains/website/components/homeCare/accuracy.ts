/**
 * What to tell the person about how sure the device is of where they are. A phone's GPS is usually within a few tens of
 * metres; a laptop often places itself from the network and can be hundreds of metres to kilometres off, so it must say so
 * and ask the person to put the pin on their gate.
 */
export const accuracyNote = (metres: number | null): { text: string; tone: "ok" | "warn" } | null => {
  if (metres === null || !Number.isFinite(metres)) return null;
  if (metres <= 50) return { text: `Your device placed you within about ${Math.max(Math.round(metres), 5)} metres. Check the pin is at your gate.`, tone: "ok" };
  if (metres <= 300) return { text: `Your device placed you within about ${Math.round(metres)} metres. Move the map until the pin is at your gate.`, tone: "warn" };
  const far = metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} metres`;
  return { text: `Your device could only place you roughly (about ${far}). Move the map until the pin is at your gate, or search for your address.`, tone: "warn" };
};

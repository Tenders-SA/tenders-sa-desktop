export function readableTenderDocumentName(value?: string | null): string {
  if (!value) return "Tender document";
  const filename = value.split(/[\\/]/).pop() ?? value;
  const stem = filename
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .replace(/^(?:[a-f0-9]{8,}|\d{6,})[-_ ]+/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stem) return "Tender document";
  return stem
    .split(" ")
    .map((word) => {
      const upper = word.toUpperCase();
      return ["RFQ", "RFP", "SBD", "PDF", "BOQ"].includes(upper)
        ? upper
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

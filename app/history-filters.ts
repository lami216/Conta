import type { DocumentRecord } from "./domain";

export function localBusinessDay(value: Date | string = new Date()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function sortDocumentsBySequence(documents: DocumentRecord[]) {
  return documents.map((document, index) => ({ document, index })).sort((left, right) => {
    const leftSequence = Number(left.document.sequence);
    const rightSequence = Number(right.document.sequence);
    const leftSequenced = Number.isSafeInteger(leftSequence) && leftSequence > 0;
    const rightSequenced = Number.isSafeInteger(rightSequence) && rightSequence > 0;
    if (leftSequenced && rightSequenced) return rightSequence - leftSequence || left.index - right.index;
    if (leftSequenced !== rightSequenced) return leftSequenced ? -1 : 1;
    return left.index - right.index;
  }).map(({ document }) => document);
}

export function filterDocumentsByDate(documents: DocumentRecord[], from: string, to: string, allTime: boolean) {
  const filtered = allTime ? documents : documents.filter(document => {
    const day = document.businessDate ?? localBusinessDay(document.occurredAt);
    return (!from || day >= from) && (!to || day <= to);
  });
  return sortDocumentsBySequence(filtered);
}

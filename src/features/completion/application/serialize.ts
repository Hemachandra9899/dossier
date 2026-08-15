export function serializeCompletionRecord(record: any) {
  return JSON.parse(JSON.stringify(record, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  ));
}

export const toCompletionRecordDetailDTO = serializeCompletionRecord;
export const toCompletionRecordSummaryDTO = serializeCompletionRecord;
export const toCompletionRunDTO = serializeCompletionRecord;

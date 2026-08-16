export function serializeCompletionRecord(record: any) {
  return JSON.parse(JSON.stringify(record, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  ));
}

export function toCompletionRecordDetailDTO(record: any) {
  const serialized = serializeCompletionRecord(record);
  if (Array.isArray(serialized?.artifacts)) {
    serialized.artifacts = serialized.artifacts.map(
      ({ storageKey: _storageKey, ...artifact }: { storageKey?: string }) =>
        artifact,
    );
  }
  return serialized;
}
export const toCompletionRecordSummaryDTO = serializeCompletionRecord;
export const toCompletionRunDTO = serializeCompletionRecord;

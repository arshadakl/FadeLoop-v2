type OperationalLog = {
  event: "consumer.disabled";
  messageCount: number;
};

// Deliberately accepts operational fields only, never raw provider bodies or tokens.
export function logOperational(record: OperationalLog): void {
  console.info(JSON.stringify(record));
}

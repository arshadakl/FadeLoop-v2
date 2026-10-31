export interface QueryMetric {
  queryId: string;
  rowsRead: number;
  rowsWritten: number;
}

export type QueryObserver = (metric: QueryMetric) => void;

export function measuredQueries(observer?: QueryObserver) {
  return async function query<T>(
    queryId: string,
    statement: D1PreparedStatement,
  ): Promise<T[]> {
    const result = await statement.all<T>();
    observer?.({
      queryId,
      rowsRead: result.meta.rows_read,
      rowsWritten: result.meta.rows_written,
    });
    return result.results;
  };
}

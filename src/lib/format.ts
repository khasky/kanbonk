export function localDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

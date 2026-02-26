function pad(value: number, length = 2) {
  return String(value).padStart(length, "0")
}

export function formatDateTimeForMysql(value: Date) {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(
    value.getUTCDate()
  )} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(
    value.getUTCSeconds()
  )}.${pad(value.getUTCMilliseconds(), 3)}`
}

export function normalizeDateTimeForMysqlInput(value: string | null | undefined) {
  if (value == null) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/.test(trimmed)) {
    return trimmed
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.valueOf())) {
    return null
  }

  return formatDateTimeForMysql(parsed)
}

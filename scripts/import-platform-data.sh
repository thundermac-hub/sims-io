#!/usr/bin/env bash

set -euo pipefail

DEFAULT_SQL_FILE="/Users/hafiz/Downloads/sims-platform (1).sql"
SQL_FILE="${1:-${SQL_FILE:-$DEFAULT_SQL_FILE}}"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "SQL dump file not found: $SQL_FILE" >&2
  echo "Usage: $0 [/absolute/path/to/dump.sql]" >&2
  exit 1
fi

if ! docker compose ps mysql >/dev/null 2>&1; then
  echo "MySQL service is not available. Start services with: docker compose up -d" >&2
  exit 1
fi

tmp_sql="$(mktemp "${TMPDIR:-/tmp}/sims-platform-data.XXXXXX.sql")"
trap 'rm -f "$tmp_sql"' EXIT

# Import data only from a full phpMyAdmin dump (skip CREATE/ALTER/DROP statements).
awk '
BEGIN {
  print "SET FOREIGN_KEY_CHECKS=0;";
  print "SET UNIQUE_CHECKS=0;";
  print "SET AUTOCOMMIT=0;";
}
{
  gsub(/\r$/, "")
}
/^[[:space:]]*INSERT[[:space:]]+INTO[[:space:]]+/ { in_insert=1 }
in_insert {
  if ($0 ~ /^[[:space:]]*INSERT[[:space:]]+INTO[[:space:]]+/) {
    sub(/^[[:space:]]*INSERT[[:space:]]+INTO[[:space:]]+/, "REPLACE INTO ")
  }
  print
}
in_insert && /;[[:space:]]*$/ { in_insert=0 }
END {
  print "COMMIT;";
  print "SET UNIQUE_CHECKS=1;";
  print "SET FOREIGN_KEY_CHECKS=1;";
}
' "$SQL_FILE" > "$tmp_sql"

if ! grep -Eq "^[[:space:]]*REPLACE INTO " "$tmp_sql"; then
  echo "No INSERT statements found in dump file: $SQL_FILE" >&2
  exit 1
fi

echo "Importing data from: $SQL_FILE"
docker compose exec -T mysql mysql -usims -psims-password sims-local < "$tmp_sql"
echo "Data import completed."

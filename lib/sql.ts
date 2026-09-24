import { Column, Table } from './types'
import { DEFAULT_LENGTH, isIntegerType } from './schema'

export type Dialect = 'mysql' | 'postgresql' | 'sqlite'

export const DIALECTS: { value: Dialect; label: string }[] = [
  { value: 'mysql', label: 'MySQL / MariaDB' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'sqlite', label: 'SQLite' },
]

const RESERVED = new Set(
  `add all alter and as asc between by case check column constraint create cross current_date current_time
  current_timestamp database default delete desc distinct drop else end exists foreign from full grant group
  having in index inner insert interval into is join key left like limit match natural not null offset on or
  order outer primary references right row rows select set table then to trigger union unique update user
  using values when where with`.split(/\s+/),
)

export function quoteIdent(name: string, dialect: Dialect) {
  if (/^[a-z_][a-z0-9_]*$/.test(name) && !RESERVED.has(name)) return name
  return dialect === 'mysql' ? `\`${name.replace(/`/g, '``')}\`` : `"${name.replace(/"/g, '""')}"`
}

const quoteString = (value: string) => `'${value.replace(/'/g, "''")}'`

export function enumValues(column: Column) {
  return (column.length || '')
    .split(',')
    .map(v => v.trim().replace(/^'(.*)'$/, '$1'))
    .filter(Boolean)
}

function sized(type: string, column: Column) {
  const length = column.length?.trim() || DEFAULT_LENGTH[type]
  return length ? `${type}(${length})` : type
}

function columnType(column: Column, dialect: Dialect): string {
  const type = column.type.toUpperCase()
  if (dialect === 'mysql') {
    if (type === 'ENUM') {
      const values = enumValues(column)
      return values.length ? `ENUM(${values.map(quoteString).join(', ')})` : 'VARCHAR(50)'
    }
    if (type === 'UUID') return 'CHAR(36)'
    if (type === 'BOOLEAN') return 'TINYINT(1)'
    if (['VARCHAR', 'CHAR', 'DECIMAL'].includes(type)) return sized(type, column)
    return column.length ? `${type}(${column.length})` : type
  }

  if (dialect === 'postgresql') {
    const map: Record<string, string> = {
      INT: 'INTEGER', TINYINT: 'SMALLINT', LONGTEXT: 'TEXT', DATETIME: 'TIMESTAMP',
      FLOAT: 'REAL', DOUBLE: 'DOUBLE PRECISION', JSON: 'JSONB', BLOB: 'BYTEA',
    }
    if (type === 'ENUM') return 'VARCHAR(50)'
    if (['VARCHAR', 'CHAR', 'DECIMAL'].includes(type)) return sized(type, column)
    return map[type] || type
  }

  // SQLite uses type affinity; keep declared sizes out of the way
  if (isIntegerType(type) || type === 'BOOLEAN') return 'INTEGER'
  if (['DECIMAL', 'FLOAT', 'DOUBLE'].includes(type)) return type === 'DECIMAL' ? 'NUMERIC' : 'REAL'
  if (type === 'BLOB') return 'BLOB'
  return 'TEXT'
}

const KEYWORD_DEFAULTS = /^(NULL|TRUE|FALSE|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|LOCALTIMESTAMP|NOW\(\))$/i

function formatDefault(column: Column, dialect: Dialect): string | null {
  const raw = column.defaultValue?.trim()
  if (!raw) return null
  const type = column.type.toUpperCase()

  if (type === 'BOOLEAN') {
    const truthy = /^(1|true|yes)$/i.test(raw)
    const falsy = /^(0|false|no)$/i.test(raw)
    if (truthy || falsy) {
      if (dialect === 'postgresql') return truthy ? 'TRUE' : 'FALSE'
      return truthy ? '1' : '0'
    }
  }
  if (KEYWORD_DEFAULTS.test(raw)) {
    if (dialect === 'sqlite' && /^NOW\(\)$/i.test(raw)) return 'CURRENT_TIMESTAMP'
    return raw.toUpperCase()
  }
  if (/^(gen_random_uuid|uuid_generate_v4|uuid)\(\)$/i.test(raw)) {
    if (dialect === 'mysql') return '(UUID())'
    return dialect === 'postgresql' ? 'gen_random_uuid()' : null
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) return raw
  // Already quoted, a function call, or an expression in parentheses: pass through
  if (/^'.*'$/.test(raw) || /^[A-Za-z_][\w.]*\(.*\)$/.test(raw) || /^\(.*\)$/.test(raw)) {
    return dialect === 'sqlite' && !/^'.*'$/.test(raw) ? `(${raw.replace(/^\((.*)\)$/, '$1')})` : raw
  }
  return quoteString(raw)
}

/** Orders tables so referenced tables come first; tables in a cycle keep their order */
function sortByDependencies(tables: Table[]) {
  const byName = new Map(tables.map(t => [t.name, t]))
  const done = new Set<string>()
  const visiting = new Set<string>()
  const ordered: Table[] = []
  const visit = (t: Table) => {
    if (done.has(t.id) || visiting.has(t.id)) return
    visiting.add(t.id)
    for (const c of t.columns) {
      const target = c.isForeignKey && c.references ? byName.get(c.references.table) : undefined
      if (target && target.id !== t.id) visit(target)
    }
    visiting.delete(t.id)
    done.add(t.id)
    ordered.push(t)
  }
  tables.forEach(visit)
  return ordered
}

interface ForeignKey {
  table: Table
  column: Column
  target: Table
  targetColumn: Column
}

function foreignKeys(table: Table, tables: Table[]) {
  const valid: ForeignKey[] = []
  const broken: string[] = []
  for (const column of table.columns) {
    if (!column.isForeignKey || !column.references) continue
    const target = tables.find(t => t.name === column.references!.table)
    const targetColumn = target?.columns.find(c => c.name === column.references!.column)
    if (target && targetColumn) valid.push({ table, column, target, targetColumn })
    else broken.push(`${column.name} -> ${column.references.table}.${column.references.column}`)
  }
  return { valid, broken }
}

function fkClause(fk: ForeignKey, dialect: Dialect) {
  const q = (n: string) => quoteIdent(n, dialect)
  let sql = `CONSTRAINT ${q(`fk_${fk.table.name}_${fk.column.name}`)} FOREIGN KEY (${q(fk.column.name)}) REFERENCES ${q(fk.target.name)}(${q(fk.targetColumn.name)})`
  if (fk.column.onDelete && fk.column.onDelete !== 'NO ACTION') sql += ` ON DELETE ${fk.column.onDelete}`
  return sql
}

export function generateSQL(tables: Table[], dialect: Dialect, projectName?: string): string {
  if (tables.length === 0) return '-- No tables to export\n'
  const q = (n: string) => quoteIdent(n, dialect)
  const label = DIALECTS.find(d => d.value === dialect)!.label

  const out: string[] = [
    `-- ${projectName ? `${projectName} — ` : ''}schema for ${label}`,
    `-- Generated by MatrixForge (https://tool.khanamir.me/matrix) on ${new Date().toISOString().slice(0, 10)}`,
    '',
  ]
  if (dialect === 'sqlite') out.push('PRAGMA foreign_keys = ON;', '')

  const ordered = sortByDependencies(tables)
  const created = new Set<string>()
  const deferred: ForeignKey[] = []

  for (const table of ordered) {
    const pks = table.columns.filter(c => c.isPrimaryKey)
    const { valid, broken } = foreignKeys(table, tables)
    const lines: string[] = []
    const after: string[] = []

    if (table.comment) out.push(`-- ${table.comment.replace(/\n/g, ' ')}`)
    broken.forEach(b => out.push(`-- Skipped foreign key ${b}: the referenced column does not exist`))

    for (const col of table.columns) {
      let line = `  ${q(col.name)} ${columnType(col, dialect)}`
      const singlePk = col.isPrimaryKey && pks.length === 1
      const autoInc = col.isAutoIncrement && isIntegerType(col.type)

      if (dialect === 'sqlite' && singlePk && autoInc) {
        line += ' PRIMARY KEY AUTOINCREMENT'
      } else {
        if (autoInc && dialect === 'postgresql') line += ' GENERATED BY DEFAULT AS IDENTITY'
        if (singlePk) line += ' PRIMARY KEY'
        if (autoInc && dialect === 'mysql') line += ' AUTO_INCREMENT'
      }
      if (!col.isNullable && !col.isPrimaryKey) line += ' NOT NULL'
      if (col.isUnique && !col.isPrimaryKey) line += ' UNIQUE'

      const def = autoInc ? null : formatDefault(col, dialect)
      if (def) line += ` DEFAULT ${def}`

      if (col.type.toUpperCase() === 'ENUM' && dialect !== 'mysql') {
        const values = enumValues(col)
        if (values.length) line += ` CHECK (${q(col.name)} IN (${values.map(quoteString).join(', ')}))`
      }
      if (col.comment) {
        if (dialect === 'mysql') line += ` COMMENT ${quoteString(col.comment)}`
        if (dialect === 'postgresql') after.push(`COMMENT ON COLUMN ${q(table.name)}.${q(col.name)} IS ${quoteString(col.comment)};`)
      }
      lines.push(line)
    }

    if (pks.length > 1) lines.push(`  PRIMARY KEY (${pks.map(c => q(c.name)).join(', ')})`)

    for (const fk of valid) {
      // Referencing a table that is created later (a cycle) needs ALTER TABLE, which SQLite lacks
      const forward = fk.target.id !== table.id && !created.has(fk.target.id)
      if (forward && dialect !== 'sqlite') deferred.push(fk)
      else lines.push(`  ${fkClause(fk, dialect)}`)
    }

    const sqliteComments = dialect === 'sqlite' ? table.columns : []
    out.push(`CREATE TABLE ${q(table.name)} (`)
    out.push(
      lines
        .map((l, i) => {
          const comma = i < lines.length - 1 ? ',' : ''
          const col = sqliteComments[i]
          return col?.comment ? `${l}${comma} -- ${col.comment.replace(/\n/g, ' ')}` : l + comma
        })
        .join('\n'),
    )
    out.push(dialect === 'mysql' && table.comment ? `) COMMENT = ${quoteString(table.comment)};` : ');')

    if (dialect === 'postgresql' && table.comment) out.push(`COMMENT ON TABLE ${q(table.name)} IS ${quoteString(table.comment)};`)
    out.push(...after)

    for (const col of table.columns) {
      if (col.isIndexed && !col.isPrimaryKey && !col.isUnique) {
        out.push(`CREATE INDEX ${q(`idx_${table.name}_${col.name}`)} ON ${q(table.name)} (${q(col.name)});`)
      }
    }
    out.push('')
    created.add(table.id)
  }

  if (deferred.length) {
    out.push('-- Foreign keys between tables that reference each other')
    for (const fk of deferred) out.push(`ALTER TABLE ${q(fk.table.name)} ADD ${fkClause(fk, dialect)};`)
    out.push('')
  }

  return out.join('\n')
}

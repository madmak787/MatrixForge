import { Column, ReferentialAction, Table } from './types'
import { DATA_TYPES, REFERENTIAL_ACTIONS, autoLayout, normalizeTables, uid } from './schema'
import { TABLE_COLORS } from './colors'

export interface ImportResult {
  tables: Table[]
  warnings: string[]
}

/** Removes comments while leaving quoted strings and identifiers alone */
function stripComments(sql: string) {
  let out = ''
  let i = 0
  while (i < sql.length) {
    const ch = sql[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === ch && sql[j + 1] === ch) j += 2
        else if (sql[j] === '\\' && ch === "'") j += 2
        else if (sql[j] === ch) break
        else j++
      }
      out += sql.slice(i, j + 1)
      i = j + 1
    } else if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++
    } else if (ch === '#' ) {
      while (i < sql.length && sql[i] !== '\n') i++
    } else if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      i = end === -1 ? sql.length : end + 2
    } else {
      out += ch
      i++
    }
  }
  return out
}

/** Splits on a separator only at paren depth 0 and outside quotes */
function splitTopLevel(text: string, sep: string) {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === quote && text[i + 1] === quote) i++
      else if (ch === '\\' && quote === "'") i++
      else if (ch === quote) quote = null
    } else if (ch === "'" || ch === '"' || ch === '`' || ch === '[') {
      quote = ch === '[' ? ']' : ch
    } else if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === sep && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts.map(p => p.trim()).filter(Boolean)
}

function unquote(name: string) {
  const n = name.trim()
  if (/^[`"[]/.test(n)) return n.slice(1, -1).replace(/""/g, '"').replace(/``/g, '`')
  return n
}

/** "public"."users" -> users */
function tableName(raw: string) {
  const parts = raw.match(/(`[^`]+`|"[^"]+"|\[[^\]]+\]|[^.\s]+)/g) || [raw]
  return unquote(parts[parts.length - 1])
}

const IDENT = String.raw`(?:\`[^\`]+\`|"[^"]+"|\[[^\]]+\]|[\w$]+)`
const QUALIFIED = String.raw`${IDENT}(?:\s*\.\s*${IDENT})?`

function identList(text: string) {
  return splitTopLevel(text, ',').map(p => unquote(p.replace(/\(\d+\)$/, '').replace(/\s+(ASC|DESC)$/i, '')))
}

const TYPE_ALIASES: Record<string, string> = {
  INTEGER: 'INT', INT4: 'INT', MEDIUMINT: 'INT', INT8: 'BIGINT', INT2: 'SMALLINT',
  SERIAL: 'INT', SERIAL4: 'INT', BIGSERIAL: 'BIGINT', SERIAL8: 'BIGINT', SMALLSERIAL: 'SMALLINT',
  'CHARACTER VARYING': 'VARCHAR', VARCHAR2: 'VARCHAR', NVARCHAR: 'VARCHAR', CHARACTER: 'CHAR', NCHAR: 'CHAR',
  MEDIUMTEXT: 'LONGTEXT', TINYTEXT: 'TEXT', CLOB: 'LONGTEXT', CITEXT: 'TEXT',
  BOOL: 'BOOLEAN', BIT: 'BOOLEAN',
  TIMESTAMPTZ: 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE': 'TIMESTAMP', 'TIMESTAMP WITHOUT TIME ZONE': 'TIMESTAMP',
  TIMETZ: 'TIME', DATETIME2: 'DATETIME',
  NUMERIC: 'DECIMAL', NUMBER: 'DECIMAL', MONEY: 'DECIMAL', REAL: 'FLOAT', FLOAT4: 'FLOAT', FLOAT8: 'DOUBLE',
  'DOUBLE PRECISION': 'DOUBLE',
  JSONB: 'JSON', BYTEA: 'BLOB', LONGBLOB: 'BLOB', MEDIUMBLOB: 'BLOB', VARBINARY: 'BLOB', BINARY: 'BLOB',
  UNIQUEIDENTIFIER: 'UUID',
}

const CONSTRAINT_WORDS =
  /\s+(?=(?:CONSTRAINT|PRIMARY|NOT|NULL|UNIQUE|DEFAULT|AUTO_INCREMENT|AUTOINCREMENT|IDENTITY|GENERATED|REFERENCES|CHECK|COMMENT|COLLATE|CHARACTER\s+SET|ON\s+UPDATE|UNSIGNED|SIGNED|ZEROFILL|KEY)\b)/i

function parseType(def: string) {
  // Everything up to the first constraint keyword is the type, e.g. "character varying(255)"
  const typePart = def.split(CONSTRAINT_WORDS)[0].trim()
  const m = typePart.match(/^([A-Za-z][\w ]*?)\s*(?:\((.*)\))?(\s*\[\])?\s*(?:UNSIGNED|SIGNED)?$/i)
  // Fall back to the first word for shapes like "timestamp(6) with time zone"
  const base = (m?.[1] || typePart.match(/^[A-Za-z]\w*/)?.[0] || typePart).trim().toUpperCase().replace(/\s+/g, ' ')
  const args = m?.[2]?.trim()
  const isArray = !!m?.[3]
  const serial = /SERIAL/.test(base)
  let type = TYPE_ALIASES[base] || base
  let length: string | undefined

  if (type === 'ENUM' || type === 'SET') {
    type = 'ENUM'
    length = args ? splitTopLevel(args, ',').map(v => v.replace(/^'(.*)'$/s, '$1').replace(/''/g, "'")).join(',') : undefined
  } else if (args && ['VARCHAR', 'CHAR', 'DECIMAL'].includes(type)) {
    length = args.replace(/\s+/g, '')
  } else if (base === 'TINYINT' && args === '1') {
    type = 'BOOLEAN'
  }
  if (isArray) type = 'JSON'
  if (!DATA_TYPES.includes(type) && !/^[A-Z][A-Z0-9_ ]*$/.test(type)) type = 'VARCHAR'
  return { type, length, serial, rest: def.slice(typePart.length) }
}

function parseDefault(rest: string): string | undefined {
  const m = rest.match(/\bDEFAULT\s+('(?:[^']|'')*'|\((?:[^()]|\([^()]*\))*\)|[\w.]+(?:\([^)]*\))?)/i)
  if (!m) return undefined
  let v = m[1]
  if (/^'.*'$/s.test(v)) v = v.slice(1, -1).replace(/''/g, "'")
  v = v.replace(/::[\w ]+$/, '') // Postgres casts like 'x'::character varying
  return v.toUpperCase() === 'NULL' ? undefined : v
}

function parseReferences(text: string) {
  const m = text.match(new RegExp(String.raw`REFERENCES\s+(${QUALIFIED})\s*(?:\(\s*(${IDENT})\s*\))?(?:[^]*?ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION|SET\s+DEFAULT))?`, 'i'))
  if (!m) return null
  const action = m[3]?.toUpperCase().replace(/\s+/g, ' ') as ReferentialAction | undefined
  return {
    table: tableName(m[1]),
    column: m[2] ? unquote(m[2]) : 'id',
    onDelete: action && REFERENTIAL_ACTIONS.includes(action) && action !== 'NO ACTION' ? action : undefined,
  }
}

export function parseSQL(input: string): ImportResult {
  const warnings: string[] = []
  const sql = stripComments(input)
  const tables: Table[] = []
  const find = (name: string) => tables.find(t => t.name.toLowerCase() === name.toLowerCase())

  const createRe = new RegExp(
    String.raw`CREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:GLOBAL\s+|LOCAL\s+)?(?:TEMP|TEMPORARY)\s+|UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(${QUALIFIED})\s*\(`,
    'gi',
  )
  let match: RegExpExecArray | null
  while ((match = createRe.exec(sql))) {
    // Find the parenthesis that closes the column list
    let depth = 1
    let i = createRe.lastIndex
    let quote: string | null = null
    for (; i < sql.length && depth > 0; i++) {
      const ch = sql[i]
      if (quote) {
        if (ch === quote) quote = null
      } else if (ch === "'" || ch === '"' || ch === '`') quote = ch
      else if (ch === '(') depth++
      else if (ch === ')') depth--
    }
    const body = sql.slice(createRe.lastIndex, i - 1)
    createRe.lastIndex = i
    const name = tableName(match[1])
    const tail = sql.slice(i, sql.indexOf(';', i) === -1 ? undefined : sql.indexOf(';', i))
    const tableComment = tail.match(/COMMENT\s*=?\s*'((?:[^']|'')*)'/i)?.[1]?.replace(/''/g, "'")

    const columns: Column[] = []
    const tablePks: string[] = []
    const fks: { cols: string[]; ref: NonNullable<ReturnType<typeof parseReferences>> }[] = []
    const uniques: string[][] = []
    const indexes: string[][] = []

    for (const item of splitTopLevel(body, ',')) {
      const upper = item.toUpperCase()
      const withoutName = item.replace(new RegExp(String.raw`^CONSTRAINT\s+${IDENT}\s+`, 'i'), '')
      const colsIn = (s: string) => {
        const m = s.match(/\(([^)]*)\)/)
        return m ? identList(m[1]) : []
      }
      if (/^PRIMARY\s+KEY/i.test(withoutName)) {
        tablePks.push(...colsIn(withoutName))
      } else if (/^FOREIGN\s+KEY/i.test(withoutName)) {
        const ref = parseReferences(withoutName)
        if (ref) fks.push({ cols: colsIn(withoutName), ref })
      } else if (/^UNIQUE\b/i.test(withoutName)) {
        uniques.push(colsIn(withoutName))
      } else if (/^(KEY|INDEX|FULLTEXT|SPATIAL)\b/i.test(withoutName)) {
        indexes.push(colsIn(withoutName))
      } else if (/^(CHECK|EXCLUDE|PERIOD|CONSTRAINT)\b/i.test(upper)) {
        // Not modelled
      } else {
        const nameMatch = item.match(new RegExp(String.raw`^(${IDENT})\s+([^]*)$`))
        if (!nameMatch) continue
        const { type, length, serial, rest } = parseType(nameMatch[2])
        const ref = parseReferences(rest)
        const comment = rest.match(/\bCOMMENT\s+'((?:[^']|'')*)'/i)?.[1]?.replace(/''/g, "'")
        const isPk = /\bPRIMARY\s+KEY\b/i.test(rest)
        columns.push({
          id: uid('col'),
          name: unquote(nameMatch[1]),
          type,
          length,
          isPrimaryKey: isPk,
          isNullable: !isPk && !/\bNOT\s+NULL\b/i.test(rest),
          isAutoIncrement: serial || /\b(AUTO_INCREMENT|AUTOINCREMENT|IDENTITY|GENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY)\b/i.test(rest) || undefined,
          defaultValue: /nextval\(/i.test(rest) ? undefined : parseDefault(rest),
          comment,
          isUnique: (/\bUNIQUE\b/i.test(rest) && !isPk) || undefined,
          isForeignKey: ref ? true : undefined,
          references: ref ? { table: ref.table, column: ref.column } : undefined,
          onDelete: ref?.onDelete,
        })
        if (/nextval\(/i.test(rest)) columns[columns.length - 1].isAutoIncrement = true
      }
    }

    const col = (n: string) => columns.find(c => c.name.toLowerCase() === n.toLowerCase())
    for (const pk of tablePks) {
      const c = col(pk)
      if (c) Object.assign(c, { isPrimaryKey: true, isNullable: false })
    }
    for (const fk of fks) {
      if (fk.cols.length !== 1) {
        warnings.push(`${name}: composite foreign key (${fk.cols.join(', ')}) was skipped`)
        continue
      }
      const c = col(fk.cols[0])
      if (c) Object.assign(c, { isForeignKey: true, references: { table: fk.ref.table, column: fk.ref.column }, onDelete: fk.ref.onDelete })
    }
    for (const u of uniques) {
      if (u.length === 1 && col(u[0])) col(u[0])!.isUnique = true
      else u.forEach(n => col(n) && (col(n)!.isIndexed = true))
    }
    for (const idx of indexes) {
      const c = idx[0] && col(idx[0])
      if (c) c.isIndexed = true
    }

    if (find(name)) warnings.push(`Table ${name} is defined twice; the last definition wins`)
    const existing = find(name)
    const table: Table = {
      id: uid('table'),
      name,
      columns,
      position: { x: 0, y: 0 },
      comment: tableComment,
      color: TABLE_COLORS[tables.length % TABLE_COLORS.length].name,
    }
    if (existing) tables.splice(tables.indexOf(existing), 1, table)
    else tables.push(table)
  }

  // ALTER TABLE x ADD [CONSTRAINT n] FOREIGN KEY (a) REFERENCES t(b)
  const alterRe = new RegExp(String.raw`ALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?(${QUALIFIED})\s+([^;]*)`, 'gi')
  while ((match = alterRe.exec(sql))) {
    const table = find(tableName(match[1]))
    if (!table) continue
    for (const clause of splitTopLevel(match[2], ',')) {
      const fk = clause.match(/FOREIGN\s+KEY\s*\(([^)]*)\)/i)
      const ref = fk && parseReferences(clause)
      if (fk && ref) {
        const cols = identList(fk[1])
        const c = cols.length === 1 && table.columns.find(x => x.name.toLowerCase() === cols[0].toLowerCase())
        if (c) Object.assign(c, { isForeignKey: true, references: { table: ref.table, column: ref.column }, onDelete: ref.onDelete })
      }
      const pk = clause.match(/PRIMARY\s+KEY\s*\(([^)]*)\)/i)
      if (pk) {
        for (const n of identList(pk[1])) {
          const c = table.columns.find(x => x.name.toLowerCase() === n.toLowerCase())
          if (c) Object.assign(c, { isPrimaryKey: true, isNullable: false })
        }
      }
    }
  }

  // CREATE [UNIQUE] INDEX name ON table (col)
  const indexRe = new RegExp(String.raw`CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(?:${QUALIFIED}\s+)?ON\s+(?:ONLY\s+)?(${QUALIFIED})\s*(?:USING\s+\w+\s*)?\(([^)]*)\)`, 'gi')
  while ((match = indexRe.exec(sql))) {
    const table = find(tableName(match[2]))
    const cols = identList(match[3])
    const c = table?.columns.find(x => x.name.toLowerCase() === cols[0]?.toLowerCase())
    if (!c) continue
    if (match[1] && cols.length === 1) c.isUnique = true
    else c.isIndexed = true
  }

  // Point FKs at the referenced table's primary key when REFERENCES t had no column
  for (const t of tables) {
    for (const c of t.columns) {
      if (!c.references) continue
      const target = find(c.references.table)
      if (!target) {
        warnings.push(`${t.name}.${c.name} references ${c.references.table}, which is not in the script`)
        continue
      }
      c.references.table = target.name
      const exact = target.columns.find(x => x.name.toLowerCase() === c.references!.column.toLowerCase())
      c.references.column = exact?.name || target.columns.find(x => x.isPrimaryKey)?.name || c.references.column
    }
  }

  if (tables.length === 0) warnings.push('No CREATE TABLE statements were found')
  return { tables: autoLayout(normalizeTables(tables)), warnings }
}

/** Accepts a MatrixForge JSON export (or a bare array of tables) */
export function parseJSON(text: string): ImportResult {
  const data = JSON.parse(text)
  const raw = Array.isArray(data) ? data : data?.tables
  if (!Array.isArray(raw)) throw new Error('This JSON file has no "tables" list')
  const tables = normalizeTables(raw)
  const hasPositions = raw.every((t: any) => Number.isFinite(t?.position?.x) && Number.isFinite(t?.position?.y))
  return { tables: hasPositions ? tables : autoLayout(tables), warnings: [] }
}

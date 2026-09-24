export type ReferentialAction = 'NO ACTION' | 'CASCADE' | 'SET NULL' | 'RESTRICT'

export interface Column {
  id: string
  name: string
  type: string
  /** Length/precision for sized types ("255", "10,2") or the value list for ENUM ("draft,published") */
  length?: string
  isPrimaryKey: boolean
  isNullable: boolean
  isAutoIncrement?: boolean
  defaultValue?: string
  comment?: string
  isForeignKey?: boolean
  // Foreign keys point at tables and columns by name, so renames cascade (see lib/schema.ts)
  references?: {
    table: string
    column: string
  }
  onDelete?: ReferentialAction
  isIndexed?: boolean
  isUnique?: boolean
}

export interface Table {
  id: string
  name: string
  columns: Column[]
  position: { x: number; y: number }
  comment?: string
  color?: string
}

/** Kept for projects saved by earlier versions; relationships now come from column foreign keys */
export interface Relationship {
  id: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
}

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: number
  updatedAt: number
  tables: Table[]
  relationships: Relationship[]
}

import { Column, Table } from './types'
import { autoLayout, normalizeTables } from './schema'

type TemplateColumn = Partial<Column> & { name: string; type: string }

export interface Template {
  id: string
  name: string
  description: string
  tables: { name: string; comment?: string; columns: TemplateColumn[] }[]
}

const id: TemplateColumn = { name: 'id', type: 'INT', isPrimaryKey: true, isAutoIncrement: true }
const createdAt: TemplateColumn = { name: 'created_at', type: 'TIMESTAMP', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
const updatedAt: TemplateColumn = { name: 'updated_at', type: 'TIMESTAMP', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
const fk = (name: string, table: string, extra: Partial<Column> = {}): TemplateColumn => ({
  name,
  type: 'INT',
  isNullable: false,
  isForeignKey: true,
  isIndexed: true,
  references: { table, column: 'id' },
  ...extra,
})

export const TEMPLATES: Template[] = [
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    description: 'Customers, catalog, orders and reviews',
    tables: [
      {
        name: 'users',
        columns: [
          id,
          { name: 'email', type: 'VARCHAR', isUnique: true, isNullable: false, comment: 'Login email' },
          { name: 'password_hash', type: 'VARCHAR', isNullable: false },
          { name: 'first_name', type: 'VARCHAR', length: '100' },
          { name: 'last_name', type: 'VARCHAR', length: '100' },
          createdAt,
          updatedAt,
        ],
      },
      {
        name: 'categories',
        columns: [
          id,
          { name: 'name', type: 'VARCHAR', length: '100', isNullable: false },
          { name: 'slug', type: 'VARCHAR', length: '120', isUnique: true, isNullable: false },
          fk('parent_id', 'categories', { isNullable: true, onDelete: 'SET NULL' }),
        ],
      },
      {
        name: 'products',
        columns: [
          id,
          fk('category_id', 'categories', { onDelete: 'RESTRICT' }),
          { name: 'name', type: 'VARCHAR', isNullable: false },
          { name: 'sku', type: 'VARCHAR', length: '64', isUnique: true, isNullable: false },
          { name: 'description', type: 'TEXT' },
          { name: 'price', type: 'DECIMAL', length: '10,2', isNullable: false },
          { name: 'stock_quantity', type: 'INT', isNullable: false, defaultValue: '0' },
          createdAt,
          updatedAt,
        ],
      },
      {
        name: 'orders',
        columns: [
          id,
          fk('user_id', 'users'),
          { name: 'status', type: 'ENUM', length: 'pending,paid,shipped,delivered,cancelled', isNullable: false, defaultValue: 'pending' },
          { name: 'total_amount', type: 'DECIMAL', length: '10,2', isNullable: false },
          createdAt,
        ],
      },
      {
        name: 'order_items',
        columns: [
          id,
          fk('order_id', 'orders', { onDelete: 'CASCADE' }),
          fk('product_id', 'products'),
          { name: 'quantity', type: 'INT', isNullable: false, defaultValue: '1' },
          { name: 'unit_price', type: 'DECIMAL', length: '10,2', isNullable: false },
        ],
      },
      {
        name: 'reviews',
        columns: [
          id,
          fk('product_id', 'products', { onDelete: 'CASCADE' }),
          fk('user_id', 'users', { onDelete: 'CASCADE' }),
          { name: 'rating', type: 'TINYINT', isNullable: false, comment: '1 to 5 stars' },
          { name: 'body', type: 'TEXT' },
          createdAt,
        ],
      },
    ],
  },
  {
    id: 'blog',
    name: 'Blog',
    description: 'Authors, posts, comments and tags',
    tables: [
      {
        name: 'users',
        columns: [
          id,
          { name: 'username', type: 'VARCHAR', length: '50', isUnique: true, isNullable: false },
          { name: 'email', type: 'VARCHAR', isUnique: true, isNullable: false },
          { name: 'password_hash', type: 'VARCHAR', isNullable: false },
          { name: 'role', type: 'ENUM', length: 'admin,editor,author', isNullable: false, defaultValue: 'author' },
          createdAt,
        ],
      },
      {
        name: 'categories',
        columns: [
          id,
          { name: 'name', type: 'VARCHAR', length: '100', isUnique: true, isNullable: false },
          { name: 'slug', type: 'VARCHAR', length: '120', isUnique: true, isNullable: false },
        ],
      },
      {
        name: 'posts',
        columns: [
          id,
          fk('author_id', 'users'),
          fk('category_id', 'categories', { isNullable: true, onDelete: 'SET NULL' }),
          { name: 'title', type: 'VARCHAR', isNullable: false },
          { name: 'slug', type: 'VARCHAR', isUnique: true, isNullable: false },
          { name: 'content', type: 'LONGTEXT' },
          { name: 'status', type: 'ENUM', length: 'draft,published,archived', isNullable: false, defaultValue: 'draft' },
          { name: 'published_at', type: 'TIMESTAMP' },
          createdAt,
          updatedAt,
        ],
      },
      {
        name: 'comments',
        columns: [
          id,
          fk('post_id', 'posts', { onDelete: 'CASCADE' }),
          fk('user_id', 'users', { isNullable: true, onDelete: 'SET NULL' }),
          { name: 'body', type: 'TEXT', isNullable: false },
          { name: 'approved', type: 'BOOLEAN', isNullable: false, defaultValue: 'false' },
          createdAt,
        ],
      },
      {
        name: 'tags',
        columns: [
          id,
          { name: 'name', type: 'VARCHAR', length: '50', isUnique: true, isNullable: false },
        ],
      },
      {
        name: 'post_tags',
        comment: 'Many-to-many join between posts and tags',
        columns: [
          fk('post_id', 'posts', { isPrimaryKey: true, isIndexed: false, onDelete: 'CASCADE' }),
          fk('tag_id', 'tags', { isPrimaryKey: true, onDelete: 'CASCADE' }),
        ],
      },
    ],
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Companies, contacts, deals and activities',
    tables: [
      {
        name: 'users',
        columns: [
          id,
          { name: 'email', type: 'VARCHAR', isUnique: true, isNullable: false },
          { name: 'full_name', type: 'VARCHAR', length: '150', isNullable: false },
          { name: 'role', type: 'ENUM', length: 'admin,manager,rep', isNullable: false, defaultValue: 'rep' },
          createdAt,
        ],
      },
      {
        name: 'companies',
        columns: [
          id,
          { name: 'name', type: 'VARCHAR', isNullable: false },
          { name: 'industry', type: 'VARCHAR', length: '100' },
          { name: 'website', type: 'VARCHAR' },
          { name: 'phone', type: 'VARCHAR', length: '30' },
          createdAt,
        ],
      },
      {
        name: 'contacts',
        columns: [
          id,
          fk('company_id', 'companies', { isNullable: true, onDelete: 'SET NULL' }),
          { name: 'first_name', type: 'VARCHAR', length: '100', isNullable: false },
          { name: 'last_name', type: 'VARCHAR', length: '100' },
          { name: 'email', type: 'VARCHAR' },
          { name: 'phone', type: 'VARCHAR', length: '30' },
          { name: 'job_title', type: 'VARCHAR', length: '100' },
          createdAt,
        ],
      },
      {
        name: 'deals',
        columns: [
          id,
          fk('company_id', 'companies', { onDelete: 'CASCADE' }),
          fk('contact_id', 'contacts', { isNullable: true, onDelete: 'SET NULL' }),
          fk('owner_id', 'users'),
          { name: 'title', type: 'VARCHAR', isNullable: false },
          { name: 'amount', type: 'DECIMAL', length: '12,2' },
          { name: 'stage', type: 'ENUM', length: 'lead,qualified,proposal,won,lost', isNullable: false, defaultValue: 'lead' },
          { name: 'probability', type: 'TINYINT', comment: '0 to 100' },
          createdAt,
          updatedAt,
        ],
      },
      {
        name: 'activities',
        columns: [
          id,
          fk('deal_id', 'deals', { isNullable: true, onDelete: 'CASCADE' }),
          fk('contact_id', 'contacts', { isNullable: true, onDelete: 'CASCADE' }),
          fk('user_id', 'users'),
          { name: 'kind', type: 'ENUM', length: 'call,email,meeting,task', isNullable: false },
          { name: 'subject', type: 'VARCHAR', isNullable: false },
          { name: 'notes', type: 'TEXT' },
          { name: 'due_at', type: 'TIMESTAMP' },
          createdAt,
        ],
      },
    ],
  },
  {
    id: 'saas',
    name: 'SaaS',
    description: 'Multi-tenant accounts, members and billing',
    tables: [
      {
        name: 'organizations',
        columns: [
          { name: 'id', type: 'UUID', isPrimaryKey: true, defaultValue: 'gen_random_uuid()' },
          { name: 'name', type: 'VARCHAR', isNullable: false },
          { name: 'slug', type: 'VARCHAR', length: '60', isUnique: true, isNullable: false },
          createdAt,
        ],
      },
      {
        name: 'users',
        columns: [
          { name: 'id', type: 'UUID', isPrimaryKey: true, defaultValue: 'gen_random_uuid()' },
          { name: 'email', type: 'VARCHAR', isUnique: true, isNullable: false },
          { name: 'name', type: 'VARCHAR', length: '150' },
          { name: 'email_verified', type: 'BOOLEAN', isNullable: false, defaultValue: 'false' },
          createdAt,
        ],
      },
      {
        name: 'memberships',
        comment: 'Which users belong to which organization',
        columns: [
          fk('organization_id', 'organizations', { type: 'UUID', isPrimaryKey: true, isIndexed: false, onDelete: 'CASCADE' }),
          fk('user_id', 'users', { type: 'UUID', isPrimaryKey: true, onDelete: 'CASCADE' }),
          { name: 'role', type: 'ENUM', length: 'owner,admin,member', isNullable: false, defaultValue: 'member' },
          createdAt,
        ],
      },
      {
        name: 'plans',
        columns: [
          id,
          { name: 'name', type: 'VARCHAR', length: '50', isNullable: false },
          { name: 'price_cents', type: 'INT', isNullable: false },
          { name: 'interval', type: 'ENUM', length: 'month,year', isNullable: false },
          { name: 'features', type: 'JSON' },
        ],
      },
      {
        name: 'subscriptions',
        columns: [
          id,
          fk('organization_id', 'organizations', { type: 'UUID', isUnique: true, isIndexed: false, onDelete: 'CASCADE' }),
          fk('plan_id', 'plans'),
          { name: 'status', type: 'ENUM', length: 'trialing,active,past_due,canceled', isNullable: false },
          { name: 'current_period_end', type: 'TIMESTAMP', isNullable: false },
          createdAt,
        ],
      },
      {
        name: 'api_keys',
        columns: [
          id,
          fk('organization_id', 'organizations', { type: 'UUID', onDelete: 'CASCADE' }),
          { name: 'label', type: 'VARCHAR', length: '100' },
          { name: 'key_hash', type: 'CHAR', length: '64', isUnique: true, isNullable: false },
          { name: 'last_used_at', type: 'TIMESTAMP' },
          createdAt,
        ],
      },
    ],
  },
]

export function buildTemplate(template: Template): Table[] {
  return autoLayout(normalizeTables(template.tables.map((t, i) => ({ ...t, position: undefined, color: undefined }))))
}

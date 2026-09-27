import {sql} from 'drizzle-orm';
import {sqliteTable,text,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const records=sqliteTable('records',{id:text('id').primaryKey(),owner:text('owner').notNull(),kind:text('kind').notNull(),data:text('data').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()},t=>[index('records_owner_kind').on(t.owner,t.kind),uniqueIndex('one_active_audit_per_owner').on(t.owner).where(sql`kind = 'audit' AND json_extract(data, '$.status') IN ('queued','running')`)]);
export const shares=sqliteTable('shares',{tokenHash:text('token_hash').primaryKey(),owner:text('owner').notNull(),reportId:text('report_id').notNull(),expiresAt:text('expires_at').notNull()},t=>[index('shares_report').on(t.owner,t.reportId)]);

-- Rollback Migration: Remove LightRAG support fields
-- Date: 2026-01-26
-- Description: Rollback script to remove LightRAG fields if needed

-- ============================================================
-- 1. Remove KnowledgeDocument extensions
-- ============================================================

-- Drop indexes
DROP INDEX IF EXISTS idx_knowledge_documents_lightrag_sync_job;
DROP INDEX IF EXISTS idx_knowledge_documents_lightrag_synced;

-- Drop foreign key constraint
ALTER TABLE knowledge_documents DROP CONSTRAINT IF EXISTS fk_lightrag_sync_job;

-- Drop columns
ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS lightrag_sync_job_id;
ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS lightrag_workspace;
ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS lightrag_synced;

-- ============================================================
-- 2. Remove Knowledge extensions
-- ============================================================

-- Drop index
DROP INDEX IF EXISTS idx_knowledges_kb_type;

-- Drop columns
ALTER TABLE knowledges DROP COLUMN IF EXISTS lightrag_config;
ALTER TABLE knowledges DROP COLUMN IF EXISTS lightrag_workspace;

-- Drop constraint
ALTER TABLE knowledges DROP CONSTRAINT IF EXISTS check_kb_type;

-- Drop column
ALTER TABLE knowledges DROP COLUMN IF EXISTS kb_type;

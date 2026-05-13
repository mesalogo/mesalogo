-- Migration: Add LightRAG support fields to Knowledge and KnowledgeDocument tables
-- Date: 2026-01-26
-- Description: Extend Knowledge and KnowledgeDocument models to support LightRAG integration
-- Database: SQLite

-- ============================================================
-- 1. Extend Knowledge table
-- ============================================================

-- Add kb_type field (knowledge base type: 'vector' or 'lightrag')
ALTER TABLE knowledges ADD COLUMN kb_type VARCHAR(20) DEFAULT 'vector';

-- Add lightrag_workspace field (LightRAG workspace identifier)
ALTER TABLE knowledges ADD COLUMN lightrag_workspace VARCHAR(100);

-- Add lightrag_config field (LightRAG specific configuration as JSON)
ALTER TABLE knowledges ADD COLUMN lightrag_config TEXT;

-- Add index for kb_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_knowledges_kb_type ON knowledges(kb_type);

-- ============================================================
-- 2. Extend KnowledgeDocument table
-- ============================================================

-- Add lightrag_synced field (whether document is synced to LightRAG)
ALTER TABLE knowledge_documents ADD COLUMN lightrag_synced INTEGER DEFAULT 0;

-- Add lightrag_workspace field (LightRAG workspace this document belongs to)
ALTER TABLE knowledge_documents ADD COLUMN lightrag_workspace VARCHAR(100);

-- Add lightrag_sync_job_id field (associated Job ID for sync task)
ALTER TABLE knowledge_documents ADD COLUMN lightrag_sync_job_id VARCHAR(36);

-- Add index for lightrag_synced for faster filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_lightrag_synced ON knowledge_documents(lightrag_synced);

-- Add index for lightrag_sync_job_id for faster job lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_lightrag_sync_job ON knowledge_documents(lightrag_sync_job_id);

-- ============================================================
-- Notes:
-- ============================================================
-- SQLite limitations:
-- 1. No CHECK constraints in ALTER TABLE (will be enforced in application layer)
-- 2. No COMMENT ON COLUMN (documentation in code comments)
-- 3. BOOLEAN stored as INTEGER (0=false, 1=true)
-- 4. JSON stored as TEXT
-- 5. Foreign key constraints not added via ALTER TABLE (will be enforced in application layer)

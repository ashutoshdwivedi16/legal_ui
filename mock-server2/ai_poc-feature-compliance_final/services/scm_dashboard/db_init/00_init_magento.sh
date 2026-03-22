#!/bin/bash
set -e

# 1. Create scm_magento database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE scm_magento OWNER $POSTGRES_USER;
EOSQL

# 2. Create magento tables in scm_magento
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "scm_magento" <<-EOSQL

    CREATE TABLE IF NOT EXISTS lg_vw_scm_order_item_fulfillment (
        po_order_id            BIGINT,
        customer_po_no         BIGINT,
        po_created_at          TIMESTAMP,
        qty_ordered            INT DEFAULT 0,
        qty_canceled           INT DEFAULT 0,
        qty_invoiced           INT DEFAULT 0,
        qty_shipped            INT DEFAULT 0,
        qty_returned           INT DEFAULT 0,
        qty_refunded           INT DEFAULT 0,
        po_item_id             BIGINT NOT NULL,
        erp_order_line_id      VARCHAR(30),
        tms_move_order_line_id VARCHAR(30),
        mdsku                  VARCHAR(50),
        is_lmd                 SMALLINT DEFAULT 0,
        rescheduled_date_from  DATE,
        latest_rad             DATE,
        rescheduled_at         TIMESTAMP,
        warehouse_code         VARCHAR(20),
        carrier_info           VARCHAR(200),
        erp_sku                VARCHAR(50),
        export_status          SMALLINT DEFAULT 0,
        erp_exported_at        TIMESTAMP,
        export_status_code     VARCHAR(10),
        export_status_text     TEXT,
        PRIMARY KEY (po_item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_fulfillment_erp_line ON lg_vw_scm_order_item_fulfillment (erp_order_line_id);
    CREATE INDEX IF NOT EXISTS idx_fulfillment_po_order ON lg_vw_scm_order_item_fulfillment (po_order_id);

    CREATE TABLE IF NOT EXISTS sales_order_status_history (
        entity_id              BIGINT NOT NULL,
        parent_id              BIGINT,
        is_customer_notified   SMALLINT,
        is_visible_on_front    SMALLINT DEFAULT 0,
        comment                TEXT,
        status                 VARCHAR(50),
        created_at             TIMESTAMP,
        entity_name            VARCHAR(50),
        PRIMARY KEY (entity_id)
    );

    CREATE INDEX IF NOT EXISTS idx_history_parent ON sales_order_status_history (parent_id);

    CREATE TABLE IF NOT EXISTS lg_sales_order_eta_update_history (
        history_id             BIGINT NOT NULL,
        order_increment_id     BIGINT,
        erp_order_number       VARCHAR(30),
        source                 VARCHAR(50),
        send_email             CHAR(1),
        eta_date_from          DATE,
        eta_date_to            DATE,
        created_at             TIMESTAMP,
        updated_at             TIMESTAMP,
        PRIMARY KEY (history_id)
    );

    CREATE INDEX IF NOT EXISTS idx_eta_order_increment ON lg_sales_order_eta_update_history (order_increment_id);

EOSQL

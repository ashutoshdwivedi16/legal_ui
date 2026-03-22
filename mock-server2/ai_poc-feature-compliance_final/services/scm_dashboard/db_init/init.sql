-- PostgreSQL init script for SCM Dashboard
-- CHANGES: #5 line_status_code2 added, #13 all DATE→TIMESTAMP
-- Matches actual DB column order as of 2026-02-25
CREATE SCHEMA IF NOT EXISTS scm_dashboard;
SET search_path TO scm_dashboard;

CREATE TABLE IF NOT EXISTS order_tracking_current (
    sales_order_no         VARCHAR(30) NOT NULL,
    order_line_id          VARCHAR(30) NOT NULL,
    last_updated_dt        TIMESTAMP NOT NULL DEFAULT NOW(),
    cust_po_no             VARCHAR(30),
    model_code             VARCHAR(50),
    bill_to_customer_code  VARCHAR(50),
    unit_selling_price     NUMERIC(12,2),
    line_status_code       VARCHAR(30),
    status_full            VARCHAR(60),
    carrier_code           VARCHAR(10),
    warehouse_code         VARCHAR(20),
    current_stage          VARCHAR(30) NOT NULL,
    order_date             TIMESTAMP,
    gerp_booked_date       TIMESTAMP,
    back_order_date        TIMESTAMP,
    pick_release_date      TIMESTAMP,
    picking_date           TIMESTAMP,
    actual_shipment_date   TIMESTAMP,
    sales_date             TIMESTAMP,
    load_plan_date         TIMESTAMP,
    routed_date            TIMESTAMP,
    wms_shipped_date       TIMESTAMP,
    hub_received_dt        TIMESTAMP,
    out_for_delivery_dt    TIMESTAMP,
    delivered_dt           TIMESTAMP,
    rad                    TIMESTAMP,
    rad_rescheduled        TIMESTAMP,
    rsd                    TIMESTAMP,
    first_hold_name        VARCHAR(50),
    hold_names             TEXT,
    hold_dates             TEXT,
    has_backorder_hold     SMALLINT DEFAULT 0,
    lt_total               INT,
    lt_backorder_hold      INT,
    lt_fulfillment         INT,
    lt_transit             INT,
    consignee_name         VARCHAR(200),
    contact_email_addr     VARCHAR(200),
    include_tax_amount     NUMERIC(12,2),
    shipping_address       VARCHAR(500),
    consignee_phone_no     VARCHAR(50),
    magento_rad2           TIMESTAMP,
    magento_po_order_id    BIGINT,
    magento_customer_po_no BIGINT,
    magento_po_created_at  TIMESTAMP,
    magento_erp_exported_at TIMESTAMP,
    am_st_pod_dt           TIMESTAMP,
    load_id                VARCHAR(50),
    line_status_code2      VARCHAR(30),
    completed_dt           TIMESTAMP,
    PRIMARY KEY (sales_order_no, order_line_id)
);

CREATE INDEX IF NOT EXISTS idx_curr_stage ON order_tracking_current (current_stage);
CREATE INDEX IF NOT EXISTS idx_curr_order_date ON order_tracking_current (order_date);
CREATE INDEX IF NOT EXISTS idx_curr_composite ON order_tracking_current (order_date, current_stage);

CREATE TABLE IF NOT EXISTS order_tracking_completed (
    sales_order_no         VARCHAR(30) NOT NULL,
    order_line_id          VARCHAR(30) NOT NULL,
    completed_dt           TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_dt        TIMESTAMP NOT NULL DEFAULT NOW(),
    cust_po_no             VARCHAR(30),
    model_code             VARCHAR(50),
    bill_to_customer_code  VARCHAR(50),
    unit_selling_price     NUMERIC(12,2),
    line_status_code       VARCHAR(30),
    status_full            VARCHAR(60),
    carrier_code           VARCHAR(10),
    warehouse_code         VARCHAR(20),
    current_stage          VARCHAR(30) NOT NULL,
    order_date             TIMESTAMP,
    gerp_booked_date       TIMESTAMP,
    back_order_date        TIMESTAMP,
    pick_release_date      TIMESTAMP,
    picking_date           TIMESTAMP,
    actual_shipment_date   TIMESTAMP,
    sales_date             TIMESTAMP,
    load_plan_date         TIMESTAMP,
    routed_date            TIMESTAMP,
    wms_shipped_date       TIMESTAMP,
    hub_received_dt        TIMESTAMP,
    out_for_delivery_dt    TIMESTAMP,
    delivered_dt           TIMESTAMP,
    rad                    TIMESTAMP,
    rad_rescheduled        TIMESTAMP,
    rsd                    TIMESTAMP,
    first_hold_name        VARCHAR(50),
    hold_names             TEXT,
    hold_dates             TEXT,
    has_backorder_hold     SMALLINT DEFAULT 0,
    lt_total               INT,
    lt_backorder_hold      INT,
    lt_fulfillment         INT,
    lt_transit             INT,
    consignee_name         VARCHAR(200),
    contact_email_addr     VARCHAR(200),
    include_tax_amount     NUMERIC(12,2),
    shipping_address       VARCHAR(500),
    consignee_phone_no     VARCHAR(50),
    magento_rad2           TIMESTAMP,
    magento_po_order_id    BIGINT,
    magento_customer_po_no BIGINT,
    magento_po_created_at  TIMESTAMP,
    magento_erp_exported_at TIMESTAMP,
    am_st_pod_dt           TIMESTAMP,
    load_id                VARCHAR(50),
    line_status_code2      VARCHAR(30),
    PRIMARY KEY (sales_order_no, order_line_id)
);

CREATE INDEX IF NOT EXISTS idx_comp_order_date ON order_tracking_completed (order_date);
CREATE INDEX IF NOT EXISTS idx_comp_stage ON order_tracking_completed (current_stage);

CREATE TABLE IF NOT EXISTS order_comments (
    entity_id              BIGINT NOT NULL,
    sales_order_no         VARCHAR(30) NOT NULL,
    order_line_id          VARCHAR(30) NOT NULL,
    comment                TEXT,
    status                 VARCHAR(50),
    created_at             TIMESTAMP,
    PRIMARY KEY (entity_id)
);

CREATE INDEX IF NOT EXISTS idx_comments_order ON order_comments (sales_order_no, order_line_id);

CREATE TABLE IF NOT EXISTS order_eta_updates (
    history_id             BIGINT NOT NULL,
    sales_order_no         VARCHAR(30) NOT NULL,
    order_line_id          VARCHAR(30) NOT NULL,
    source                 VARCHAR(50),
    send_email             CHAR(1),
    eta_date_from          TIMESTAMP,
    eta_date_to            TIMESTAMP,
    created_at             TIMESTAMP,
    PRIMARY KEY (history_id)
);

CREATE INDEX IF NOT EXISTS idx_eta_order ON order_eta_updates (sales_order_no, order_line_id);
-- Initialize schema and minimal PDS tables for local dev

CREATE DATABASE IF NOT EXISTS product_data_store CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE product_data_store;

-- ========== Minimal PDS tables for product lookups ==========
CREATE TABLE IF NOT EXISTS product_master (
    product_id                varchar(50)                         not null
        primary key,
    product_model_id          varchar(30)                         null,
    sku                       varchar(50)                         null,
    product_master_attributes json                                null,
    biz_type                  char(3)                             null,
    model_status              varchar(20)                         null,
    updated_time              timestamp                           null,
    created_by                varchar(40)                         null,
    created_at                timestamp default CURRENT_TIMESTAMP null,
    updated_by                varchar(40)                         null,
    updated_at                timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_common (
    product_id                varchar(50)                         not null,
    locale_id                 varchar(15)                         not null,
    category                  json                                null,
    associates                json                                null,
    product_common_attributes json                                null,
    varient_type              varchar(300)                        null,
    varient_value             varchar(300)                        null,
    biz_type                  char(3)                             null,
    model_status              varchar(20)                         null,
    configurator_flag         tinyint(1)                          null comment 'Use to determine multi Variant Configurator',
    configurator_value        json                                null comment 'Use when Variant more than 2 level',
    updated_time              timestamp                           null,
    created_by                varchar(40)                         null,
    created_at                timestamp default CURRENT_TIMESTAMP null,
    updated_by                varchar(40)                         null,
    updated_at                timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    primary key (product_id, locale_id)
) DEFAULT CHARSET=utf8mb4;

-- product_metas table (required by repository query)
CREATE TABLE IF NOT EXISTS product_metas (
    product_id                varchar(50)                         not null,
    meta_type                 varchar(50)                         not null,
    product_group_attributes  json                                null,
    created_at                timestamp default CURRENT_TIMESTAMP null,
    updated_at                timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    primary key (product_id, meta_type)
) DEFAULT CHARSET=utf8mb4;

-- ========== SEED DATA FOR INTEGRATION TESTS ==========

-- Product 1: MD09034027 (LG OLED TV)
INSERT INTO product_master (product_id, sku, product_master_attributes)
VALUES ('MD09034027', 'OLED65C3PUA', '{"name": "LG OLED TV 65 Inch", "brand": "LG"}');

INSERT INTO product_common (product_id, locale_id, category, product_common_attributes)
VALUES ('MD09034027', 'en-US', 
        '{"categoryId": "CT0001", "categoryName": "OLED TVs"}', 
        '{"common_user_friendly_name_identifier": "LG 65 Inch Class C3 Series OLED evo 4K TV", "features": ["4K", "Smart TV", "AI Processor α9 Gen6"], "price": 1999.99}');

INSERT INTO product_metas (product_id, meta_type, product_group_attributes)
VALUES ('MD09034027', 'spec', '{"screen_size": "65 inches", "resolution": "4K UHD (3840 x 2160)", "display_type": "OLED", "refresh_rate": "120Hz", "hdr": "Dolby Vision, HDR10, HLG", "smart_platform": "webOS 23", "processor": "α9 AI Processor Gen6"}');

-- Product 2: MD09033837 (LG QNED TV)
INSERT INTO product_master (product_id, sku, product_master_attributes)
VALUES ('MD09033837', 'QNED85UQA65', '{"name": "LG QNED TV 65 Inch", "brand": "LG"}');

INSERT INTO product_common (product_id, locale_id, category, product_common_attributes)
VALUES ('MD09033837', 'en-US', 
        '{"categoryId": "CT0001", "categoryName": "OLED TVs"}', 
        '{"common_user_friendly_name_identifier": "LG 65 Inch Class QNED85 Series Mini LED 4K TV", "features": ["4K", "MiniLED", "Quantum Dot NanoCell"], "price": 1499.99}');

INSERT INTO product_metas (product_id, meta_type, product_group_attributes)
VALUES ('MD09033837', 'spec', '{"screen_size": "65 inches", "resolution": "4K UHD (3840 x 2160)", "display_type": "QNED Mini LED", "refresh_rate": "120Hz", "hdr": "HDR10 Pro, HLG", "smart_platform": "webOS 23", "processor": "α7 AI Processor Gen6"}');

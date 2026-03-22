-- Compliance Validator schema + seed data

CREATE TABLE IF NOT EXISTS compliance_rules (
    id VARCHAR(128) PRIMARY KEY,
    rule_name VARCHAR(255) NOT NULL,
    prompt_instruction TEXT NOT NULL,
    severity VARCHAR(64) NOT NULL DEFAULT 'MEDIUM',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    project_description TEXT,
    project_prompt TEXT,
    rules_mode VARCHAR(32) NOT NULL DEFAULT 'global',
    rules_uri VARCHAR(2048),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_urls (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    url VARCHAR(2048) NOT NULL,
    json_keys JSON,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_jobs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    status VARCHAR(64) NOT NULL DEFAULT 'RUNNING',
    run_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_scanned INTEGER DEFAULT 0,
    pass_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    ignored_count INTEGER DEFAULT 0,
    applied_rule_ids JSON,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_results (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES compliance_jobs(id),
    content_id VARCHAR(255) NOT NULL,
    content_type VARCHAR(128) NOT NULL,
    source VARCHAR(255),
    input_text TEXT NOT NULL,
    compliance_score FLOAT NOT NULL,
    status VARCHAR(64) NOT NULL,
    violation_type VARCHAR(64),
    failed_rules JSON,
    llm_reasoning TEXT,
    correction_hint TEXT,
    ignore_reasoning BOOLEAN NOT NULL DEFAULT FALSE,
    ignored_fields JSON,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO compliance_rules (id, rule_name, prompt_instruction, severity, is_active) VALUES
('legal_rule_01', 'No Superlatives', 'Prohibits use of absolute or exaggerated claims such as "Best", "Perfect", "Guaranteed", "Ultimate", "Supreme", "Finest", or similar superlative language that cannot be objectively verified. Marketing content must be factual and measurable.', 'CRITICAL', true),
('legal_rule_02', 'No Hallucinations', 'All product specifications, features, and capabilities mentioned must match verified product documentation. No invented or unverified information is allowed. Every claim must be traceable to official product specs, manuals, or certified documentation.', 'CRITICAL', true),
('legal_rule_03', 'No Unverified Performance Claims', 'Prohibits claims about product longevity, durability, or performance metrics (e.g., "Lasts 20 years", "Never breaks", "Lifetime warranty") unless supported by verified testing data or official warranty documentation. All performance claims must be substantiated.', 'CRITICAL', true),
('legal_rule_04', 'No Competitor Comparisons', 'Prohibits any direct or implied comparisons to competitor products or brands (e.g., "Better than Sony", "Outperforms Samsung", "Superior to competitors"). Marketing must focus solely on LG product features without referencing competitive products.', 'HIGH', true),
('legal_rule_05', 'No Medical Claims', 'Prohibits any health, medical, or therapeutic claims (e.g., "Cures asthma", "Prevents allergies", "Improves health", "Medically proven"). Products cannot be marketed as providing medical benefits unless certified as medical devices with appropriate regulatory approval.', 'CRITICAL', true),
('legal_rule_06', 'No Environmental Claims', 'Prohibits unverified environmental claims such as "Green", "Eco-friendly", "Carbon neutral", "Sustainable", "Environmentally safe" unless supported by certified third-party verification or official environmental certifications (e.g., Energy Star, EPA certified).', 'HIGH', true),
('legal_rule_07', 'No Pricing Claims', 'Prohibits absolute pricing claims like "Lowest price", "Cheapest", "Best value", "Unbeatable price" unless supported by verifiable market analysis data. Pricing references must be factual and time-bound if comparative.', 'HIGH', true),
('legal_rule_08', 'No Safety Guarantees', 'Prohibits absolute safety claims such as "100% safe", "Child-proof", "Accident-proof", "Completely safe", "Zero risk". Safety features can be described but not guaranteed as absolute. Use language like "designed with safety features" instead of guarantees.', 'CRITICAL', true),
('legal_rule_09', 'No Unverified Certifications', 'Only certified and verified certifications and badges may be referenced (e.g., genuine Energy Star certification). Prohibits mentioning certifications, awards, or endorsements that the product has not officially received. All certifications must be current and valid.', 'CRITICAL', true),
('legal_rule_10', 'No Slang', 'Prohibits casual slang, colloquialisms, or informal language (e.g., "gonna", "wanna", "ain''t", "cool beans", "legit", "dope"). Marketing content must maintain professional business language appropriate for corporate communications.', 'MEDIUM', true),
('legal_rule_11', 'No Subjective Adjectives', 'Prohibits overly subjective or exaggerated adjectives that cannot be objectively measured (e.g., "Mind-blowing", "Jaw-dropping", "Breathtaking", "Revolutionary", "Game-changing", "Incredible"). Use factual, measurable descriptors instead.', 'MEDIUM', true),
('legal_rule_12', 'No Emojis/Exclamations', 'Prohibits use of emojis, emoticons, or excessive exclamation marks in professional marketing content. Maintains professionalism and corporate brand standards. Content should be clear, factual, and professionally formatted.', 'MEDIUM', true),
('legal_rule_13', 'No Trademark Infringement', 'Prohibits unauthorized use of third-party trademarks, brand names, or intellectual property. LG trademarks may be used according to brand guidelines, but all other trademarks require proper authorization and attribution. Respect all intellectual property rights.', 'CRITICAL', true),
('legal_rule_14', 'No PII', 'Prohibits inclusion of Personally Identifiable Information such as customer names, phone numbers, email addresses, physical addresses, social security numbers, or any other personal data that could identify individuals. Marketing content must be generic and protect user privacy.', 'CRITICAL', true)
ON CONFLICT (id) DO NOTHING;

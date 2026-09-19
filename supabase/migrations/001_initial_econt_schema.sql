-- ==============================================================================
-- ECont Database Schema - Version 1.0 (PostgreSQL 18 / Supabase)
-- Nền tảng kết nối & tái sử dụng container rỗng
-- Tuân thủ SRS v1.0, agent.md và plan.md
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Identity & Company Management
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_code VARCHAR(20) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100) NOT NULL,
    business_type VARCHAR(50) NOT NULL, -- FORWARDER, FACTORY, TRUCKER, SHIPPING_LINE
    address TEXT NOT NULL,
    representative_name VARCHAR(150) NOT NULL,
    representative_phone VARCHAR(20) NOT NULL,
    representative_email VARCHAR(150) NOT NULL,
    verification_status VARCHAR(30) DEFAULT 'PENDING', -- PENDING, VERIFIED, REJECTED, SUSPENDED
    verified_at TIMESTAMPTZ,
    trust_score_a NUMERIC(5,2),
    trust_score_b NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL, -- ENTERPRISE_USER, OPS_ADMIN, SUPER_ADMIN
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- OWNER, DISPATCHER, ACCOUNTANT, DRIVER
    is_active BOOLEAN DEFAULT TRUE,
    delegation_scope TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, company_id)
);

-- 2. Master Catalogs
CREATE TABLE IF NOT EXISTS carriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL, -- MSK, CMA, ONE, EMC, COSCO
    name VARCHAR(150) NOT NULL,
    ru_policy_url TEXT,
    default_ru_fee_vnd BIGINT DEFAULT 1200000,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS depots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    carrier_id UUID REFERENCES carriers(id),
    address TEXT NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    operating_hours VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE
);

-- 3. Assets & Custody
CREATE TABLE IF NOT EXISTS container_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    container_number VARCHAR(11) UNIQUE NOT NULL, -- ISO 6346 Standard (4 letters + 7 digits)
    container_type VARCHAR(10) NOT NULL, -- 20GP, 40HC (40HQ normalized)
    carrier_id UUID NOT NULL REFERENCES carriers(id),
    current_custodian_id UUID NOT NULL REFERENCES companies(id),
    physical_condition VARCHAR(30) DEFAULT 'GOOD', -- GOOD, MINOR_DAMAGE, MAJOR_DAMAGE
    condition_notes TEXT,
    current_depot_return_id UUID REFERENCES depots(id),
    current_location_name VARCHAR(255) NOT NULL,
    current_latitude NUMERIC(10, 7),
    current_longitude NUMERIC(10, 7),
    free_time_detention_end TIMESTAMPTZ NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Supply Offers (Doanh nghiệp A)
CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES container_assets(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    status VARCHAR(30) DEFAULT 'AVAILABLE', -- DRAFT, UNDER_REVIEW, AVAILABLE, HELD, ALLOCATED, COMPLETED, CANCELLED
    pickup_location_name VARCHAR(255) NOT NULL,
    pickup_latitude NUMERIC(10, 7) NOT NULL,
    pickup_longitude NUMERIC(10, 7) NOT NULL,
    available_from TIMESTAMPTZ NOT NULL,
    available_to TIMESTAMPTZ NOT NULL,
    expected_depot_id UUID REFERENCES depots(id),
    baseline_depot_cost_vnd BIGINT NOT NULL DEFAULT 3000000, -- T_A
    photos_json JSONB DEFAULT '[]',
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Demand Requests (Doanh nghiệp B)
CREATE TABLE IF NOT EXISTS container_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id),
    carrier_id UUID NOT NULL REFERENCES carriers(id),
    container_type VARCHAR(10) NOT NULL, -- 20GP, 40HC
    booking_number VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'OPEN', -- DRAFT, OPEN, HELD, ALLOCATED, COMPLETED, EXPIRED, CANCELLED
    delivery_location_name VARCHAR(255) NOT NULL,
    delivery_latitude NUMERIC(10, 7) NOT NULL,
    delivery_longitude NUMERIC(10, 7) NOT NULL,
    pickup_window_start TIMESTAMPTZ NOT NULL,
    pickup_window_end TIMESTAMPTZ NOT NULL,
    cut_off_time TIMESTAMPTZ NOT NULL,
    max_distance_km NUMERIC(6, 2) DEFAULT 40.0, -- Dmax
    cargo_type VARCHAR(100) NOT NULL,
    baseline_pickup_cost_vnd BIGINT NOT NULL DEFAULT 3400000, -- T_B
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Reservations & Concurrency Locks (PostgreSQL partial unique indexes)
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES container_assets(id),
    request_id UUID NOT NULL REFERENCES container_requests(id),
    offer_id UUID NOT NULL REFERENCES offers(id),
    company_b_id UUID NOT NULL REFERENCES companies(id),
    allocation_state VARCHAR(30) NOT NULL, -- HELD, ALLOCATED, RELEASED
    hold_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique indexes as mandated by plan.md section 5.2:
CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_asset
ON reservations (asset_id)
WHERE allocation_state IN ('HELD', 'ALLOCATED');

CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_request
ON reservations (request_id)
WHERE allocation_state IN ('HELD', 'ALLOCATED');

-- 7. Transactions (Vòng đời 7 bước)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES reservations(id),
    offer_id UUID NOT NULL REFERENCES offers(id),
    request_id UUID NOT NULL REFERENCES container_requests(id),
    asset_id UUID NOT NULL REFERENCES container_assets(id),
    company_a_id UUID NOT NULL REFERENCES companies(id),
    company_b_id UUID NOT NULL REFERENCES companies(id),
    status VARCHAR(30) NOT NULL DEFAULT 'NEGOTIATING',
    -- NEGOTIATING, PENDING_CARRIER, AWAITING_PAYMENT, READY_FOR_PICKUP, INSPECTION, HANDOVER_PENDING, COMPLETED, CANCELLED, REJECTED, EXPIRED
    is_on_hold BOOLEAN DEFAULT FALSE,
    hold_reason TEXT,
    due_at TIMESTAMPTZ,
    next_action VARCHAR(255),
    agreement_version INT DEFAULT 1,
    company_a_accepted_at TIMESTAMPTZ,
    company_b_accepted_at TIMESTAMPTZ,
    handover_hash VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Quotes & Pricing Lines (Công thức SRS)
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    t_a_vnd BIGINT NOT NULL, -- 3,000,000
    t_b_vnd BIGINT NOT NULL, -- 3,400,000
    f_ru_vnd BIGINT NOT NULL, -- 1,200,000
    share_alpha NUMERIC(4, 2) NOT NULL DEFAULT 0.50, -- 0.5
    trucking_ab_vnd BIGINT NOT NULL DEFAULT 800000, -- 800,000
    extras_a_vnd BIGINT NOT NULL DEFAULT 0,
    extras_b_vnd BIGINT NOT NULL DEFAULT 0,
    r_a0_vnd BIGINT NOT NULL, -- alpha * F_RU + extras_A
    r_b0_vnd BIGINT NOT NULL, -- trucking_AB + (1-alpha)*F_RU + extras_B
    g_a_vnd BIGINT NOT NULL, -- T_A - R_A0
    g_b_vnd BIGINT NOT NULL, -- T_B - R_B0
    f_a_vnd BIGINT NOT NULL, -- 0.25 * max(G_A, 0)
    f_b_vnd BIGINT NOT NULL, -- 0.15 * max(G_B, 0)
    s_a_vnd BIGINT NOT NULL, -- Net saving A: G_A - F_A
    s_b_vnd BIGINT NOT NULL, -- Net saving B: G_B - F_B
    is_accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Carrier Approvals (RU Approval qua Ops)
CREATE TABLE IF NOT EXISTS carrier_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    carrier_id UUID NOT NULL REFERENCES carriers(id),
    approval_reference VARCHAR(100) NOT NULL,
    status VARCHAR(30) DEFAULT 'APPROVED', -- PENDING, APPROVED, REJECTED, EXPIRED
    ops_reviewer_id UUID REFERENCES users(id),
    evidence_file_name VARCHAR(255),
    evidence_file_url TEXT,
    notes TEXT,
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 10. Payments & Settlement
CREATE TABLE IF NOT EXISTS payment_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    payer_role VARCHAR(10) NOT NULL, -- PARTY_A, PARTY_B
    amount_vnd BIGINT NOT NULL,
    status VARCHAR(30) DEFAULT 'PENDING', -- PENDING, SETTLED, SUSPENSE, REFUNDED
    bank_reference VARCHAR(100),
    payment_method VARCHAR(50) DEFAULT 'BANK_TRANSFER',
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Dispatch Permits & Handover
CREATE TABLE IF NOT EXISTS dispatch_permits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    permit_number VARCHAR(50) UNIQUE NOT NULL,
    verification_token VARCHAR(64) UNIQUE NOT NULL,
    qr_code_payload TEXT NOT NULL,
    driver_name VARCHAR(150) NOT NULL,
    truck_plate VARCHAR(20) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(30) DEFAULT 'ACTIVE' -- ACTIVE, USED, REVOKED, EXPIRED
);

CREATE TABLE IF NOT EXISTS inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    inspector_name VARCHAR(150) NOT NULL,
    checklist_floor BOOLEAN DEFAULT TRUE,
    checklist_walls BOOLEAN DEFAULT TRUE,
    checklist_roof BOOLEAN DEFAULT TRUE,
    checklist_doors BOOLEAN DEFAULT TRUE,
    checklist_gaskets BOOLEAN DEFAULT TRUE,
    checklist_undercarriage BOOLEAN DEFAULT TRUE,
    is_discrepancy_found BOOLEAN DEFAULT FALSE,
    discrepancy_notes TEXT,
    photos_json JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Support Cases & Disputes
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    opened_by_company_id UUID NOT NULL REFERENCES companies(id),
    case_type VARCHAR(50) NOT NULL, -- DAMAGE_DISPUTE, LATE_HANDOVER, CARRIER_REJECTION, PAYMENT_ISSUE
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'OPEN', -- OPEN, IN_REVIEW, RESOLVED, CLOSED
    resolution_summary TEXT,
    resolved_by_user_id UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Audit Trail
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_name VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    actor_id UUID,
    actor_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'system_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "HomeStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "HomeMemberRole" AS ENUM ('owner', 'admin', 'member', 'viewer');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('bulb', 'fan', 'ac', 'tv', 'plug', 'dimmer', 'custom');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('on', 'off');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('pending', 'executed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('once', 'daily', 'weekly', 'cron');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('info', 'warning', 'error');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'processing', 'packed', 'shipped', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cod', 'upi', 'manual');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('available', 'reserved', 'shipped', 'delivered', 'claimed');

-- CreateEnum
CREATE TYPE "WarrantyClaimStatus" AS ENUM ('submitted', 'approved', 'rejected', 'resolved');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),
    "theme_pref" VARCHAR(16),
    "push_device_toggles" BOOLEAN NOT NULL DEFAULT true,
    "push_system_alerts" BOOLEAN NOT NULL DEFAULT true,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "expo_push_token" VARCHAR(100),
    "avatar_url" VARCHAR(500),
    "dob" DATE,
    "gender" VARCHAR(20),
    "phone" VARCHAR(20),
    "address" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_chats" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "homeId" INTEGER NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" SERIAL NOT NULL,
    "chatId" INTEGER NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homes" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "status" "HomeStatus" NOT NULL DEFAULT 'active',
    "maxDevices" INTEGER NOT NULL DEFAULT 20,
    "maxMembers" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_members" (
    "id" SERIAL NOT NULL,
    "homeId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "HomeMemberRole" NOT NULL DEFAULT 'member',
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "daily_limit_minutes" INTEGER,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_access" (
    "id" SERIAL NOT NULL,
    "homeId" INTEGER NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_usage" (
    "id" SERIAL NOT NULL,
    "homeId" INTEGER NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "on_minutes" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" SERIAL NOT NULL,
    "homeId" INTEGER NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "inviteCode" VARCHAR(12) NOT NULL,
    "role" "HomeMemberRole" NOT NULL DEFAULT 'member',
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" SERIAL NOT NULL,
    "homeId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" SERIAL NOT NULL,
    "homeId" INTEGER NOT NULL,
    "roomId" INTEGER,
    "name" VARCHAR(100) NOT NULL,
    "type" "DeviceType" NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'off',
    "custom_value" VARCHAR(255),
    "serial_number" VARCHAR(64),
    "firmware_version" VARCHAR(32),
    "ip_address" VARCHAR(45),
    "last_seen" TIMESTAMP(3),
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "ota_pending_version" VARCHAR(32),
    "ota_requested_at" TIMESTAMP(3),
    "ota_progress" INTEGER,
    "ota_status" VARCHAR(32),
    "espId" INTEGER,
    "channel" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esp_devices" (
    "id" SERIAL NOT NULL,
    "homeId" INTEGER NOT NULL,
    "macAddress" VARCHAR(32) NOT NULL,
    "name" VARCHAR(64),
    "ssid" VARCHAR(64),
    "serial_code" VARCHAR(32),
    "model_code" VARCHAR(16),
    "console_password" VARCHAR(64),
    "ip_address" VARCHAR(45),
    "firmware_version" VARCHAR(32),
    "last_seen" TIMESTAMP(3),
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "last_api_key_id" INTEGER,
    "ota_pending_version" VARCHAR(32),
    "ota_requested_at" TIMESTAMP(3),
    "ota_progress" INTEGER,
    "ota_status" VARCHAR(32),
    "led_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esp_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_configurations" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "config_name" VARCHAR(255) NOT NULL,
    "config_value" TEXT,

    CONSTRAINT "device_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_logs" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "log_type" VARCHAR(255) NOT NULL,
    "log_message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_commands" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "command" VARCHAR(255) NOT NULL,
    "status" "CommandStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_at" TIMESTAMP(3),

    CONSTRAINT "device_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "action" "DeviceStatus" NOT NULL,
    "type" "ScheduleType" NOT NULL,
    "run_at" TIMESTAMP(3),
    "cron" VARCHAR(100),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "next_run" TIMESTAMP(3),
    "last_run" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "homeId" INTEGER,
    "label" VARCHAR(100),
    "key_hash" VARCHAR(64) NOT NULL,
    "key_prefix" VARCHAR(8) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "device_info" VARCHAR(255),
    "ip_address" VARCHAR(45),
    "last_active" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "category" VARCHAR(20) NOT NULL DEFAULT 'system',
    "type" "NotificationType" NOT NULL DEFAULT 'info',
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "homeId" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100),
    "entityId" INTEGER,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firmware_versions" (
    "id" SERIAL NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "url" VARCHAR(255) NOT NULL,
    "release_notes" TEXT,
    "model_code" VARCHAR(16) NOT NULL DEFAULT '',
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "firmware_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "modelCode" VARCHAR(32) NOT NULL,
    "relayCount" INTEGER NOT NULL DEFAULT 4,
    "price" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "features" JSONB,
    "imageUrl" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "upcoming" BOOLEAN NOT NULL DEFAULT false,
    "stock_count" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "orderNumber" VARCHAR(32) NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'manual',
    "paymentStatus" VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    "payment_ref" VARCHAR(64),
    "razorpay_order_id" VARCHAR(64),
    "paid_at" TIMESTAMP(3),
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "shippingName" VARCHAR(100) NOT NULL,
    "shippingPhone" VARCHAR(20) NOT NULL,
    "shippingAddress" VARCHAR(255) NOT NULL,
    "wifiSsid" VARCHAR(64),
    "wifi_password_enc" TEXT,
    "coupon_id" INTEGER,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" VARCHAR(100) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "serialCode" VARCHAR(32),

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serial_registry" (
    "id" SERIAL NOT NULL,
    "serialCode" VARCHAR(32) NOT NULL,
    "productId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "userId" INTEGER,
    "homeId" INTEGER,
    "console_password" VARCHAR(64),
    "status" "SerialStatus" NOT NULL DEFAULT 'available',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMP(3),
    "tested_at" TIMESTAMP(3),
    "warranty_expires_at" TIMESTAMP(3),
    "warranty_status" VARCHAR(20) NOT NULL DEFAULT 'active',

    CONSTRAINT "serial_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" SERIAL NOT NULL,
    "serialCode" VARCHAR(32) NOT NULL,
    "deviceId" INTEGER,
    "userId" INTEGER NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "WarrantyClaimStatus" NOT NULL DEFAULT 'submitted',
    "admin_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(120),
    "phone" VARCHAR(20),
    "subject" VARCHAR(150) NOT NULL,
    "message" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "senderRole" VARCHAR(10) NOT NULL DEFAULT 'admin',
    "senderName" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "attachment_name" VARCHAR(255),
    "attachment_type" VARCHAR(100),
    "attachment_data" TEXT,
    "attachment_path" VARCHAR(255),
    "read_by_user" BOOLEAN NOT NULL DEFAULT false,
    "read_by_admin" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_calls" (
    "id" SERIAL NOT NULL,
    "caller_id" INTEGER NOT NULL,
    "receiver_id" INTEGER NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "room_id" VARCHAR(255) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "support_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "discountType" VARCHAR(16) NOT NULL DEFAULT 'percentage',
    "discountValue" DECIMAL(10,2) NOT NULL,
    "min_order_amount" DECIMAL(10,2),
    "max_discount" DECIMAL(10,2),
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_chat_settings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "peer_user_id" INTEGER NOT NULL,
    "muted_at" TIMESTAMP(3),
    "pinned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_chat_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_meta" (
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_meta_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL,
    "client_id" VARCHAR(100) NOT NULL,
    "client_secret" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "redirect_uris" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_auth_codes" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "client_id" VARCHAR(100) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "home_id" INTEGER NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_tokens" (
    "id" TEXT NOT NULL,
    "access_token" VARCHAR(255) NOT NULL,
    "refresh_token" VARCHAR(255),
    "client_id" VARCHAR(100) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "home_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "home_id" INTEGER NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_subject" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "device_model" VARCHAR(100),
    "push_device_toggles" BOOLEAN NOT NULL DEFAULT true,
    "push_system_alerts" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "rating" DECIMAL(3,2) NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_media" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER,
    "reviewId" INTEGER,
    "url" VARCHAR(500) NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'image',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "assistant_chats_userId_idx" ON "assistant_chats"("userId");

-- CreateIndex
CREATE INDEX "assistant_messages_chatId_idx" ON "assistant_messages"("chatId");

-- CreateIndex
CREATE INDEX "homes_ownerId_idx" ON "homes"("ownerId");

-- CreateIndex
CREATE INDEX "home_members_userId_idx" ON "home_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "home_members_homeId_userId_key" ON "home_members"("homeId", "userId");

-- CreateIndex
CREATE INDEX "device_access_homeId_idx" ON "device_access"("homeId");

-- CreateIndex
CREATE INDEX "device_access_userId_idx" ON "device_access"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "device_access_deviceId_userId_key" ON "device_access"("deviceId", "userId");

-- CreateIndex
CREATE INDEX "device_usage_homeId_idx" ON "device_usage"("homeId");

-- CreateIndex
CREATE UNIQUE INDEX "device_usage_deviceId_userId_date_key" ON "device_usage"("deviceId", "userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_inviteCode_key" ON "invitations"("inviteCode");

-- CreateIndex
CREATE INDEX "invitations_homeId_idx" ON "invitations"("homeId");

-- CreateIndex
CREATE INDEX "invitations_status_idx" ON "invitations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_homeId_name_key" ON "rooms"("homeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "devices_serial_number_key" ON "devices"("serial_number");

-- CreateIndex
CREATE INDEX "devices_homeId_idx" ON "devices"("homeId");

-- CreateIndex
CREATE INDEX "devices_roomId_idx" ON "devices"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "esp_devices_macAddress_key" ON "esp_devices"("macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "esp_devices_serial_code_key" ON "esp_devices"("serial_code");

-- CreateIndex
CREATE INDEX "esp_devices_homeId_idx" ON "esp_devices"("homeId");

-- CreateIndex
CREATE INDEX "esp_devices_last_api_key_id_idx" ON "esp_devices"("last_api_key_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_configurations_deviceId_config_name_key" ON "device_configurations"("deviceId", "config_name");

-- CreateIndex
CREATE INDEX "device_logs_deviceId_idx" ON "device_logs"("deviceId");

-- CreateIndex
CREATE INDEX "device_commands_deviceId_status_idx" ON "device_commands"("deviceId", "status");

-- CreateIndex
CREATE INDEX "schedules_deviceId_idx" ON "schedules"("deviceId");

-- CreateIndex
CREATE INDEX "schedules_enabled_next_run_idx" ON "schedules"("enabled", "next_run");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "api_keys_homeId_idx" ON "api_keys"("homeId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_read_at_idx" ON "notifications"("userId", "read_at");

-- CreateIndex
CREATE INDEX "audit_logs_homeId_idx" ON "audit_logs"("homeId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "firmware_versions_version_model_code_key" ON "firmware_versions"("version", "model_code");

-- CreateIndex
CREATE UNIQUE INDEX "products_modelCode_key" ON "products"("modelCode");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_userId_idx" ON "orders"("userId");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "serial_registry_serialCode_key" ON "serial_registry"("serialCode");

-- CreateIndex
CREATE INDEX "serial_registry_productId_idx" ON "serial_registry"("productId");

-- CreateIndex
CREATE INDEX "serial_registry_status_idx" ON "serial_registry"("status");

-- CreateIndex
CREATE INDEX "serial_registry_orderId_idx" ON "serial_registry"("orderId");

-- CreateIndex
CREATE INDEX "warranty_claims_userId_idx" ON "warranty_claims"("userId");

-- CreateIndex
CREATE INDEX "warranty_claims_serialCode_idx" ON "warranty_claims"("serialCode");

-- CreateIndex
CREATE INDEX "warranty_claims_status_idx" ON "warranty_claims"("status");

-- CreateIndex
CREATE INDEX "contact_messages_status_idx" ON "contact_messages"("status");

-- CreateIndex
CREATE INDEX "contact_messages_userId_idx" ON "contact_messages"("userId");

-- CreateIndex
CREATE INDEX "support_messages_userId_created_at_idx" ON "support_messages"("userId", "created_at");

-- CreateIndex
CREATE INDEX "support_messages_read_by_admin_idx" ON "support_messages"("read_by_admin");

-- CreateIndex
CREATE UNIQUE INDEX "support_calls_room_id_key" ON "support_calls"("room_id");

-- CreateIndex
CREATE INDEX "support_calls_caller_id_idx" ON "support_calls"("caller_id");

-- CreateIndex
CREATE INDEX "support_calls_receiver_id_idx" ON "support_calls"("receiver_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "support_chat_settings_userId_idx" ON "support_chat_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "support_chat_settings_userId_peer_user_id_key" ON "support_chat_settings"("userId", "peer_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_clients_client_id_key" ON "oauth_clients"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_auth_codes_code_key" ON "oauth_auth_codes"("code");

-- CreateIndex
CREATE INDEX "oauth_auth_codes_user_id_idx" ON "oauth_auth_codes"("user_id");

-- CreateIndex
CREATE INDEX "oauth_auth_codes_home_id_idx" ON "oauth_auth_codes"("home_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tokens_access_token_key" ON "oauth_tokens"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tokens_refresh_token_key" ON "oauth_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "oauth_tokens_user_id_idx" ON "oauth_tokens"("user_id");

-- CreateIndex
CREATE INDEX "oauth_tokens_home_id_idx" ON "oauth_tokens"("home_id");

-- CreateIndex
CREATE INDEX "integration_connections_home_id_idx" ON "integration_connections"("home_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_user_id_provider_key" ON "integration_connections"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_token_key" ON "PushSubscription"("token");

-- CreateIndex
CREATE INDEX "product_reviews_productId_idx" ON "product_reviews"("productId");

-- CreateIndex
CREATE INDEX "product_reviews_userId_idx" ON "product_reviews"("userId");

-- CreateIndex
CREATE INDEX "product_media_productId_idx" ON "product_media"("productId");

-- CreateIndex
CREATE INDEX "product_media_reviewId_idx" ON "product_media"("reviewId");

-- AddForeignKey
ALTER TABLE "assistant_chats" ADD CONSTRAINT "assistant_chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_chats" ADD CONSTRAINT "assistant_chats_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "assistant_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homes" ADD CONSTRAINT "homes_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_members" ADD CONSTRAINT "home_members_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_members" ADD CONSTRAINT "home_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_access" ADD CONSTRAINT "device_access_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_access" ADD CONSTRAINT "device_access_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_access" ADD CONSTRAINT "device_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_usage" ADD CONSTRAINT "device_usage_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_usage" ADD CONSTRAINT "device_usage_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_usage" ADD CONSTRAINT "device_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_espId_fkey" FOREIGN KEY ("espId") REFERENCES "esp_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esp_devices" ADD CONSTRAINT "esp_devices_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esp_devices" ADD CONSTRAINT "esp_devices_last_api_key_id_fkey" FOREIGN KEY ("last_api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_configurations" ADD CONSTRAINT "device_configurations_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_logs" ADD CONSTRAINT "device_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_logs" ADD CONSTRAINT "device_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_registry" ADD CONSTRAINT "serial_registry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_registry" ADD CONSTRAINT "serial_registry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_registry" ADD CONSTRAINT "serial_registry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_registry" ADD CONSTRAINT "serial_registry_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_calls" ADD CONSTRAINT "support_calls_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_calls" ADD CONSTRAINT "support_calls_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_chat_settings" ADD CONSTRAINT "support_chat_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_auth_codes" ADD CONSTRAINT "oauth_auth_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_auth_codes" ADD CONSTRAINT "oauth_auth_codes_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "homes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "product_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

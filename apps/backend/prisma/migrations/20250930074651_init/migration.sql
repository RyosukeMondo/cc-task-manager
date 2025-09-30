-- CreateTable
CREATE TABLE "websocket_events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "correlation_id" TEXT,
    "room" TEXT,
    "room_type" TEXT,
    "target_user_id" TEXT,
    "user_id" TEXT NOT NULL,
    "event_data" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "persisted" BOOLEAN NOT NULL DEFAULT true,
    "replayed" BOOLEAN NOT NULL DEFAULT false,
    "replay_count" INTEGER NOT NULL DEFAULT 0,
    "broadcast_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "replayed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "websocket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "websocket_connections" (
    "id" TEXT NOT NULL,
    "socket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "rooms" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_event_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replay_from_time" TIMESTAMP(3),
    "replay_completed" BOOLEAN NOT NULL DEFAULT false,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "websocket_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "websocket_events_event_type_idx" ON "websocket_events"("event_type");

-- CreateIndex
CREATE INDEX "websocket_events_user_id_idx" ON "websocket_events"("user_id");

-- CreateIndex
CREATE INDEX "websocket_events_room_idx" ON "websocket_events"("room");

-- CreateIndex
CREATE INDEX "websocket_events_room_type_idx" ON "websocket_events"("room_type");

-- CreateIndex
CREATE INDEX "websocket_events_target_user_id_idx" ON "websocket_events"("target_user_id");

-- CreateIndex
CREATE INDEX "websocket_events_persisted_idx" ON "websocket_events"("persisted");

-- CreateIndex
CREATE INDEX "websocket_events_replayed_idx" ON "websocket_events"("replayed");

-- CreateIndex
CREATE INDEX "websocket_events_broadcast_at_idx" ON "websocket_events"("broadcast_at");

-- CreateIndex
CREATE INDEX "websocket_events_expires_at_idx" ON "websocket_events"("expires_at");

-- CreateIndex
CREATE INDEX "websocket_events_priority_idx" ON "websocket_events"("priority");

-- CreateIndex
CREATE INDEX "websocket_events_user_id_broadcast_at_idx" ON "websocket_events"("user_id", "broadcast_at");

-- CreateIndex
CREATE INDEX "websocket_events_room_broadcast_at_idx" ON "websocket_events"("room", "broadcast_at");

-- CreateIndex
CREATE INDEX "websocket_events_room_type_broadcast_at_idx" ON "websocket_events"("room_type", "broadcast_at");

-- CreateIndex
CREATE INDEX "websocket_events_target_user_id_broadcast_at_idx" ON "websocket_events"("target_user_id", "broadcast_at");

-- CreateIndex
CREATE INDEX "websocket_events_persisted_replayed_idx" ON "websocket_events"("persisted", "replayed");

-- CreateIndex
CREATE INDEX "websocket_events_replayed_broadcast_at_idx" ON "websocket_events"("replayed", "broadcast_at");

-- CreateIndex
CREATE INDEX "websocket_events_expires_at_replayed_idx" ON "websocket_events"("expires_at", "replayed");

-- CreateIndex
CREATE INDEX "websocket_events_priority_broadcast_at_idx" ON "websocket_events"("priority", "broadcast_at");

-- CreateIndex
CREATE INDEX "websocket_events_user_id_persisted_replayed_broadcast_at_idx" ON "websocket_events"("user_id", "persisted", "replayed", "broadcast_at");

-- CreateIndex
CREATE INDEX "websocket_events_room_persisted_replayed_broadcast_at_idx" ON "websocket_events"("room", "persisted", "replayed", "broadcast_at");

-- CreateIndex
CREATE INDEX "websocket_events_target_user_id_persisted_replayed_broadcas_idx" ON "websocket_events"("target_user_id", "persisted", "replayed", "broadcast_at");

-- CreateIndex
CREATE INDEX "websocket_events_event_type_persisted_replayed_broadcast_at_idx" ON "websocket_events"("event_type", "persisted", "replayed", "broadcast_at");

-- CreateIndex
CREATE UNIQUE INDEX "websocket_connections_socket_id_key" ON "websocket_connections"("socket_id");

-- CreateIndex
CREATE INDEX "websocket_connections_socket_id_idx" ON "websocket_connections"("socket_id");

-- CreateIndex
CREATE INDEX "websocket_connections_user_id_idx" ON "websocket_connections"("user_id");

-- CreateIndex
CREATE INDEX "websocket_connections_is_active_idx" ON "websocket_connections"("is_active");

-- CreateIndex
CREATE INDEX "websocket_connections_last_heartbeat_idx" ON "websocket_connections"("last_heartbeat");

-- CreateIndex
CREATE INDEX "websocket_connections_last_event_at_idx" ON "websocket_connections"("last_event_at");

-- CreateIndex
CREATE INDEX "websocket_connections_replay_from_time_idx" ON "websocket_connections"("replay_from_time");

-- CreateIndex
CREATE INDEX "websocket_connections_replay_completed_idx" ON "websocket_connections"("replay_completed");

-- CreateIndex
CREATE INDEX "websocket_connections_connected_at_idx" ON "websocket_connections"("connected_at");

-- CreateIndex
CREATE INDEX "websocket_connections_disconnected_at_idx" ON "websocket_connections"("disconnected_at");

-- CreateIndex
CREATE INDEX "websocket_connections_user_id_is_active_idx" ON "websocket_connections"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "websocket_connections_is_active_last_heartbeat_idx" ON "websocket_connections"("is_active", "last_heartbeat");

-- CreateIndex
CREATE INDEX "websocket_connections_user_id_replay_from_time_idx" ON "websocket_connections"("user_id", "replay_from_time");

-- CreateIndex
CREATE INDEX "websocket_connections_replay_completed_replay_from_time_idx" ON "websocket_connections"("replay_completed", "replay_from_time");

-- CreateIndex
CREATE INDEX "websocket_connections_disconnected_at_is_active_idx" ON "websocket_connections"("disconnected_at", "is_active");

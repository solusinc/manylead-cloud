import type postgres from "postgres";

/**
 * Configura TimescaleDB hypertables para tabelas de time-series
 *
 * Este helper configura hypertables para:
 * - message (particionada por timestamp)
 * - chat (particionada por created_at)
 *
 * Deve ser executado APÓS as migrations criarem as tabelas
 */
export async function setupTimescaleDB(
  client: ReturnType<typeof postgres>,
): Promise<void> {
  console.log("[TimescaleDB] Setting up hypertables for message and chat tables...");

  try {
    // ============================================================================
    // 1. CRIAR HYPERTABLE PARA MESSAGE
    // ============================================================================
    console.log("[TimescaleDB] Creating hypertable for 'message' table...");

    // Converter message para hypertable (particionada por timestamp)
    await client.unsafe(`
      SELECT create_hypertable(
        'message',
        'timestamp',
        chunk_time_interval => INTERVAL '1 week',
        if_not_exists => TRUE
      );
    `);

    console.log("[TimescaleDB] ✅ Message hypertable created");

    // Criar UNIQUE constraint para WhatsApp message ID (DEPOIS do hypertable)
    // IMPORTANTE: TimescaleDB exige que UNIQUE inclua a coluna de particionamento
    console.log("[TimescaleDB] Creating UNIQUE constraint for message.whatsapp_message_id...");
    await client.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS message_whatsapp_id_unique
      ON message (whatsapp_message_id, timestamp)
      WHERE whatsapp_message_id IS NOT NULL;
    `);
    console.log("[TimescaleDB] ✅ Message UNIQUE constraint created");

    // ============================================================================
    // 2. CRIAR HYPERTABLE PARA CHAT
    // ============================================================================
    console.log("[TimescaleDB] Creating hypertable for 'chat' table...");

    // Converter chat para hypertable (particionada por created_at)
    await client.unsafe(`
      SELECT create_hypertable(
        'chat',
        'created_at',
        chunk_time_interval => INTERVAL '1 month',
        if_not_exists => TRUE
      );
    `);

    console.log("[TimescaleDB] ✅ Chat hypertable created");

    // Criar UNIQUE constraint para channel + contact (DEPOIS do hypertable)
    // IMPORTANTE: TimescaleDB exige que UNIQUE inclua a coluna de particionamento
    console.log("[TimescaleDB] Creating UNIQUE constraint for chat.channel_id + contact_id...");
    await client.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS chat_channel_contact_unique
      ON chat (channel_id, contact_id, created_at)
      WHERE channel_id IS NOT NULL;
    `);
    console.log("[TimescaleDB] ✅ Chat UNIQUE constraint created");

    // ============================================================================
    // 3. CONFIGURAR COMPRESSION POLICY (Economiza 70-90% de disco)
    // ============================================================================
    console.log("[TimescaleDB] Configuring compression policies...");

    // Comprimir mensagens após 1 mês
    await client.unsafe(`
      ALTER TABLE message SET (
        timescaledb.compress,
        timescaledb.compress_orderby = 'timestamp DESC',
        timescaledb.compress_segmentby = 'chat_id'
      );
    `);

    await client.unsafe(`
      SELECT add_compression_policy('message', INTERVAL '1 month');
    `);

    console.log("[TimescaleDB] ✅ Message compression policy configured (compress after 1 month)");

    // Comprimir chats após 3 meses
    await client.unsafe(`
      ALTER TABLE chat SET (
        timescaledb.compress,
        timescaledb.compress_orderby = 'created_at DESC',
        timescaledb.compress_segmentby = 'organization_id'
      );
    `);

    await client.unsafe(`
      SELECT add_compression_policy('chat', INTERVAL '3 months');
    `);

    console.log("[TimescaleDB] ✅ Chat compression policy configured (compress after 3 months)");

    // ============================================================================
    // 4. CONFIGURAR RETENTION POLICY (Auto-delete após 24 meses)
    // ============================================================================
    console.log("[TimescaleDB] Configuring retention policies...");

    // Deletar mensagens após 24 meses automaticamente
    await client.unsafe(`
      SELECT add_retention_policy('message', INTERVAL '24 months');
    `);

    console.log("[TimescaleDB] ✅ Message retention policy configured (delete after 24 months)");

    // Deletar chats após 24 meses automaticamente
    await client.unsafe(`
      SELECT add_retention_policy('chat', INTERVAL '24 months');
    `);

    console.log("[TimescaleDB] ✅ Chat retention policy configured (delete after 24 months)");

    // ============================================================================
    // 5. VERIFICAR HYPERTABLES CRIADAS
    // ============================================================================
    const hypertables = await client<{ hypertable_name: string }[]>`
      SELECT hypertable_name
      FROM timescaledb_information.hypertables
      WHERE hypertable_schema = 'public'
      ORDER BY hypertable_name;
    `;

    console.log(
      `[TimescaleDB] ✅ Created ${hypertables.length} hypertables:`,
      hypertables.map((h) => h.hypertable_name).join(", "),
    );

    console.log("[TimescaleDB] 🎉 TimescaleDB setup completed successfully!");
  } catch (error) {
    console.error("[TimescaleDB] ❌ Failed to setup TimescaleDB:", error);
    throw new Error(
      `Failed to setup TimescaleDB: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Verifica se o TimescaleDB está configurado corretamente
 */
export async function verifyTimescaleDB(
  client: ReturnType<typeof postgres>,
): Promise<{
  message: { configured: boolean; chunks: number };
  chat: { configured: boolean; chunks: number };
}> {
  const hypertables = await client<
    {
      hypertable_name: string;
      num_chunks: number;
    }[]
  >`
    SELECT
      hypertable_name,
      (SELECT COUNT(*) FROM timescaledb_information.chunks c
       WHERE c.hypertable_name = h.hypertable_name) as num_chunks
    FROM timescaledb_information.hypertables h
    WHERE hypertable_schema = 'public'
    AND hypertable_name IN ('message', 'chat');
  `;

  const messageHypertable = hypertables.find((h) => h.hypertable_name === "message");
  const chatHypertable = hypertables.find((h) => h.hypertable_name === "chat");

  return {
    message: {
      configured: !!messageHypertable,
      chunks: messageHypertable?.num_chunks ?? 0,
    },
    chat: {
      configured: !!chatHypertable,
      chunks: chatHypertable?.num_chunks ?? 0,
    },
  };
}

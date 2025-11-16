import type postgres from "postgres";

/**
 * Configura particionamento automático com pg_partman
 *
 * Este helper configura partições mensais para as tabelas:
 * - chat (particionada por created_at)
 * - message (particionada por timestamp)
 *
 * Deve ser executado APÓS as migrations criarem as tabelas
 */
export async function setupPartitioning(
  client: ReturnType<typeof postgres>,
): Promise<void> {
  console.log("[Partitioning] Setting up pg_partman for chat and message tables...");

  try {
    // ============================================================================
    // 1. CONVERTER TABELA CHAT PARA PARTICIONADA
    // ============================================================================
    console.log("[Partitioning] Converting 'chat' table to partitioned table...");

    // Renomear tabela original
    await client.unsafe(`ALTER TABLE chat RENAME TO chat_old;`);

    // Criar nova tabela particionada (APENAS estrutura de colunas e tipos)
    await client.unsafe(`
      CREATE TABLE chat (LIKE chat_old)
      PARTITION BY RANGE (created_at);
    `);

    // Adicionar PRIMARY KEY incluindo a coluna de particionamento
    await client.unsafe(`
      ALTER TABLE chat ADD PRIMARY KEY (id, created_at);
    `);

    // Adicionar UNIQUE constraint incluindo created_at (se não existir)
    await client.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chat_channel_contact_unique'
        ) THEN
          ALTER TABLE chat ADD CONSTRAINT chat_channel_contact_unique
          UNIQUE (channel_id, contact_id, created_at);
        END IF;
      END $$;
    `);

    // Copiar defaults manualmente para as colunas que precisam
    await client.unsafe(`
      ALTER TABLE chat ALTER COLUMN status SET DEFAULT 'open';
      ALTER TABLE chat ALTER COLUMN unread_count SET DEFAULT 0;
      ALTER TABLE chat ALTER COLUMN total_messages SET DEFAULT 0;
      ALTER TABLE chat ALTER COLUMN priority SET DEFAULT 'normal';
      ALTER TABLE chat ALTER COLUMN is_archived SET DEFAULT false;
      ALTER TABLE chat ALTER COLUMN is_pinned SET DEFAULT false;
      ALTER TABLE chat ALTER COLUMN created_at SET DEFAULT now();
      ALTER TABLE chat ALTER COLUMN updated_at SET DEFAULT now();
    `);

    // Copiar dados (se houver)
    await client.unsafe(`
      INSERT INTO chat SELECT * FROM chat_old;
    `);

    // Dropar tabela antiga com CASCADE (para remover FKs dependentes)
    await client.unsafe(`DROP TABLE chat_old CASCADE;`);

    // Recriar foreign keys
    await client.unsafe(`
      ALTER TABLE chat ADD CONSTRAINT chat_channel_id_channel_id_fk
      FOREIGN KEY (channel_id) REFERENCES channel(id) ON DELETE SET NULL;

      ALTER TABLE chat ADD CONSTRAINT chat_contact_id_contact_id_fk
      FOREIGN KEY (contact_id) REFERENCES contact(id) ON DELETE CASCADE;

      ALTER TABLE chat ADD CONSTRAINT chat_assigned_to_agent_id_fk
      FOREIGN KEY (assigned_to) REFERENCES agent(id) ON DELETE SET NULL;
    `);

    // ============================================================================
    // 2. CONFIGURAR PG_PARTMAN PARA CHAT
    // ============================================================================
    console.log("[Partitioning] Setting up pg_partman for 'chat' table...");

    await client.unsafe(`
      SELECT partman.create_parent(
        p_parent_table := 'public.chat',
        p_control := 'created_at',
        p_interval := '1 month',
        p_premake := 4
      );
    `);

    await client.unsafe(`
      UPDATE partman.part_config
      SET
        infinite_time_partitions = true,
        retention = '24 months',
        retention_keep_table = false,
        retention_keep_index = false,
        premake = 4,
        inherit_privileges = true
      WHERE parent_table = 'public.chat';
    `);

    console.log("[Partitioning] ✅ Chat table partitioning configured");

    // ============================================================================
    // 3. CONVERTER TABELA MESSAGE PARA PARTICIONADA
    // ============================================================================
    console.log("[Partitioning] Converting 'message' table to partitioned table...");

    // Renomear tabela original
    await client.unsafe(`ALTER TABLE message RENAME TO message_old;`);

    // Criar nova tabela particionada (APENAS estrutura de colunas e tipos)
    await client.unsafe(`
      CREATE TABLE message (LIKE message_old)
      PARTITION BY RANGE (timestamp);
    `);

    // ADICIONAR coluna chat_created_at para FK composta
    await client.unsafe(`
      ALTER TABLE message ADD COLUMN chat_created_at timestamp;
    `);

    // Adicionar PRIMARY KEY incluindo a coluna de particionamento
    await client.unsafe(`
      ALTER TABLE message ADD PRIMARY KEY (id, timestamp);
    `);

    // Adicionar UNIQUE constraint incluindo timestamp (whatsapp_message_id pode ser NULL, então usa INDEX parcial)
    await client.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS message_whatsapp_id_unique
      ON message (whatsapp_message_id, timestamp)
      WHERE whatsapp_message_id IS NOT NULL;
    `);

    // Copiar defaults manualmente
    await client.unsafe(`
      ALTER TABLE message ALTER COLUMN status SET DEFAULT 'pending';
      ALTER TABLE message ALTER COLUMN is_deleted SET DEFAULT false;
      ALTER TABLE message ALTER COLUMN is_edited SET DEFAULT false;
      ALTER TABLE message ALTER COLUMN visible_to SET DEFAULT 'all';
      ALTER TABLE message ALTER COLUMN timestamp SET DEFAULT now();
      ALTER TABLE message ALTER COLUMN created_at SET DEFAULT now();
    `);

    // Copiar dados (se houver) - incluindo chat_created_at através de JOIN
    await client.unsafe(`
      INSERT INTO message
      SELECT m.*, c.created_at as chat_created_at
      FROM message_old m
      LEFT JOIN chat c ON m.chat_id = c.id;
    `);

    // Dropar tabela antiga com CASCADE (para remover FKs dependentes)
    await client.unsafe(`DROP TABLE message_old CASCADE;`);

    // Recriar foreign keys com FK composta
    await client.unsafe(`
      ALTER TABLE message ADD CONSTRAINT message_chat_id_chat_id_fk
      FOREIGN KEY (chat_id, chat_created_at) REFERENCES chat(id, created_at) ON DELETE CASCADE;
    `);

    // ============================================================================
    // 4. CONFIGURAR PG_PARTMAN PARA MESSAGE
    // ============================================================================
    console.log("[Partitioning] Setting up pg_partman for 'message' table...");

    await client.unsafe(`
      SELECT partman.create_parent(
        p_parent_table := 'public.message',
        p_control := 'timestamp',
        p_interval := '1 month',
        p_premake := 4
      );
    `);

    await client.unsafe(`
      UPDATE partman.part_config
      SET
        infinite_time_partitions = true,
        retention = '24 months',
        retention_keep_table = false,
        retention_keep_index = false,
        premake = 4,
        inherit_privileges = true
      WHERE parent_table = 'public.message';
    `);

    console.log("[Partitioning] ✅ Message table partitioning configured");

    // ============================================================================
    // 5. RUN INITIAL MAINTENANCE
    // ============================================================================
    console.log("[Partitioning] Running initial maintenance...");

    await client.unsafe(`
      SELECT partman.run_maintenance(p_analyze := true);
    `);

    console.log("[Partitioning] ✅ Initial maintenance completed");

    // ============================================================================
    // 6. VERIFICAR PARTIÇÕES CRIADAS
    // ============================================================================
    const chatPartitions = await client<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE tablename LIKE 'chat_p%'
      ORDER BY tablename;
    `;

    const messagePartitions = await client<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE tablename LIKE 'message_p%'
      ORDER BY tablename;
    `;

    console.log(
      `[Partitioning] ✅ Created ${chatPartitions.length} partitions for 'chat' table`,
    );
    console.log(
      `[Partitioning] ✅ Created ${messagePartitions.length} partitions for 'message' table`,
    );

    console.log("[Partitioning] 🎉 Partitioning setup completed successfully!");
  } catch (error) {
    console.error("[Partitioning] ❌ Failed to setup partitioning:", error);
    throw new Error(
      `Failed to setup pg_partman: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Verifica se o particionamento está configurado corretamente
 */
export async function verifyPartitioning(
  client: ReturnType<typeof postgres>,
): Promise<{
  chat: { configured: boolean; partitions: number };
  message: { configured: boolean; partitions: number };
}> {
  const chatConfig = await client<
    {
      parent_table: string;
      partition_interval: string;
      control: string;
      retention: string;
    }[]
  >`
    SELECT
      parent_table,
      partition_interval,
      control,
      retention
    FROM partman.part_config
    WHERE parent_table = 'public.chat';
  `;

  const messageConfig = await client<
    {
      parent_table: string;
      partition_interval: string;
      control: string;
      retention: string;
    }[]
  >`
    SELECT
      parent_table,
      partition_interval,
      control,
      retention
    FROM partman.part_config
    WHERE parent_table = 'public.message';
  `;

  const chatPartitions = await client<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE tablename LIKE 'chat_p%';
  `;

  const messagePartitions = await client<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE tablename LIKE 'message_p%';
  `;

  return {
    chat: {
      configured: chatConfig.length > 0,
      partitions: chatPartitions.length,
    },
    message: {
      configured: messageConfig.length > 0,
      partitions: messagePartitions.length,
    },
  };
}

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const accountId = "edab4ff5b2ccc9769dcd91faa8e30473";
const accessKeyId = "03c613f5e24c323d10acbd7cf63bfe32";
const secretAccessKey = "7578806b63184003e0c74d29861cfd93c7a709d81983a69b384b8f1850baa04f";
const bucketName = "manylead-media";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function clearBucket() {
  console.log(`🗑️  Clearing bucket: ${bucketName}`);

  let totalDeleted = 0;
  let continuationToken: string | undefined;

  do {
    // List objects
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const listResponse = await client.send(listCommand);
    const objects = listResponse.Contents ?? [];

    if (objects.length === 0) {
      console.log("✅ No more objects to delete");
      break;
    }

    console.log(`📦 Found ${objects.length} objects to delete`);

    // Delete objects in batch
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: objects.map((obj) => ({ Key: obj.Key })),
        Quiet: false,
      },
    });

    const deleteResponse = await client.send(deleteCommand);
    const deleted = deleteResponse.Deleted?.length ?? 0;
    totalDeleted += deleted;

    console.log(`🗑️  Deleted ${deleted} objects (total: ${totalDeleted})`);

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  console.log(`\n✅ Bucket cleared! Total objects deleted: ${totalDeleted}`);
}

clearBucket()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

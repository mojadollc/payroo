import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"

const spacesClient = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT!,
  region: "us-east-1", // required by SDK, DO Spaces ignores it
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
})

const BUCKET = process.env.DO_SPACES_BUCKET!
const CDN_URL = process.env.DO_SPACES_CDN_URL!

// ─── Product Images ───────────────────────────────────────────────────────────

/** Replaces Firebase uploadProductImage() — same signature */
export const uploadProductImage = async (file: File, productId: string): Promise<string> => {
  const buffer = Buffer.from(await file.arrayBuffer())
  const key = `products/${productId}/main.jpg`

  await spacesClient.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type || "image/jpeg",
      ACL: "public-read",
    })
  )

  return `${CDN_URL}/${key}`
}

/** Replaces Firebase deleteProductImage() — same signature, never throws */
export const deleteProductImage = async (imageUrl: string): Promise<void> => {
  if (!imageUrl) return
  try {
    // Extract key from CDN URL or full path
    const key = imageUrl.startsWith(CDN_URL)
      ? imageUrl.replace(`${CDN_URL}/`, "")
      : imageUrl

    await spacesClient.send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
    )
  } catch (err) {
    console.warn("[deleteProductImage] skipped:", err)
  }
}

// ─── Delivery Images ──────────────────────────────────────────────────────────

/** Replaces Firebase uploadDeliveryImage() — same signature */
export const uploadDeliveryImage = async (file: File, folder: string): Promise<string> => {
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split(".").pop() || "jpg"
  const key = `delivery/${folder}/${Date.now()}.${ext}`

  await spacesClient.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type || "image/jpeg",
      ACL: "public-read",
    })
  )

  return `${CDN_URL}/${key}`
}

/** Generic upload for any file — used by delivery banners, store logos, etc. */
export const uploadFile = async (
  file: File,
  folder: string,
  filename?: string
): Promise<string> => {
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split(".").pop() || "bin"
  const key = `${folder}/${filename ?? `${Date.now()}.${ext}`}`

  await spacesClient.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      ACL: "public-read",
    })
  )

  return `${CDN_URL}/${key}`
}

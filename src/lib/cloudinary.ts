import { v2 as cloudinary } from 'cloudinary'

// Cloudinary SDK auto-configures from CLOUDINARY_URL env var

export async function uploadBase64(
  base64: string,
  mimeType: string,
  folder: string,
  publicId?: string,
): Promise<string> {
  const dataUri = `data:${mimeType};base64,${base64}`
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    public_id: publicId,
    overwrite: true,
    resource_type: 'auto',
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  })
  return result.secure_url
}

export { cloudinary }

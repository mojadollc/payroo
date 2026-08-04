/**
 * Crop an image file to a centered square and compress as JPEG.
 * Safer for mobile (HEIC/large photos) and produces predictable filenames for Storage.
 */
export function cropImageToSquare(file: File, size = 600): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      try {
        const min = Math.min(img.width, img.height)
        if (min <= 0) {
          URL.revokeObjectURL(url)
          return reject(new Error("Invalid image dimensions"))
        }

        const sx = (img.width - min) / 2
        const sy = (img.height - min) / 2
        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          URL.revokeObjectURL(url)
          return reject(new Error("Canvas not supported"))
        }

        // White background so transparent PNGs don't become black
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
        URL.revokeObjectURL(url)

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Canvas toBlob failed"))
            // Always use a clean, predictable name (avoids weird path chars in Storage)
            resolve(new File([blob], `product-${Date.now()}.jpg`, { type: "image/jpeg" }))
          },
          "image/jpeg",
          0.85 // smaller files for faster POS loads
        )
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to load image — try a different photo (JPG/PNG)"))
    }

    img.src = url
  })
}

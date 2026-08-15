/**
 * Crop an image file to a centered square and compress as JPEG.
 * Uses FileReader instead of createObjectURL for better mobile WebView compatibility.
 */
export function cropImageToSquare(file: File, size = 600): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error("Failed to read image file"))

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (!dataUrl) return reject(new Error("Empty file"))

      const img = new Image()

      img.onerror = () => reject(new Error("Failed to load image — try a different photo (JPG/PNG)"))

      img.onload = () => {
        try {
          const min = Math.min(img.width, img.height)
          if (min <= 0) return reject(new Error("Invalid image dimensions"))

          const canvas = document.createElement("canvas")
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext("2d")
          if (!ctx) return reject(new Error("Canvas not supported"))

          const sx = (img.width - min) / 2
          const sy = (img.height - min) / 2

          ctx.fillStyle = "#ffffff"
          ctx.fillRect(0, 0, size, size)
          ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)

          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error("Canvas toBlob failed"))
              resolve(new File([blob], `product-${Date.now()}.jpg`, { type: "image/jpeg" }))
            },
            "image/jpeg",
            0.85
          )
        } catch (e) {
          reject(e)
        }
      }

      img.src = dataUrl
    }

    reader.readAsDataURL(file)
  })
}

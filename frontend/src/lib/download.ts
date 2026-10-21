/** Hand a file to the browser's download, as if the person had clicked a link to it. */
export function saveFile(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  // The click has already started the download; the address can go once the browser has had a turn.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Save a generated file. Inside a claude.ai artifact the page can't start
 * downloads itself, so it asks the viewer through the `downloads`
 * capability; everywhere else it uses a normal browser download.
 * Resolves "declined" when the viewer says no.
 */
export async function saveFile(filename: string, data: Blob): Promise<"saved" | "declined"> {
  const host = (window as any).claude;
  if (host?.use) {
    const downloads = await host.use("downloads").catch(() => null);
    if (downloads) {
      try {
        await downloads.save({ filename, data });
        return "saved";
      } catch (err: any) {
        if (err?.code === "declined") return "declined";
        throw new Error(err?.message || "Couldn't save the file.");
      }
    }
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "saved";
}

package app.tecnopilot

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import java.security.MessageDigest

/** Photos, videos and music on shared storage, read through MediaStore. */
data class MediaItem(
    val id: Long,
    val uri: Uri,
    val kind: String,
    val name: String,
    val size: Long,
    val modified: Long,
    val folder: String,
)

object StorageScan {

    private val collections = listOf(
        "image" to MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
        "video" to MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
        "audio" to MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
    )

    fun mediaPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= 33) arrayOf(
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_MEDIA_AUDIO,
        ) else arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)

    fun hasAccess(ctx: Context) = mediaPermissions().all {
        ctx.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED
    }

    private const val NO_ACCESS =
        "No access to photos, videos and music yet. Open the Setup tab and allow 'Photos, videos & music'."

    fun all(ctx: Context, kinds: Set<String> = setOf("image", "video", "audio")): List<MediaItem> {
        val out = ArrayList<MediaItem>()
        val cols = arrayOf(
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.SIZE,
            MediaStore.MediaColumns.DATE_MODIFIED,
            MediaStore.MediaColumns.RELATIVE_PATH,
        )
        for ((kind, uri) in collections) {
            if (kind !in kinds) continue
            runCatching {
                ctx.contentResolver.query(uri, cols, null, null, null)?.use { c ->
                    while (c.moveToNext()) {
                        val id = c.getLong(0)
                        out += MediaItem(
                            id = id,
                            uri = ContentUris.withAppendedId(uri, id),
                            kind = kind,
                            name = c.getString(1) ?: "?",
                            size = c.getLong(2),
                            modified = c.getLong(3) * 1000,
                            folder = c.getString(4) ?: "",
                        )
                    }
                }
            }
        }
        return out
    }

    private fun line(m: MediaItem) =
        "#${m.id} ${m.kind} ${bytes(m.size)} · ${m.folder}${m.name} · ${daysAgo(m.modified)} days old"

    fun report(ctx: Context): String {
        val v = DeviceInfo.read(ctx)
        val head = "Internal storage: ${bytes(v.storageFree)} free of ${bytes(v.storageTotal)} " +
            "(${pct(v.storageFree, v.storageTotal)}% free)."
        if (!hasAccess(ctx)) return "$head\n$NO_ACCESS"
        val items = all(ctx)
        val byKind = items.groupBy { it.kind }.mapValues { (_, l) -> l.size to l.sumOf { it.size } }
        // Group by the first two folder levels: "DCIM/Camera", "Android/media/com.whatsapp", …
        val byFolder = items.groupBy { it.folder.split('/').filter(String::isNotEmpty).take(4).joinToString("/") }
            .mapValues { (_, l) -> l.sumOf { it.size } }
            .entries.sortedByDescending { it.value }.take(8)
        val shots = items.filter { it.folder.contains("Screenshot", ignoreCase = true) }
        val chatMedia = items.filter {
            it.folder.contains("WhatsApp", true) || it.folder.contains("Telegram", true)
        }
        return buildString {
            appendLine(head)
            for ((k, p) in byKind) appendLine("${k.replaceFirstChar(Char::uppercase)}s: ${p.first} files, ${bytes(p.second)}")
            appendLine("Biggest folders:")
            for ((f, s) in byFolder) appendLine(" - ${f.ifEmpty { "(root)" }}: ${bytes(s)}")
            appendLine("Screenshots: ${shots.size} files, ${bytes(shots.sumOf { it.size })}")
            appendLine("WhatsApp/Telegram media: ${chatMedia.size} files, ${bytes(chatMedia.sumOf { it.size })}")
            append("App caches are not visible to other apps on Android ${v.android}; Settings › Storage or HiOS Phone Master can clear them.")
        }
    }

    fun largeFiles(ctx: Context, minMb: Int, limit: Int, kind: String): String {
        if (!hasAccess(ctx)) return NO_ACCESS
        val kinds = if (kind == "all") setOf("image", "video", "audio") else setOf(kind)
        val big = all(ctx, kinds).filter { it.size >= minMb * 1_048_576L }.sortedByDescending { it.size }
        if (big.isEmpty()) return "No $kind files of $minMb MB or more."
        return buildString {
            appendLine("${big.size} files of $minMb MB or more, ${bytes(big.sumOf { it.size })} in total. Largest:")
            big.take(limit).forEach { appendLine(line(it)) }
            append("Delete any with delete_media using the #ids (the phone asks you to confirm).")
        }
    }

    fun oldScreenshots(ctx: Context, olderThanDays: Int): String {
        if (!hasAccess(ctx)) return NO_ACCESS
        val old = all(ctx, setOf("image"))
            .filter { it.folder.contains("Screenshot", true) && daysAgo(it.modified) >= olderThanDays }
            .sortedBy { it.modified }
        if (old.isEmpty()) return "No screenshots older than $olderThanDays days."
        return buildString {
            appendLine("${old.size} screenshots older than $olderThanDays days, ${bytes(old.sumOf { it.size })}.")
            appendLine("ids: " + old.joinToString(",") { it.id.toString() })
        }
    }

    /** Same size and the same first 64 KB means the same photo, in practice. */
    fun duplicatePhotos(ctx: Context, limit: Int): String {
        if (!hasAccess(ctx)) return NO_ACCESS
        val groups = all(ctx, setOf("image", "video"))
            .filter { it.size > 50_000 }
            .groupBy { it.size }.values.filter { it.size > 1 }
            .flatMap { sameSize -> sameSize.groupBy { headHash(ctx, it.uri) }.filterKeys { it != null }.values }
            .filter { it.size > 1 }
            .sortedByDescending { g -> g.first().size * (g.size - 1) }
        if (groups.isEmpty()) return "No duplicate photos or videos found."
        val wasted = groups.sumOf { g -> g.first().size * (g.size - 1) }
        return buildString {
            appendLine("${groups.size} sets of duplicates; removing the extra copies frees ${bytes(wasted)}.")
            for (g in groups.take(limit)) {
                val keep = pickKeep(g)
                appendLine("Set (${bytes(g.first().size)} each): keep #${keep.id} ${keep.folder}${keep.name}")
                g.filter { it != keep }.forEach { appendLine("   extra #${it.id} ${it.folder}${it.name}") }
            }
            val extras = groups.flatMap { g -> pickKeep(g).let { keep -> g.filter { it != keep } } }
            append("All extra copies, ids: " + extras.joinToString(",") { it.id.toString() })
        }
    }

    /** The camera copy if there is one, otherwise the oldest (the original). */
    private fun pickKeep(g: List<MediaItem>) =
        g.firstOrNull { it.folder.startsWith("DCIM") } ?: g.minBy { it.modified }

    private fun headHash(ctx: Context, uri: Uri): String? = runCatching {
        ctx.contentResolver.openInputStream(uri)?.use { s ->
            val buf = ByteArray(65_536)
            var n = 0
            while (n < buf.size) {
                val r = s.read(buf, n, buf.size - n)
                if (r < 0) break
                n += r
            }
            MessageDigest.getInstance("SHA-1").digest(buf.copyOf(n)).joinToString("") { "%02x".format(it) }
        }
    }.getOrNull()

    fun find(ctx: Context, ids: List<Long>): List<MediaItem> {
        val wanted = ids.toSet()
        return all(ctx).filter { it.id in wanted }
    }
}

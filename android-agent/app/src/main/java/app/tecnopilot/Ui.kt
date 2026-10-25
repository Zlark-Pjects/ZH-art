package app.tecnopilot

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.StyleSpan
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

object C {
    val BG = Color.parseColor("#0B1420")
    val CARD = Color.parseColor("#14233A")
    val CARD2 = Color.parseColor("#1B2E48")
    val LINE = Color.parseColor("#26405F")
    val ACCENT = Color.parseColor("#3DDBB4")
    val ACCENT_INK = Color.parseColor("#04221B")
    val WARN = Color.parseColor("#FFB547")
    val CRIT = Color.parseColor("#FF6B6B")
    val TEXT = Color.parseColor("#E8EEF5")
    val SUB = Color.parseColor("#8FA3B8")
}

fun Context.dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

fun rounded(ctx: Context, color: Int, radiusDp: Int = 14, stroke: Int? = null) = GradientDrawable().apply {
    setColor(color)
    cornerRadius = ctx.dp(radiusDp).toFloat()
    stroke?.let { setStroke(ctx.dp(1), it) }
}

fun Context.text(s: CharSequence, sizeSp: Float = 15f, color: Int = C.TEXT, bold: Boolean = false) = TextView(this).apply {
    text = s
    setTextColor(color)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
    if (bold) typeface = Typeface.DEFAULT_BOLD
    setLineSpacing(0f, 1.15f)
}

fun Context.button(label: String, primary: Boolean = true, onClick: () -> Unit) = Button(this).apply {
    text = label
    isAllCaps = false
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
    setTextColor(if (primary) C.ACCENT_INK else C.TEXT)
    background = rounded(context, if (primary) C.ACCENT else C.CARD2, 22)
    minHeight = dp(44)
    minimumHeight = dp(44)
    stateListAnimator = null
    setPadding(dp(16), 0, dp(16), 0)
    setOnClickListener { onClick() }
}

fun Context.card(vararg children: View) = LinearLayout(this).apply {
    orientation = LinearLayout.VERTICAL
    background = rounded(context, C.CARD)
    setPadding(dp(16), dp(14), dp(16), dp(14))
    children.forEach { addView(it) }
}

fun lp(w: Int = ViewGroup.LayoutParams.MATCH_PARENT, h: Int = ViewGroup.LayoutParams.WRAP_CONTENT, top: Int = 0, weight: Float = 0f) =
    LinearLayout.LayoutParams(w, h, weight).apply { topMargin = top }

fun Context.row(vararg children: View) = LinearLayout(this).apply {
    orientation = LinearLayout.HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
    children.forEach { addView(it) }
}

/** Just enough Markdown for chat replies: **bold**, # headings and "- " bullets. */
fun miniMarkdown(src: String): CharSequence {
    val out = SpannableStringBuilder()
    src.lines().forEachIndexed { i, raw ->
        if (i > 0) out.append('\n')
        var line = raw
        var bold = false
        val h = Regex("^#{1,6}\\s+").find(line)
        if (h != null) { line = line.substring(h.range.last + 1); bold = true }
        Regex("^(\\s*)[-*]\\s+").find(line)?.let { line = it.groupValues[1] + "• " + line.substring(it.range.last + 1) }
        val start = out.length
        var rest = line
        while (true) {
            val a = rest.indexOf("**")
            val b = if (a >= 0) rest.indexOf("**", a + 2) else -1
            if (a < 0 || b < 0) { out.append(rest); break }
            out.append(rest.substring(0, a))
            val s = out.length
            out.append(rest.substring(a + 2, b))
            out.setSpan(StyleSpan(Typeface.BOLD), s, out.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            rest = rest.substring(b + 2)
        }
        if (bold) out.setSpan(StyleSpan(Typeface.BOLD), start, out.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }
    return out
}

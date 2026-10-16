package ru.mayak.lastlight

import android.content.Context
import android.content.Intent

/**
 * Сборка без платежей RuStore (не задан RUSTORE_APP_ID): SDK в приложение не попадает,
 * игра видит payConfigured() == false и прячет покупки за рубли.
 */
@Suppress("UNUSED_PARAMETER")
class RuStorePay(context: Context, private val send: (String) -> Unit) {
    val configured: Boolean = false
    fun init(ids: List<String>) {}
    fun buy(productId: String) {}
    fun restore() {}
    fun confirm(purchaseId: String) {}
    fun onIntent(intent: Intent?) {}
}

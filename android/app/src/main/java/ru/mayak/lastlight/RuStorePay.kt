package ru.mayak.lastlight

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import ru.rustore.sdk.pay.RuStorePayClient
import ru.rustore.sdk.pay.model.PreferredPurchaseType
import ru.rustore.sdk.pay.model.ProductId
import ru.rustore.sdk.pay.model.ProductPurchaseParams
import ru.rustore.sdk.pay.model.ProductPurchaseStatus
import ru.rustore.sdk.pay.model.ProductType
import ru.rustore.sdk.pay.model.PurchaseAvailabilityResult
import ru.rustore.sdk.pay.model.PurchaseId
import ru.rustore.sdk.pay.model.ProductPurchase
import ru.rustore.sdk.pay.model.RuStorePaymentException

/**
 * Платежи RuStore (Pay SDK) для игры в WebView.
 * Схема двухстадийная: деньги холдируются → игра выдаёт товар и сохраняется → покупка подтверждается.
 * Если приложение закрылось между оплатой и выдачей, оплаченная (PAID) покупка найдётся при следующем запуске.
 * Ответы уходят в игру вызовом window.__LL_pay.<метод>(json).
 */
class RuStorePay(context: Context, private val send: (String) -> Unit) {
    private val main = Handler(Looper.getMainLooper())

    /** В сборке указан ID приложения из консоли RuStore — без него платежи выключены. */
    val configured: Boolean = context.getString(R.string.rustore_console_app_id).isNotBlank()

    private val client get() = RuStorePayClient.instance

    private fun reply(method: String, data: JSONObject) {
        val js = "window.__LL_pay && window.__LL_pay.$method(${data})"
        main.post { send(js) }
    }

    private fun err(e: Throwable?): String = e?.message ?: e?.javaClass?.simpleName ?: "error"

    /** Доступность оплаты и цены товаров из консоли. Ответ: ready({ok, prices, reason}). */
    fun init(ids: List<String>) {
        if (!configured) {
            reply("ready", JSONObject().put("ok", false).put("reason", "not_configured"))
            return
        }
        client.getPurchaseInteractor().getPurchaseAvailability()
            .addOnSuccessListener { result ->
                when (result) {
                    is PurchaseAvailabilityResult.Available -> loadPrices(ids)
                    is PurchaseAvailabilityResult.Unavailable ->
                        reply("ready", JSONObject().put("ok", false).put("reason", err(result.cause)))
                    else -> reply("ready", JSONObject().put("ok", false).put("reason", "unknown"))
                }
            }
            .addOnFailureListener { e -> reply("ready", JSONObject().put("ok", false).put("reason", err(e))) }
    }

    private fun loadPrices(ids: List<String>) {
        client.getProductInteractor().getProducts(ids.map { ProductId(it) })
            .addOnSuccessListener { products ->
                val prices = JSONObject()
                for (p in products) prices.put(p.productId.value, p.amountLabel.value)
                reply("ready", JSONObject().put("ok", true).put("prices", prices))
            }
            .addOnFailureListener { e -> reply("ready", JSONObject().put("ok", false).put("reason", err(e))) }
    }

    /** Покупка. Ответ: result({ok, cancelled, productId, purchaseId, error}). */
    fun buy(productId: String) {
        val params = ProductPurchaseParams(productId = ProductId(productId))
        client.getPurchaseInteractor().purchase(params = params, preferredPurchaseType = PreferredPurchaseType.TWO_STEP)
            .addOnSuccessListener { r ->
                reply("result", JSONObject().put("ok", true).put("productId", r.productId.value).put("purchaseId", r.purchaseId.value))
            }
            .addOnFailureListener { e ->
                val cancelled = e is RuStorePaymentException.ProductPurchaseCancelled
                reply("result", JSONObject().put("ok", false).put("cancelled", cancelled).put("productId", productId).put("error", err(e)))
            }
    }

    /** Оплаченные, но не подтверждённые покупки. Ответ: pending([{productId, purchaseId}]). */
    fun restore() {
        if (!configured) return
        client.getPurchaseInteractor().getPurchases(productType = ProductType.CONSUMABLE_PRODUCT, purchaseStatus = ProductPurchaseStatus.PAID)
            .addOnSuccessListener { list ->
                val arr = JSONArray()
                for (p in list) {
                    if (p !is ProductPurchase) continue
                    arr.put(JSONObject().put("productId", p.productId.value).put("purchaseId", p.purchaseId.value))
                }
                reply("pending", JSONObject().put("list", arr))
            }
            .addOnFailureListener { e -> reply("pending", JSONObject().put("list", JSONArray()).put("error", err(e))) }
    }

    /** Подтверждение после выдачи товара (списывает захолдированные деньги). */
    fun confirm(purchaseId: String) {
        client.getPurchaseInteractor().confirmTwoStepPurchase(purchaseId = PurchaseId(purchaseId))
            .addOnFailureListener { /* одностадийная покупка уже подтверждена; иначе найдётся при следующем запуске */ }
    }

    /** Возврат из банковского приложения или СБП по deeplink. */
    fun onIntent(intent: Intent?) {
        if (intent == null || !configured) return
        try {
            client.getIntentInteractor().proceedIntent(intent)
        } catch (_: Exception) {
        }
    }
}

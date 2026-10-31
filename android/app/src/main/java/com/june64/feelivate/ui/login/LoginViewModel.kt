package com.june64.feelivate.ui.login

import android.app.Application
import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.june64.feelivate.data.ApiClient
import com.june64.feelivate.data.ConsentItem
import com.june64.feelivate.data.GoogleMobileRequest
import com.june64.feelivate.data.GoogleSignIn
import com.june64.feelivate.data.AuthResponse
import com.june64.feelivate.data.LoginRequest
import com.june64.feelivate.data.Prefs
import com.june64.feelivate.data.SignupRequest
import com.june64.feelivate.data.TokenStore
import com.june64.feelivate.data.userMessage
import kotlinx.coroutines.launch

enum class ConsentLoad { Loading, Ready, Failed }

data class LoginUi(
    val isLogin: Boolean = true,
    val loading: Boolean = false,
    val error: String = "",
    val email: String = "",
    val password: String = "",
    val name: String = "",
    val catalogue: List<ConsentItem> = emptyList(),
    val consents: Map<String, Boolean> = emptyMap(),
    val consentLoad: ConsentLoad = ConsentLoad.Loading,
    val signedIn: Boolean = false,
) {
    val consentsSatisfied: Boolean get() = catalogue.isNotEmpty() && catalogue.filter { it.required }.all { consents[it.key] == true }
}

/** pages/LoginPage.tsx state, one to one. */
class LoginViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient.get(app)
    private val store = TokenStore(app)
    private val prefs = Prefs(app)
    var ui by mutableStateOf(LoginUi())
        private set

    init { loadConsentCatalogue() }

    fun setEmail(v: String) { ui = ui.copy(email = v) }
    fun setPassword(v: String) { ui = ui.copy(password = v) }
    fun setName(v: String) { ui = ui.copy(name = v) }
    fun setConsent(key: String, v: Boolean) { ui = ui.copy(consents = ui.consents + (key to v)) }
    fun toggleMode() { ui = ui.copy(isLogin = !ui.isLogin, error = "") }

    fun loadConsentCatalogue() {
        ui = ui.copy(consentLoad = ConsentLoad.Loading)
        viewModelScope.launch {
            runCatching { api.consentCatalogue() }
                .onSuccess { c -> ui = ui.copy(catalogue = c.catalogue, consents = c.catalogue.associate { it.key to false }, consentLoad = ConsentLoad.Ready) }
                .onFailure { ui = ui.copy(consentLoad = ConsentLoad.Failed) }
        }
    }

    fun submit() {
        if (!ui.isLogin && !ui.consentsSatisfied) {
            ui = ui.copy(error = if (ui.catalogue.isEmpty()) "Could not load the consent terms. Please refresh and try again." else "Please accept the required items to create your account.")
            return
        }
        if (ui.email.isBlank() || ui.password.isBlank() || (!ui.isLogin && ui.name.isBlank())) return  // `required` fields on the web form
        ui = ui.copy(loading = true, error = "")
        viewModelScope.launch {
            val fallback = ui.email.substringBefore('@')
            runCatching {
                if (ui.isLogin) api.login(LoginRequest(ui.email, ui.password))
                else api.signup(SignupRequest(ui.email, ui.password, ui.name, ui.consents))
            }.onSuccess { res ->
                store.signIn(res, if (ui.isLogin) fallback else ui.name.ifBlank { res.name ?: fallback })
                if (!ui.isLogin) prefs.startDemo(res.userId)   // brand-new account → queue the first-time walkthrough
                ui = ui.copy(loading = false, signedIn = true)
            }.onFailure { e ->
                ui = ui.copy(loading = false, error = e.userMessage(if (ui.isLogin) "Login failed" else "Signup failed"))
            }
        }
    }

    /** "Continue with Google" — Credential Manager, then the mobile exchange route. */
    fun googleLogin(activity: Context) {
        ui = ui.copy(error = "")
        runCatching { GoogleSignIn.start(activity) }
            .onFailure { ui = ui.copy(error = "Couldn't open the browser for Google sign-in. Please try again or continue with email.") }
    }

    /** The feelivate://auth link came back: this is the same sign-in the website does. */
    fun finishGoogle(result: Result<AuthResponse>) {
        result.onSuccess { res ->
            store.signIn(res, res.name ?: "")
            if (res.isNewUser) prefs.startDemo(res.userId)
            ui = ui.copy(signedIn = true, error = "")
        }.onFailure { e -> ui = ui.copy(error = e.message ?: "Google sign-in failed. Please try again.") }
    }
}

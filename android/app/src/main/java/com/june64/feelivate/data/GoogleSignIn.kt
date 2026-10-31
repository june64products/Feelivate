package com.june64.feelivate.data

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.june64.feelivate.BuildConfig

/**
 * "Continue with Google" on Android: Credential Manager hands us a Google ID
 * token (audience = the same web client id the backend already trusts), and
 * POST /auth/google/mobile exchanges it for the usual Feelivate session.
 */
object GoogleSignIn {
    class Cancelled : Exception("cancelled")
    class NotConfigured : Exception("Google sign-in isn't set up on this build yet.")

    suspend fun idToken(activity: Context): String {
        val clientId = BuildConfig.GOOGLE_WEB_CLIENT_ID
        if (clientId.isBlank()) throw NotConfigured()
        // The explicit-button flow: always shows Google's account chooser, and
        // reports a configuration problem as such instead of "no credential".
        val option = GetSignInWithGoogleOption.Builder(clientId).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        val result = try {
            CredentialManager.create(activity).getCredential(activity, request)
        } catch (e: GetCredentialCancellationException) {
            throw Cancelled()
        } catch (e: NoCredentialException) {
            // Credential Manager says this for two different things: no Google
            // account on the phone, and an OAuth client whose package/SHA-1
            // doesn't match this build (or hasn't propagated yet). Say both.
            throw Exception("Google sign-in isn't available on this phone right now. Check a Google account is added in Settings, try again in a few minutes, or continue with email.")
        } catch (e: GetCredentialException) {
            // Anything else is worth reading verbatim — it names the real cause.
            throw Exception("Google sign-in failed: ${e.type.substringAfterLast('.')} — ${e.message ?: "no details"}")
        }
        val cred = result.credential
        if (cred is CustomCredential && cred.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            return GoogleIdTokenCredential.createFrom(cred.data).idToken
        }
        throw Exception("Google returned something unexpected (${cred.type.substringAfterLast('.')}). Please try again.")
    }
}

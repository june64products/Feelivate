package com.june64.feelivate.ui.login

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.june64.feelivate.R
import com.june64.feelivate.ui.components.ConsentCheckbox
import com.june64.feelivate.ui.components.ErrorBox
import com.june64.feelivate.ui.components.FieldLabel
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.SwissButton
import com.june64.feelivate.ui.components.SwissField
import com.june64.feelivate.ui.components.openUrl
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.components.webUrl
import com.june64.feelivate.ui.theme.EaseStandard
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens

/** pages/LoginPage.tsx, the phone layout: fixed BrandNav, the form, the ticker, the dark footer. */
@Composable
fun LoginScreen(onSignedIn: () -> Unit, vm: LoginViewModel = viewModel()) {
    val t = tokens()
    val ui = vm.ui
    val context = LocalContext.current
    val density = LocalDensity.current
    LaunchedEffect(ui.signedIn) { if (ui.signedIn) onSignedIn() }

    val goLink: (String) -> Unit = { path ->
        when (path) {
            "/features" -> vm.showFeatures(true)
            "/about" -> vm.showAbout(true)
            "/contact" -> vm.showContact(true)
            else -> openUrl(context, if (path.startsWith("mailto:")) path else webUrl(path))
        }
    }

    Box(Modifier.fillMaxSize().background(t.bgPrimary).statusBarsPadding()) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding()) {
            Spacer(Modifier.height(60.dp))   // under the fixed nav

            // ── the form (padding 32px 24px 40px, max-width 380) ──
            Box(Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 32.dp, bottom = 40.dp), contentAlignment = Alignment.TopCenter) {
                Column(Modifier.fillMaxWidth().widthIn(max = 380.dp)) {
                    // Heading: AnimatePresence mode="wait" — out (y 10) then in (y -10), 220ms
                    Column(Modifier.padding(bottom = 36.dp)) {
                        val ten = with(density) { 10.dp.roundToPx() }
                        val six = with(density) { 6.dp.roundToPx() }
                        AnimatedContent(
                            ui.isLogin,
                            transitionSpec = {
                                (fadeIn(tween(220, 220)) + slideInVertically(tween(220, 220)) { -ten }) togetherWith (fadeOut(tween(220)) + slideOutVertically(tween(220)) { ten }) using SizeTransform(clip = false)
                            }, label = "h1",
                        ) { login ->
                            Text(if (login) "Sign in" else "Create account", style = clash(36f, 700, lineHeight = 0.95f, ls = -0.05f), color = t.textPrimary, modifier = Modifier.padding(bottom = 12.dp))
                        }
                        AnimatedContent(
                            ui.isLogin,
                            transitionSpec = {
                                (fadeIn(tween(200, 260)) + slideInVertically(tween(200, 260)) { -six }) togetherWith (fadeOut(tween(200)) + slideOutVertically(tween(200)) { six }) using SizeTransform(clip = false)
                            }, label = "sub",
                        ) { login ->
                            Text(
                                if (login) "Your AI mentor is waiting. Pick up where you left off." else "Start your journey. Your first weekly plan is one conversation away.",
                                style = satoshi(14f, 500, lineHeight = 1.6f), color = t.textSecondary,
                            )
                        }
                    }

                    AnimatedVisibility(ui.error.isNotEmpty(), enter = fadeIn() + slideInVertically { -with(density) { 8.dp.roundToPx() } }, exit = fadeOut() + slideOutVertically { -with(density) { 8.dp.roundToPx() } }) {
                        ErrorBox(ui.error, Modifier.padding(bottom = 18.dp))
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        AnimatedVisibility(!ui.isLogin, enter = expandVertically(tween(320, easing = EaseStandard)) + fadeIn(tween(320)), exit = shrinkVertically(tween(320, easing = EaseStandard)) + fadeOut(tween(320))) {
                            Column(Modifier.padding(bottom = 2.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                FieldLabel("Full Name")
                                SwissField(ui.name, vm::setName, "John Doe", R.drawable.lu_user)
                            }
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Email")
                            SwissField(ui.email, vm::setEmail, "you@example.com", R.drawable.lu_mail, keyboardType = KeyboardType.Email)
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            FieldLabel("Password")
                            SwissField(ui.password, vm::setPassword, "Enter password", R.drawable.lu_lock, password = true, keyboardType = KeyboardType.Password)
                        }

                        // Consent (signup only)
                        AnimatedVisibility(!ui.isLogin && ui.consentLoad == ConsentLoad.Ready && ui.catalogue.isNotEmpty(), enter = expandVertically(tween(320, easing = EaseStandard)) + fadeIn(), exit = shrinkVertically(tween(320, easing = EaseStandard)) + fadeOut()) {
                            Column(Modifier.padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                ui.catalogue.forEach { item ->
                                    ConsentCheckbox(item, ui.consents[item.key] == true, ui.loading) { vm.setConsent(item.key, it) }
                                }
                            }
                        }
                        AnimatedVisibility(!ui.isLogin && ui.consentLoad == ConsentLoad.Failed, enter = expandVertically() + fadeIn(), exit = shrinkVertically() + fadeOut()) {
                            Column(
                                Modifier.fillMaxWidth().padding(top = 4.dp).clip(RoundedCornerShape(4.dp))
                                    .background(androidx.compose.ui.graphics.Color(0x0FEF4444)).border(1.dp, androidx.compose.ui.graphics.Color(0x33EF4444), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 16.dp, vertical = 14.dp),
                            ) {
                                Text("Couldn't load the terms you need to accept.", style = satoshi(13f, 600), color = androidx.compose.ui.graphics.Color(0xFFDC2626), modifier = Modifier.padding(bottom = 4.dp))
                                Text("We can't create an account without them. Check your connection and try again.", style = satoshi(12.5f, 500, lineHeight = 1.55f), color = t.textSecondary, modifier = Modifier.padding(bottom = 10.dp))
                                Box(Modifier.clip(RoundedCornerShape(4.dp)).border(1.dp, androidx.compose.ui.graphics.Color(0x4DEF4444), RoundedCornerShape(4.dp)).tap { vm.loadConsentCatalogue() }.padding(horizontal = 14.dp, vertical = 7.dp)) {
                                    Text("RETRY", style = satoshi(12f, 700, ls = 0.04f), color = androidx.compose.ui.graphics.Color(0xFFDC2626))
                                }
                            }
                        }
                        AnimatedVisibility(!ui.isLogin && ui.consentLoad == ConsentLoad.Loading, enter = fadeIn(), exit = fadeOut()) {
                            Text("Loading terms…", style = satoshi(12.5f, 500), color = t.textMuted, modifier = Modifier.padding(top = 6.dp))
                        }

                        SwissButton(
                            if (ui.isLogin) "Continue" else "Create Account",
                            Modifier.fillMaxWidth().padding(top = 4.dp),
                            enabled = !ui.loading && (ui.isLogin || ui.consentsSatisfied),
                            loading = ui.loading,
                            trailing = { Lucide(R.drawable.lu_arrow_right, 15.dp, t.btnPrimaryText) },
                            onClick = vm::submit,
                        )

                        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            Box(Modifier.weight(1f)) { Hairline(color = t.borderMedium) }
                            Text("OR", style = satoshi(11f, 700, ls = 0.1f), color = t.textMuted)
                            Box(Modifier.weight(1f)) { Hairline(color = t.borderMedium) }
                        }

                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(4.dp)).background(t.cardBg).border(1.dp, t.borderMedium, RoundedCornerShape(4.dp))
                                .tap { vm.googleLogin(context) }.padding(14.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Image(painterResource(R.drawable.google_g), null, Modifier.size(18.dp))
                            Text("Continue with Google", style = satoshi(14f, 600), color = t.textPrimary)
                        }
                    }

                    Text(
                        buildAnnotatedString {
                            append(if (ui.isLogin) "New to Feelivate? " else "Already have an account? ")
                            withStyle(SpanStyle(color = t.textPrimary, fontWeight = FontWeight.Bold, textDecoration = TextDecoration.Underline)) { append(if (ui.isLogin) "Create account" else "Log in here") }
                        },
                        style = satoshi(13.5f, 500), color = t.textSecondary, textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(top = 28.dp).tap { vm.toggleMode() },
                    )
                }
            }

            Marquee()
            SiteFooter(onFeatures = { vm.showFeatures(true) }, onAbout = { vm.showAbout(true) }, onLink = goLink)
        }

        BrandNav(Modifier.align(Alignment.TopCenter), onLink = goLink, onStartFree = { if (ui.isLogin) vm.toggleMode() })

        FeaturesModal(ui.showFeatures, { vm.showFeatures(false) }, vm::startFromModal)
        AboutModal(ui.showAbout, { vm.showAbout(false) }, vm::startFromModal)
        ContactModal(ui.showContact) { vm.showContact(false) }
    }
}

package com.june64.feelivate.ui.login

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.MutableTransitionState
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
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.june64.feelivate.R
import com.june64.feelivate.ui.Routes
import com.june64.feelivate.ui.components.ConsentCheckbox
import com.june64.feelivate.ui.components.ErrorBox
import com.june64.feelivate.ui.components.FieldLabel
import com.june64.feelivate.ui.components.LogoChip
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.Spinner
import com.june64.feelivate.ui.components.SwissButton
import com.june64.feelivate.ui.components.SwissField
import com.june64.feelivate.ui.components.VideoBackground
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.EaseStandard
import com.june64.feelivate.ui.theme.LightTokens
import com.june64.feelivate.ui.theme.LocalTokens
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.motionSpring
import com.june64.feelivate.ui.theme.pressScale
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens

/**
 * The Android welcome screen: the launch film looping silently under a short
 * headline and two ways in. "Continue with Email" lifts the web's sign-in /
 * create-account form in a sheet over the film; Google goes straight through.
 *
 * The film is light, so this screen is always the light palette whatever the
 * device theme — the rest of the app still follows the theme as before.
 */
@Composable
fun LoginScreen(onSignedIn: () -> Unit, onOpenPage: (String) -> Unit, vm: LoginViewModel = viewModel()) {
    val appDark = tokens().isDark
    LightStatusBars(restoreToDark = appDark)
    CompositionLocalProvider(LocalTokens provides LightTokens) {
        Welcome(onSignedIn, onOpenPage, vm)
    }
}

@Composable
private fun Welcome(onSignedIn: () -> Unit, onOpenPage: (String) -> Unit, vm: LoginViewModel) {
    val t = tokens()
    val ui = vm.ui
    val context = LocalContext.current
    val density = LocalDensity.current
    var sheet by remember { mutableStateOf(false) }
    LaunchedEffect(ui.signedIn) { if (ui.signedIn) onSignedIn() }
    BackHandler(sheet) { sheet = false }

    // The headline and buttons rise in once the screen is up, the way the web's hero does.
    val entered = remember { MutableTransitionState(false).apply { targetState = true } }

    Box(Modifier.fillMaxSize().background(t.bgPrimary)) {
        // The film is 9:16; sized to that ratio it needs no cropping, and on
        // taller phones the page colour simply continues below it.
        VideoBackground(R.raw.login_bg, Modifier.fillMaxWidth().aspectRatio(9f / 16f).align(Alignment.TopCenter))

        Row(
            Modifier.align(Alignment.TopStart).statusBarsPadding().padding(horizontal = 22.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            LogoChip(28.dp, 7.dp, 16.dp)
            Text("Feelivate", style = clash(16f, 700, ls = -0.02f), color = t.textPrimary)
        }

        // ── the lower panel: a fade out of the film, then the page colour ──
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth()) {
            Box(Modifier.fillMaxWidth().height(170.dp).background(Brush.verticalGradient(listOf(Color.Transparent, t.bgPrimary))))
            Column(Modifier.fillMaxWidth().background(t.bgPrimary).navigationBarsPadding().padding(start = 24.dp, end = 24.dp, bottom = 16.dp)) {
                AnimatedVisibility(
                    entered,
                    enter = fadeIn(tween(520, 80, EaseStandard)) + slideInVertically(tween(520, 80, EaseStandard)) { with(density) { 18.dp.roundToPx() } },
                ) {
                    Column {
                        Text("Goals that actually stick.", style = clash(34f, 700, lineHeight = 1.02f, ls = -0.035f), color = t.textPrimary)
                        Text("Your AI accountability partner.", style = satoshi(15.5f, 500, lineHeight = 1.5f), color = t.textSecondary, modifier = Modifier.padding(top = 8.dp))
                    }
                }

                AnimatedVisibility(ui.error.isNotEmpty() && !sheet, enter = fadeIn() + expandVertically(), exit = fadeOut() + shrinkVertically()) {
                    ErrorBox(ui.error, Modifier.padding(top = 16.dp))
                }

                AnimatedVisibility(
                    entered,
                    enter = fadeIn(tween(520, 200, EaseStandard)) + slideInVertically(tween(520, 200, EaseStandard)) { with(density) { 18.dp.roundToPx() } },
                ) {
                    Column(Modifier.padding(top = 26.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        HeroButton("Continue with Google", filled = false, enabled = !ui.loading, onClick = { vm.googleLogin(context) }) {
                            if (ui.loading && !sheet) Spinner(18.dp, t.textSecondary)
                            else Image(painterResource(R.drawable.google_g), null, Modifier.size(20.dp))
                        }
                        HeroButton("Continue with Email", filled = true, enabled = !ui.loading, onClick = { sheet = true }) {
                            Lucide(R.drawable.lu_mail, 20.dp, t.btnPrimaryText)
                        }
                        LegalLine(onOpenPage, Modifier.padding(top = 6.dp))
                    }
                }
            }
        }

        EmailSheet(open = sheet, onClose = { sheet = false }, vm = vm)
    }
}

/** One of the two ways in: a 56dp pill, filled for the primary path. */
@Composable
private fun HeroButton(text: String, filled: Boolean, enabled: Boolean, onClick: () -> Unit, leading: @Composable () -> Unit) {
    val t = tokens()
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier.fillMaxWidth().pressScale(0.98f).height(56.dp).clip(shape)
            .background(if (filled) t.btnPrimaryBg else t.cardBg)
            .border(1.dp, if (filled) Color.Transparent else t.borderMedium, shape)
            .tap(enabled, onClick),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(22.dp), contentAlignment = Alignment.Center) { leading() }
        Box(Modifier.width(12.dp))
        Text(text, style = satoshi(16f, 700, ls = -0.01f), color = if (filled) t.btnPrimaryText else t.textPrimary)
    }
}

@Composable
private fun LegalLine(onOpenPage: (String) -> Unit, modifier: Modifier = Modifier) {
    val t = tokens()
    val link = TextLinkStyles(SpanStyle(color = t.textSecondary, textDecoration = TextDecoration.Underline))
    Text(
        buildAnnotatedString {
            append("By continuing you agree to our ")
            withLink(LinkAnnotation.Clickable("terms", link) { onOpenPage(Routes.TERMS) }) { append("Terms") }
            append(" and ")
            withLink(LinkAnnotation.Clickable("privacy", link) { onOpenPage(Routes.PRIVACY) }) { append("Privacy Policy") }
            append(".")
        },
        style = satoshi(11.5f, 500, lineHeight = 1.5f), color = t.textMuted, textAlign = TextAlign.Center,
        modifier = modifier.fillMaxWidth(),
    )
}

/* ── the email form, lifted from the web's LoginPage ───────────────────── */

@Composable
private fun BoxScope.EmailSheet(open: Boolean, onClose: () -> Unit, vm: LoginViewModel) {
    val t = tokens()
    val ui = vm.ui
    val density = LocalDensity.current
    val maxH = (LocalConfiguration.current.screenHeightDp * 0.92f).dp

    AnimatedVisibility(open, enter = fadeIn(tween(220)), exit = fadeOut(tween(200))) {
        Box(Modifier.fillMaxSize().background(t.modalOverlay).tap(onClick = onClose))
    }
    AnimatedVisibility(
        open, modifier = Modifier.align(Alignment.BottomCenter),
        enter = slideInVertically(motionSpring(300f, 30f)) { it } + fadeIn(tween(160)),
        exit = slideOutVertically(tween(240, easing = EaseStandard)) { it } + fadeOut(tween(200)),
    ) {
        val shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
        Column(
            Modifier.fillMaxWidth().heightIn(max = maxH).clip(shape).background(t.sheetBg).border(1.dp, t.borderSubtle, shape)
                .imePadding().navigationBarsPadding()
                .verticalScroll(rememberScrollState()).padding(start = 24.dp, end = 24.dp, top = 10.dp, bottom = 24.dp),
        ) {
            Box(Modifier.align(Alignment.CenterHorizontally).width(36.dp).height(4.dp).clip(CircleShape).background(t.borderMedium))

            // Heading: AnimatePresence mode="wait" — out (y 10) then in (y -10), 220ms
            Column(Modifier.padding(top = 22.dp, bottom = 26.dp)) {
                val ten = with(density) { 10.dp.roundToPx() }
                val six = with(density) { 6.dp.roundToPx() }
                AnimatedContent(
                    ui.isLogin,
                    transitionSpec = {
                        (fadeIn(tween(220, 220)) + slideInVertically(tween(220, 220)) { -ten }) togetherWith (fadeOut(tween(220)) + slideOutVertically(tween(220)) { ten }) using SizeTransform(clip = false)
                    }, label = "h1",
                ) { login ->
                    Text(if (login) "Sign in" else "Create account", style = clash(30f, 700, lineHeight = 0.98f, ls = -0.04f), color = t.textPrimary, modifier = Modifier.padding(bottom = 10.dp))
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
                            .background(Color(0x0FEF4444)).border(1.dp, Color(0x33EF4444), RoundedCornerShape(4.dp))
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                    ) {
                        Text("Couldn't load the terms you need to accept.", style = satoshi(13f, 600), color = Color(0xFFDC2626), modifier = Modifier.padding(bottom = 4.dp))
                        Text("We can't create an account without them. Check your connection and try again.", style = satoshi(12.5f, 500, lineHeight = 1.55f), color = t.textSecondary, modifier = Modifier.padding(bottom = 10.dp))
                        Box(Modifier.clip(RoundedCornerShape(4.dp)).border(1.dp, Color(0x4DEF4444), RoundedCornerShape(4.dp)).tap { vm.loadConsentCatalogue() }.padding(horizontal = 14.dp, vertical = 7.dp)) {
                            Text("RETRY", style = satoshi(12f, 700, ls = 0.04f), color = Color(0xFFDC2626))
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
            }

            Text(
                buildAnnotatedString {
                    append(if (ui.isLogin) "New to Feelivate? " else "Already have an account? ")
                    withStyle(SpanStyle(color = t.textPrimary, fontWeight = FontWeight.Bold, textDecoration = TextDecoration.Underline)) { append(if (ui.isLogin) "Create account" else "Log in here") }
                },
                style = satoshi(13.5f, 500), color = t.textSecondary, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 24.dp).tap { vm.toggleMode() },
            )
        }
    }
}

/* ── system bars ───────────────────────────────────────────────────────── */

/**
 * The film is light, so the status-bar icons must be dark while this screen
 * shows — even on a dark device. Put back what the app theme wants on exit.
 */
@Composable
private fun LightStatusBars(restoreToDark: Boolean) {
    val view = LocalView.current
    DisposableEffect(restoreToDark) {
        val window = view.context.activity()?.window
        val bars = window?.let { WindowCompat.getInsetsController(it, view) }
        bars?.isAppearanceLightStatusBars = true
        bars?.isAppearanceLightNavigationBars = true
        onDispose {
            bars?.isAppearanceLightStatusBars = !restoreToDark
            bars?.isAppearanceLightNavigationBars = !restoreToDark
        }
    }
}

private tailrec fun Context.activity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.activity()
    else -> null
}

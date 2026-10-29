package com.june64.feelivate.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.june64.feelivate.data.TokenStore
import com.june64.feelivate.ui.login.LoginScreen
import com.june64.feelivate.ui.pages.AboutScreen
import com.june64.feelivate.ui.pages.BlogScreen
import com.june64.feelivate.ui.pages.ContactScreen
import com.june64.feelivate.ui.pages.FeaturesScreen
import com.june64.feelivate.ui.pages.LegalScreen
import com.june64.feelivate.ui.pages.PricingScreen
import com.june64.feelivate.ui.workspace.WorkspaceScreen

object Routes {
    const val LOGIN = "login"
    const val APP = "app"
    const val FEATURES = "features"
    const val PRICING = "pricing"
    const val ABOUT = "about"
    const val CONTACT = "contact"
    const val BLOG = "blog"
    const val TERMS = "terms"
    const val PRIVACY = "privacy"

    /** The web's paths, so a link in any screen routes the same way it does on the site. */
    fun forPath(path: String): String? = when (path) {
        "/features" -> FEATURES; "/pricing" -> PRICING; "/about" -> ABOUT
        "/contact" -> CONTACT; "/blog" -> BLOG; "/terms" -> TERMS; "/privacy" -> PRIVACY
        else -> null
    }
}

@Composable
fun AppNav() {
    val context = LocalContext.current
    val store = remember { TokenStore(context) }
    val nav = rememberNavController()
    val back: () -> Unit = { nav.popBackStack() }
    // "Start free" from any page: the workspace when signed in, otherwise sign-up.
    val start: () -> Unit = {
        nav.popBackStack(if (store.isSignedIn) Routes.APP else Routes.LOGIN, inclusive = false)
    }

    NavHost(navController = nav, startDestination = if (store.isSignedIn) Routes.APP else Routes.LOGIN) {
        composable(Routes.LOGIN) {
            LoginScreen(
                onSignedIn = { nav.navigate(Routes.APP) { popUpTo(Routes.LOGIN) { inclusive = true } } },
                onOpenPage = { route -> nav.navigate(route) },
            )
        }
        composable(Routes.APP) {
            WorkspaceScreen(
                onSignedOut = { nav.navigate(Routes.LOGIN) { popUpTo(Routes.APP) { inclusive = true } } },
                onOpenPage = { route -> nav.navigate(route) },
            )
        }
        composable(Routes.FEATURES) { FeaturesScreen(back, start) }
        composable(Routes.PRICING) { PricingScreen(back, start) }
        composable(Routes.ABOUT) { AboutScreen(back, start) }
        composable(Routes.CONTACT) { ContactScreen(back) }
        composable(Routes.BLOG) { BlogScreen(back, start) }
        composable(Routes.TERMS) {
            LegalScreen("terms.json", "Terms of Service", "Legal", "Terms of Service", "The rules for using Feelivate.", back)
        }
        composable(Routes.PRIVACY) {
            LegalScreen("privacy.json", "Privacy Policy", "Legal", "Privacy Policy", "How Feelivate collects, uses and protects your data.", back)
        }
    }
}

package com.june64.feelivate.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.june64.feelivate.data.TokenStore
import com.june64.feelivate.ui.login.LoginScreen
import com.june64.feelivate.ui.workspace.WorkspaceScreen

object Routes {
    const val LOGIN = "login"
    const val APP = "app"
}

@Composable
fun AppNav() {
    val context = LocalContext.current
    val store = remember { TokenStore(context) }
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = if (store.isSignedIn) Routes.APP else Routes.LOGIN) {
        composable(Routes.LOGIN) {
            LoginScreen(onSignedIn = { nav.navigate(Routes.APP) { popUpTo(Routes.LOGIN) { inclusive = true } } })
        }
        composable(Routes.APP) {
            WorkspaceScreen(onSignedOut = { nav.navigate(Routes.LOGIN) { popUpTo(Routes.APP) { inclusive = true } } })
        }
    }
}

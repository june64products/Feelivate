package com.june64.feelivate.ui.workspace

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.june64.feelivate.data.TokenStore
import com.june64.feelivate.ui.components.PillButton
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.tokens

/** Placeholder until the mission workspace lands (next build). */
@Composable
fun WorkspaceScreen(onSignedOut: () -> Unit) {
    val t = tokens()
    val context = LocalContext.current
    val store = remember { TokenStore(context) }
    Box(Modifier.fillMaxSize().background(t.bgPrimary).statusBarsPadding(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Workspace — building", style = clash(22f, 700), color = t.textPrimary, modifier = Modifier.padding(bottom = 16.dp))
            PillButton("Log out") { store.clear(); onSignedOut() }
        }
    }
}

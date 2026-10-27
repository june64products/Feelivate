package com.june64.feelivate

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.june64.feelivate.ui.AppNav
import com.june64.feelivate.ui.theme.FeelivateTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FeelivateTheme {
                AppNav()
            }
        }
    }
}

"use client"

import { EditorProvider, useEditor } from "./editor-context"
import { UploadPanel } from "./upload-panel"
import { SettingsPanel } from "./settings-panel"

export function EditorLayoutInner() {
    const { hasImages } = useEditor()

    return (
        <div className="min-h-[calc(100vh-3.5rem)] border-t-2 border-foreground">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] min-h-[calc(100vh-3.5rem)]">
                {/* Left Panel - Upload/Canvas */}
                <div className="border-b-2 lg:border-b-0 lg:border-r-2 border-foreground bg-background">
                    <UploadPanel />
                </div>

                {/* Right Panel - Pitch/Settings */}
                <div className="bg-secondary">
                    <SettingsPanel />
                </div>
            </div>
        </div>
    )
}

export function EditorLayout() {
    return (
        <EditorProvider>
            <EditorLayoutInner />
        </EditorProvider>
    )
}

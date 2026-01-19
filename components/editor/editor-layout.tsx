"use client"

import { EditorProvider, useEditor } from "./editor-context"
import { UploadPanel } from "./upload-panel"
import { SettingsPanel } from "./settings-panel"

export function EditorLayoutInner() {
    const { hasImages } = useEditor()

    return (
        <div className="h-[calc(100vh-3.5rem)] border-t-2 border-foreground overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] h-full">
                {/* Left Panel - Upload/Canvas */}
                <div className="border-b-2 lg:border-b-0 lg:border-r-2 border-foreground bg-background h-full overflow-hidden">
                    <UploadPanel />
                </div>

                {/* Right Panel - Pitch/Settings */}
                <div className="bg-secondary h-full overflow-hidden">
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

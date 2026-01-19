"use client"

import { EditorProvider, useEditor } from "./editor-context"
import { UploadPanel } from "./upload-panel"
import { SettingsPanel } from "./settings-panel"

export function EditorLayoutInner() {
    const { hasImages } = useEditor()

    return (
        <div className="h-full w-full overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] h-full">
                {/* Left Panel - Upload/Canvas */}
                <div className="border-b lg:border-b-0 lg:border-r border-foreground bg-background h-full overflow-hidden flex flex-col min-h-0">
                    <UploadPanel />
                </div>

                {/* Right Panel - Pitch/Settings */}
                <div className="bg-secondary h-full overflow-hidden flex flex-col min-h-0">
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
